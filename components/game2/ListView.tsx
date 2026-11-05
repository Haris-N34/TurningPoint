"use client";

import { useState } from "react";
import { hiddenAvailable, openIssues, type GameState } from "@/lib/game/engine";
import type { Issue, MapScenario } from "@/lib/game/schema";
import { formatDuration } from "@/lib/game/time";
import { Panel, PixelButton } from "./ui";

// Accessible list view (PRD v2, A10): zones and open issues as a list, same actions, same clock,
// same outcomes as the map. No canvas, full keyboard use, screen-reader friendly.
export function ListView({
  scenario,
  state,
  onTalk,
  onDelegate,
  onDefer,
  onMove,
}: {
  scenario: MapScenario;
  state: GameState;
  onTalk: (i: Issue) => void;
  onDelegate: (i: Issue, to: string) => void;
  onDefer: (i: Issue, reason: string) => void;
  onMove: (zone: string) => void;
}) {
  const open = openIssues(scenario, state);
  const hidden = hiddenAvailable(scenario, state);
  const volunteers = scenario.npcs.filter((n) => n.volunteer);
  const [menu, setMenu] = useState<string | null>(null);
  return (
    <div className="absolute inset-0 overflow-y-auto bg-[#7cbe6e] p-3 pb-40 pt-28 sm:pt-24" data-testid="list-view">
      <div className="mx-auto grid max-w-5xl gap-3 sm:grid-cols-2">
        {scenario.zones.map((z) => {
          const here = open.filter((i) => i.zone === z.id);
          const extras = hidden.filter((i) => i.zone === z.id);
          const dark = state.darkZones.includes(z.id);
          return (
            <section key={z.id} aria-labelledby={`z-${z.id}`}>
              <Panel className={dark ? "p-3 opacity-70" : "p-3"}>
                <div className="flex items-center justify-between gap-2">
                  <h2 id={`z-${z.id}`} className="font-bold">
                    {z.name} {state.zone === z.id && <span className="text-xs font-normal">(you are here)</span>} {dark && <span className="text-xs">(closed)</span>}
                  </h2>
                  {state.zone !== z.id && (
                    <button className="rounded-[3px] border-2 border-[#2e222f] bg-white px-2 text-sm" onClick={() => onMove(z.id)} data-testid={`list-move-${z.id}`}>
                      Go here
                    </button>
                  )}
                </div>
                <p className="text-xs text-[#6a5a4a]">{scenario.npcs.filter((n) => n.zone === z.id && !n.ambient && n.id !== "laptop").map((n) => `${n.name} (${n.role})`).join(", ") || "Your desk"}</p>
                <ul className="mt-2 space-y-2">
                  {here.map((i) => {
                    const st = state.issues[i.id];
                    const npc = scenario.npcs.find((n) => n.id === i.npc)!;
                    return (
                      <li key={i.id} className="rounded-[4px] border-2 border-[#2e222f] bg-white p-2" data-testid={`list-issue-${i.id}`}>
                        <p className="font-semibold">
                          {i.severity === "high" ? "Urgent: " : i.severity === "medium" ? "Soon: " : "Minor: "}
                          {i.title}
                        </p>
                        <p className="text-xs">
                          With {npc.name}. {formatDuration((st.deadline ?? state.t) - state.t)} left. Talking takes about {i.talkCost} minutes.
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <PixelButton className="min-h-9 py-0 text-sm" onClick={() => onTalk(i)} data-testid={`list-talk-${i.id}`}>Talk</PixelButton>
                          {i.delegable && (
                            <PixelButton tone="plain" className="min-h-9 py-0 text-sm" aria-expanded={menu === `d-${i.id}`} onClick={() => setMenu(menu === `d-${i.id}` ? null : `d-${i.id}`)}>
                              Delegate
                            </PixelButton>
                          )}
                          <PixelButton tone="plain" className="min-h-9 py-0 text-sm" aria-expanded={menu === `f-${i.id}`} onClick={() => setMenu(menu === `f-${i.id}` ? null : `f-${i.id}`)} data-testid={`list-defer-${i.id}`}>
                            Defer
                          </PixelButton>
                        </div>
                        {menu === `d-${i.id}` && (
                          <div className="mt-1 flex flex-wrap gap-1" role="group" aria-label="Delegate to">
                            {volunteers.map((v) => (
                              <button key={v.id} className="rounded bg-[#e8d9b5] px-2 text-sm" disabled={(st.delegate ?? []).some((d) => d.to === v.id)} onClick={() => { setMenu(null); onDelegate(i, v.id); }}>
                                {v.name}
                              </button>
                            ))}
                          </div>
                        )}
                        {menu === `f-${i.id}` && (
                          <div className="mt-1 flex flex-col gap-1" role="group" aria-label="Reason to defer">
                            {scenario.deferReasons.map((r) => (
                              <button key={r} className="rounded bg-[#e8d9b5] px-2 text-left text-sm" onClick={() => { setMenu(null); onDefer(i, r); }}>
                                {r}
                              </button>
                            ))}
                          </div>
                        )}
                      </li>
                    );
                  })}
                  {extras.map((i) => (
                    <li key={i.id}>
                      <button className="text-sm underline" onClick={() => onTalk(i)} data-testid={`list-explore-${i.id}`}>
                        Look around: {scenario.npcs.find((n) => n.id === i.npc)?.name}
                      </button>
                    </li>
                  ))}
                  {!here.length && !extras.length && <li className="text-sm text-[#6a5a4a]">Nothing needs you here right now.</li>}
                </ul>
              </Panel>
            </section>
          );
        })}
      </div>
    </div>
  );
}
