import { describe, expect, it } from "vitest";
import fixture from "@/fixtures/attempt.json";
import { CardSchema } from "@/lib/card/types";
import { inboxFor } from "@/lib/card/recruiter";
import { verifyEvidence } from "@/lib/card/verify";
import { makeStore, MemoryKV } from "@/lib/store/store";
import { funnelByChallenge, impactReport } from "./metrics";
import { IMPACT_EMPLOYERS, OPT_IN_GROUPS, seedImpactDemo, syntheticCohort } from "./seed";

const seeded = () => {
  const s = makeStore(new MemoryKV());
  seedImpactDemo(s);
  return s;
};

describe("E7.4 synthetic cohort", () => {
  it("is deterministic: 200 candidates, 3 employers, clearly synthetic names", () => {
    const a = syntheticCohort();
    expect(a).toEqual(syntheticCohort());
    expect(a).toHaveLength(200);
    expect(new Set(a.map((c) => c.employerId)).size).toBe(3);
    const s = seeded();
    for (const card of s.listCards()) expect(card.candidate.displayName).toMatch(/^Synthetic candidate \d{3}$/);
    expect(new Set(s.listCards().map((c) => c.candidate.displayName)).size).toBe(160);
  });

  it("varies modes, timing, opt-in groups and decisions so the charts look real", () => {
    const a = syntheticCohort();
    for (const m of ["video", "voice", "text"]) expect(a.filter((c) => c.mode === m).length).toBeGreaterThan(30);
    expect(a.filter((c) => c.adjustedTiming).length).toBeGreaterThan(15);
    expect(a.filter((c) => !c.optInGroup).length).toBeGreaterThan(30);
    for (const d of ["shortlist", "hold", "pass"]) expect(a.filter((c) => c.decision === d).length).toBeGreaterThan(10);
    expect(a.filter((c) => c.finished && !c.decision).length).toBeGreaterThan(5);
  });

  it("gives candidates different answers, and every quote passes the transcript check", () => {
    const cards = seeded().listCards();
    for (const id of ["cp1", "cp2", "rl", "fu"]) expect(new Set(cards.map((c) => c.checkpoints.find((x) => x.id === id)!.transcript.text)).size).toBe(4);
    for (const card of cards) {
      expect(verifyEvidence(card).dropped).toEqual([]);
      for (const e of card.evidence) if (e.level !== "not_observed") expect(e.sentence).toBeTruthy();
    }
  });

  it("feeds the recruiter inbox for each employer, anonymous by default", () => {
    const s = seeded();
    for (const e of IMPACT_EMPLOYERS) {
      const rows = inboxFor(s, e.id, ["adaptability", "resilience", "prioritization", "collaboration"]);
      expect(rows.length).toBeGreaterThan(50);
      // Anonymous first review: only shortlisted candidates show their (synthetic) name.
      for (const r of rows) expect(r.displayName).toMatch(r.status === "shortlist" ? /^Synthetic candidate \d{3}$/ : /^Candidate D\d{3}$/);
      expect(new Set(rows.map((r) => r.status)).size).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("E7.1 funnel per challenge", () => {
  it("counts started, finished and shortlisted for each challenge, summing to the cohort", () => {
    const s = seeded();
    const f = funnelByChallenge(s, "demo");
    expect(f.map((x) => x.challengeId)).toEqual(IMPACT_EMPLOYERS.map((e) => e.id).sort());
    expect(f.reduce((n, x) => n + x.started, 0)).toBe(200);
    expect(f.reduce((n, x) => n + x.finished, 0)).toBe(160);
    expect(f.reduce((n, x) => n + x.shortlisted, 0)).toBe(impactReport(s, undefined, "demo").shortlisted);
    const energy = f.find((x) => x.challengeId === "ch_impact_energy")!;
    expect(energy).toMatchObject({ company: "Prairie Grid Energy (fictional)", started: 67 });
    for (const x of f) {
      expect(x.started).toBeGreaterThanOrEqual(x.finished);
      expect(x.finished).toBeGreaterThanOrEqual(x.shortlisted);
    }
  });

  it("is empty without data and keeps live and demo apart", () => {
    const s = makeStore(new MemoryKV());
    expect(funnelByChallenge(s)).toEqual([]);
    seedImpactDemo(s);
    expect(funnelByChallenge(s, "live")).toEqual([]);
  });

  it("counts a card shared to a second employer in that employer's funnel", () => {
    const s = makeStore(new MemoryKV());
    const card = CardSchema.parse(fixture);
    s.saveCard(card);
    s.share(card.attemptId, "ch_other", true);
    expect(funnelByChallenge(s).map((x) => [x.challengeId, x.finished])).toEqual([[card.challenge.id, 1], ["ch_other", 1]]);
  });
});

describe("E7.2 completion and shortlist rate by mode and accommodation", () => {
  it("reports both rates for every answer mode and for adjusted vs standard timing", () => {
    const r = impactReport(seeded(), undefined, "demo");
    expect(r.groups.map((g) => g.label)).toEqual(["text", "video", "voice"]);
    expect(r.timing.map((g) => g.label)).toEqual(["Adjusted timing", "Standard timing"]);
    for (const g of [...r.groups, ...r.timing]) {
      expect(g.completion).toBeCloseTo(g.finished / g.started);
      expect(g.rate).toBeCloseTo(g.shortlisted / g.finished);
    }
    expect(r.groups.reduce((n, g) => n + g.started, 0)).toBe(200);
    expect(r.groups.find((g) => g.label === "video")!.warning).toBe(true);
  });
});

describe("E7.3 opt-in demographics with the four-fifths rule", () => {
  it("only counts candidates who opted in, and warns when a group is below 80% of the top rate", () => {
    const s = seeded();
    const r = impactReport(s, undefined, "demo");
    const optedIn = syntheticCohort().filter((c) => c.optInGroup).length;
    expect(r.demographics.map((g) => g.label)).toEqual([...OPT_IN_GROUPS]);
    expect(r.demographics.reduce((n, g) => n + g.started, 0)).toBe(optedIn);
    const best = Math.max(...r.demographics.map((g) => g.rate ?? 0));
    for (const g of r.demographics) expect(g.warning).toBe(g.rate! / best < 0.8);
    expect(r.demographics.find((g) => g.label === "Opt-in group C")!.warning).toBe(true);
  });

  it("never puts demographics on a card or an inbox row, and never changes evidence", () => {
    const s = seeded();
    for (const card of s.listCards()) expect(JSON.stringify(card)).not.toMatch(/opt-in group|optInGroup/i);
    const rows = inboxFor(s, "ch_impact_energy", ["collaboration"], { anonymous: false });
    expect(JSON.stringify(rows)).not.toMatch(/opt-in group|optInGroup/i);
    // Same evidence levels whatever group a candidate opted into: levels come from the cohort's evidence draw only.
    const cohort = syntheticCohort();
    for (const c of cohort.filter((c) => c.finished)) expect(s.getCard(c.attemptId)!.evidence.map((e) => e.level)).toEqual(c.levels);
  });

  it("shows no demographic rows when nobody opted in", () => {
    const s = makeStore(new MemoryKV());
    const base = CardSchema.parse(fixture);
    for (let i = 0; i < 12; i++) {
      s.saveCard({ ...base, attemptId: `x${i}` });
      s.saveRun({ attemptId: `x${i}`, challengeId: base.challenge.id, scenarioId: "launch-week", seed: "x", state: {}, status: "finished", startedAt: base.finishedAt, practice: false, extra: { impactParticipation: { mode: "text", adjustedTiming: false } } });
    }
    expect(impactReport(s).demographics).toEqual([]);
  });
});
