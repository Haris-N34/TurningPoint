import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { answerCheckpoint, nextStep, playToCheckpoint } from "./helpers";

// Voice and video answers: speech to text keeps listening, shows live captions, explains errors,
// and the candidate can type or fix the words before submitting (only the words are scored).

type Script = { at: number; type: "interim" | "final" | "end" | "error"; text?: string; error?: string }[];

/** A scripted SpeechRecognition. Each start() plays `perStart[n]` (the last one repeats). */
async function scriptedSpeech(page: Page, perStart: Script[]) {
  await page.addInitScript((plays: Script[]) => {
    const w = window as unknown as Record<string, unknown> & { __recStarts: number };
    w.__recStarts = 0;
    class Rec {
      continuous = false;
      interimResults = false;
      lang = "en";
      onresult: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      private timers: ReturnType<typeof setTimeout>[] = [];
      private ended = false;
      start() {
        const play = plays[Math.min(w.__recStarts, plays.length - 1)];
        w.__recStarts++;
        for (const step of play)
          this.timers.push(
            setTimeout(() => {
              if (this.ended) return;
              if (step.type === "end") return this.end();
              if (step.type === "error") return this.onerror?.({ error: step.error });
              const res = Object.assign([{ transcript: step.text }], { isFinal: step.type === "final" });
              this.onresult?.({ resultIndex: 0, results: [res] });
            }, step.at),
          );
      }
      stop() {
        setTimeout(() => this.end(), 50);
      }
      private end() {
        if (this.ended) return;
        this.ended = true;
        this.timers.forEach(clearTimeout);
        this.onend?.();
      }
    }
    w.webkitSpeechRecognition = Rec;
    w.SpeechRecognition = Rec;
  }, perStart);
}

async function toVoiceAnswer(page: Page) {
  await page.goto("/play/sample");
  await page.getByRole("button", { name: "I agree, start" }).click();
  await playToCheckpoint(page);
  const cp = page.getByTestId("checkpoint");
  await cp.locator('label:has(input[value="voice"])').click();
  await cp.getByRole("button", { name: /start answering/i }).click();
  await expect(cp).toHaveAttribute("data-phase", "answer", { timeout: 20_000 });
  return cp;
}

async function savedAnswer(page: Page) {
  return page.evaluate(() => {
    const k = Object.keys(localStorage).find((x) => x.startsWith("tp:run:"))!;
    return JSON.parse(localStorage.getItem(k)!).extra.answers[0] as { mode: string; transcript: { text: string; words: { w: string }[] } };
  });
}

test("speech restarts after the browser stops it, shows live captions, keeps every word", async ({ page }) => {
  await scriptedSpeech(page, [
    [
      { at: 200, type: "interim", text: "I cut the" },
      // Interim words stay up for a few seconds so a slow test machine still sees them.
      { at: 4000, type: "final", text: "I cut the second weekend" },
      { at: 4400, type: "end" }, // browser ends recognition by itself (silence)
    ],
    [
      { at: 300, type: "interim", text: "because vendors" },
      { at: 900, type: "final", text: "because vendors were the draw" },
    ],
  ]);
  const cp = await toVoiceAnswer(page);
  await expect(cp.getByTestId("mic-meter")).toBeVisible();
  await expect(cp.getByTestId("speech-status")).toHaveAttribute("data-speech", "listening");
  await expect(cp.getByTestId("interim")).toHaveText("I cut the");
  await expect(cp.getByTestId("live-captions")).toContainText("I cut the second weekend", { timeout: 8000 });
  await expect(cp.getByTestId("live-captions")).toContainText("because vendors were the draw", { timeout: 10_000 });
  expect(await page.evaluate(() => (window as unknown as { __recStarts: number }).__recStarts)).toBeGreaterThanOrEqual(2);

  await cp.getByRole("button", { name: "Done" }).click();
  await expect(cp.getByTestId("transcript")).toHaveValue("I cut the second weekend because vendors were the draw");
  // The candidate fixes a misheard word; the fixed words are what is saved and scored.
  await cp.getByTestId("transcript").fill("I cut the second weekend because vendors were the main draw");
  await cp.getByRole("button", { name: "Submit" }).click();
  await expect(cp).toBeHidden();
  const a = await savedAnswer(page);
  expect(a.mode).toBe("voice");
  expect(a.transcript.text).toBe("I cut the second weekend because vendors were the main draw");
  expect(a.transcript.words.map((w) => w.w).join(" ")).toBe(a.transcript.text);
  // The original recognition is kept for the recruiter, and the fix is noted as context.
  expect((a as unknown as { recognizedText: string }).recognizedText).toBe("I cut the second weekend because vendors were the draw");
  const integrity = await page.evaluate(() => {
    const k = Object.keys(localStorage).find((x) => x.startsWith("tp:run:"))!;
    return JSON.parse(localStorage.getItem(k)!).extra.integrity as { kind: string; detail: string }[];
  });
  expect(integrity).toContainEqual(expect.objectContaining({ kind: "transcript_corrected", detail: "Transcript corrected before submit: 1 word changed (context, not scored)" }));
});

test("a blocked speech service says so in plain words and the candidate types instead", async ({ page }) => {
  await scriptedSpeech(page, [[{ at: 100, type: "error", error: "not-allowed" }, { at: 150, type: "end" }]]);
  const cp = await toVoiceAnswer(page);
  await expect(cp.getByTestId("speech-status")).toContainText("blocked speech to text");
  await expect(cp.getByTestId("speech-status")).toHaveAttribute("data-speech", "error");
  await cp.getByRole("button", { name: "Done" }).click();
  await expect(cp.getByText("We didn't catch any words")).toBeVisible();
  await cp.getByTestId("transcript").fill("I cut the second weekend.");
  await cp.getByRole("button", { name: "Submit" }).click();
  await expect(cp).toBeHidden();
  expect((await savedAnswer(page)).transcript.text).toBe("I cut the second weekend.");
});

test("no speech recognition (Firefox): a heads-up before answering, recording still works, type the words", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    delete w.SpeechRecognition;
    delete w.webkitSpeechRecognition;
  });
  await page.goto("/play/sample");
  await page.getByRole("button", { name: "I agree, start" }).click();
  await playToCheckpoint(page);
  const cp = page.getByTestId("checkpoint");
  await cp.locator('label:has(input[value="voice"])').click();
  await expect(cp.getByTestId("speech-unsupported")).toContainText("can't turn speech into text");
  await cp.getByRole("button", { name: /start answering/i }).click();
  await expect(cp).toHaveAttribute("data-phase", "answer", { timeout: 20_000 });
  await expect(cp.getByTestId("speech-status")).toHaveAttribute("data-speech", "unsupported");
  await page.waitForTimeout(800);
  await cp.getByRole("button", { name: "Done" }).click();
  await cp.getByTestId("transcript").fill("We kept both days and cut vendor spots.");
  await cp.getByRole("button", { name: "Submit" }).click();
  await expect(cp).toBeHidden();
  const a = await savedAnswer(page);
  expect(a.mode).toBe("voice");
  expect(a.transcript.text).toBe("We kept both days and cut vendor spots.");
});

test("paste is blocked when fixing the transcript too", async ({ page }) => {
  await scriptedSpeech(page, [[{ at: 200, type: "final", text: "I cut the second weekend" }]]);
  const cp = await toVoiceAnswer(page);
  await page.waitForTimeout(600);
  await cp.getByRole("button", { name: "Done" }).click();
  await expect(cp.getByTestId("transcript")).toHaveValue("I cut the second weekend");
  await page.evaluate(() => {
    const ta = document.querySelector('[data-testid="transcript"]')!;
    const dt = new DataTransfer();
    dt.setData("text/plain", "pasted essay");
    ta.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await expect(cp.getByTestId("transcript")).toHaveValue("I cut the second weekend");
  await expect(cp.getByText("Paste is off")).toBeVisible();
});

// In the map game the checkpoint is a short live video interview (A.7).
async function toGameCheckpoint(page: Page) {
  await page.goto("/game/launch-week");
  await expect(page.getByTestId("game-shell")).toHaveAttribute("data-ready", "1");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByTestId("set-turn-based").check();
  // Full week: the roles pick triggers a checkpoint (Quick mode only asks about the recovery pick).
  await page.getByTestId("set-full-week").check();
  await page.getByTestId("start").click();
  await page.getByTestId("avatar-done").click();
  await expect(page.getByTestId("game-shell")).toHaveAttribute("data-screen", "play", { timeout: 20_000 });
  await page.getByTestId("go-roles").click();
  await expect(page.getByTestId("dialogue")).toBeVisible({ timeout: 15_000 });
  for (let i = 0; i < 10 && !(await page.getByTestId("choice-c").isVisible()); i++) {
    await page.keyboard.press("Enter");
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(400);
  await page.getByTestId("choice-c").click();
  const cp = page.getByTestId("checkpoint");
  await expect(cp).toBeVisible({ timeout: 10_000 });
  return cp;
}

test("game: the checkpoint pops up as a video interview with the camera on by default", async ({ page }) => {
  // 2x think time so a slow test machine never runs out the think timer before the keyboard check.
  await page.addInitScript(() => {
    if (!localStorage.getItem("tp:profile")) localStorage.setItem("tp:profile", JSON.stringify({ accommodations: { timeMultiplier: 2, textOnly: false } }));
  });
  await scriptedSpeech(page, [[{ at: 300, type: "interim", text: "I took it" }, { at: 900, type: "final", text: "I took logistics myself so the team stayed happy" }]]);
  const cp = await toGameCheckpoint(page);
  await expect(cp).toHaveAttribute("data-variant", "game");
  await expect(cp).toHaveAttribute("data-mode", "video");
  await expect(cp.getByTestId("interviewer")).toContainText("Priya");
  await expect(cp.getByTestId("checkpoint-question")).toHaveAttribute("aria-label", /^You chose C/);
  // The option letter is a badge (B never reads as 8 in the pixel font), and the question shows in full at once.
  await expect(cp.getByTestId("choice-letter")).toHaveText("C");
  await expect(cp.getByTestId("checkpoint-question")).toContainText("Walk us through why.");
  await expect(cp.getByTestId("timer-label")).toHaveText("Think 30s");
  await expect(cp.getByTestId("think-note")).toContainText("Then 120 seconds to answer.");
  await expect(cp.getByTestId("camera-check")).toContainText("Camera check", { timeout: 15_000 });
  await expect.poll(() => cp.getByTestId("camera-preview").evaluate((v: HTMLVideoElement) => v.videoWidth), { timeout: 10_000 }).toBeGreaterThan(0);
  // The mic meter moves with the fake device's beep.
  await expect.poll(async () => Number(await cp.getByTestId("mic-meter").getAttribute("data-level")), { timeout: 10_000, intervals: [100] }).toBeGreaterThan(0);
  // Text is always one click away (hard rule: no camera needed).
  await expect(cp.locator('input[value="text"]')).toBeEnabled();
  // One way to switch: the "Answer by" choices under the preview, with a hint (no duplicate buttons).
  await expect(cp.getByTestId("camera-hint")).toContainText("Rather not be on camera?");
  await expect(cp.getByTestId("switch-text")).toHaveCount(0);
  await expect(cp.getByRole("group", { name: "Answer by" })).toBeVisible();

  // Keyboard only: the start button has focus.
  await expect(cp.getByRole("button", { name: /start answering/i })).toBeFocused();
  const results = await new AxeBuilder({ page }).include('[data-testid="checkpoint"]').analyze();
  expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);

  await page.keyboard.press("Enter");
  await expect(cp).toHaveAttribute("data-phase", "answer", { timeout: 20_000 });
  await expect(cp.getByTestId("live-captions")).toContainText("I took logistics myself", { timeout: 5000 });
  await cp.getByRole("button", { name: "Done" }).click();
  await expect(cp.getByTestId("transcript")).toHaveValue("I took logistics myself so the team stayed happy");
  await cp.getByRole("button", { name: "Submit" }).click();
  await expect(cp).toBeHidden({ timeout: 10_000 });
});

test("game: no camera means a calm switch to voice, and no mic means text", async ({ page }) => {
  await page.addInitScript(() => {
    const md = navigator.mediaDevices;
    const real = md.getUserMedia.bind(md);
    md.getUserMedia = (c?: MediaStreamConstraints) => {
      const w = window as unknown as { __noMic?: boolean };
      if (c?.video || w.__noMic) return Promise.reject(new DOMException("denied", "NotAllowedError"));
      return real(c);
    };
  });
  const cp = await toGameCheckpoint(page);
  await expect(cp).toHaveAttribute("data-mode", "voice", { timeout: 15_000 });
  const note = cp.getByTestId("device-note");
  await expect(note).toContainText("didn't allow the camera");
  await expect(note).toContainText("counts exactly the same");
  await expect(note).toContainText("The timer waits for you.");
  // Calm tone: the note uses the normal text colour, not a warning colour.
  const color = await note.evaluate((el) => getComputedStyle(el).color);
  const body = await cp.evaluate((el) => getComputedStyle(el.firstElementChild!).color);
  expect(color).toBe(body);

  await page.evaluate(() => ((window as unknown as { __noMic?: boolean }).__noMic = true));
  await cp.locator('label:has(input[value="video"])').click();
  await expect(cp).toHaveAttribute("data-mode", "text", { timeout: 15_000 });
  await cp.getByRole("button", { name: /start answering/i }).click();
  await cp.getByTestId("answer-text").fill("I took logistics myself so the team stayed happy.");
  await cp.getByRole("button", { name: "Done" }).click();
  await cp.getByRole("button", { name: "Submit" }).click();
  await expect(cp).toBeHidden({ timeout: 10_000 });
});

test("game: timer accommodation still applies in the interview", async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("tp:profile")) localStorage.setItem("tp:profile", JSON.stringify({ accommodations: { timeMultiplier: 1.5, textOnly: false } }));
  });
  const cp = await toGameCheckpoint(page);
  await expect(cp.getByTestId("timer-label")).toHaveText("Think 23s");
  await expect(cp.getByTestId("think-note")).toContainText("Then 90 seconds to answer.");
});

// The 60 s stage demo: the recovery pick is the run's first checkpoint, so the camera check happens there.
async function toDemoCheckpoint(page: Page) {
  await page.goto("/game/launch-week?jump=turning-point");
  await expect(page.getByTestId("game-shell")).toHaveAttribute("data-ready", "1");
  await page.keyboard.press("Enter");
  await page.getByTestId("avatar-done").click();
  await page.getByTestId("cutscene-next").click({ timeout: 20_000 });
  await page.getByTestId("cutscene-done").click();
  await page.getByTestId("go-recovery-plan").click();
  await expect(page.getByTestId("dialogue")).toBeVisible({ timeout: 15_000 });
  for (let i = 0; i < 10 && !(await page.getByTestId("choice-b").isVisible()); i++) {
    await page.keyboard.press("Enter");
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(400);
  await page.getByTestId("choice-b").click();
  const cp = page.getByTestId("checkpoint");
  await expect(cp).toBeVisible({ timeout: 10_000 });
  return cp;
}

/** Seconds on the think ring. */
const thinkLeft = async (page: Page) => Number(((await page.getByRole("timer").getAttribute("aria-label")) ?? "").match(/(\d+) seconds/)?.[1]);

test("demo path: camera already allowed, the first checkpoint opens on camera with no extra step", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "stage demo runs on a laptop");
  test.setTimeout(90_000);
  const cp = await toDemoCheckpoint(page);
  await expect(cp.getByTestId("checkpoint-question")).toHaveAttribute("aria-label", /^You chose B, to keep Saturday and Sunday/);
  await expect(cp.getByTestId("choice-letter")).toHaveText("B");
  // The recovery plan comes from the HQ laptop, a prop: the hiring panel asks instead.
  await expect(cp.getByTestId("interviewer")).toContainText("Hiring panel");
  await expect(cp.getByTestId("interviewer")).not.toContainText(/laptop/i);
  await expect(cp).toHaveAttribute("data-mode", "video");
  await expect(cp.getByTestId("camera-check")).toContainText("Camera check", { timeout: 5000 });
  // The think timer is already running: no extra click, no waiting on a prompt.
  await expect.poll(() => thinkLeft(page), { timeout: 5000 }).toBeLessThan(15);
  await expect(cp.getByRole("button", { name: /start answering/i })).toBeVisible();
  // Game modals keep the primary action bottom right.
  const card = (await cp.locator("> div").first().boundingBox())!;
  const btn = (await cp.getByRole("button", { name: /start answering/i }).boundingBox())!;
  expect(card.x + card.width - (btn.x + btn.width)).toBeLessThan(40);
});

test("recruiter card words a retake neutrally", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "one size is enough");
  await page.goto("/demo/seed");
  await expect(page.getByTestId("seeded")).toBeVisible();
  await page.goto("/recruiter/card/att_demo_maya?challenge=ch_demo_energy");
  await expect(page.getByTestId("retake-cp2")).toHaveText("second take");
  await expect(page.getByTestId("capability-card")).toContainText("second take", { useInnerText: true });
  await expect(page.getByTestId("capability-card")).not.toContainText("Retake used");
});

test("demo path: camera and mic refused, the first checkpoint opens calmly in text", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "stage demo runs on a laptop");
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("denied", "NotAllowedError"));
  });
  const cp = await toDemoCheckpoint(page);
  await expect(cp).toHaveAttribute("data-mode", "text", { timeout: 5000 });
  await expect(cp.getByTestId("device-note")).toHaveText(
    "The browser didn't allow the camera and microphone. Answer in text instead; it counts exactly the same. The timer waits for you.",
  );
  await expect(cp).not.toContainText(/couldn't|error/i);
  await expect(cp.getByTestId("fallback-voice")).toHaveCount(0);
  // The timer holds until the candidate taps.
  await page.waitForTimeout(2000);
  expect(await thinkLeft(page)).toBe(15);
  await cp.getByTestId("fallback-text").click();
  await expect.poll(() => thinkLeft(page), { timeout: 5000 }).toBeLessThan(15);
  await cp.getByRole("button", { name: /start answering/i }).click();
  await cp.getByTestId("answer-text").fill("Saturday and Sunday are the market. Promotion can wait.");
  await cp.getByRole("button", { name: "Done" }).click();
  await cp.getByRole("button", { name: "Submit" }).click();
  await expect(cp).toBeHidden({ timeout: 10_000 });
});

// Judge check: the stage laptop denies only the camera. One calm line, one tap to voice or text,
// no red error, and the think timer waits while they choose. Runs at 1280x720 (desktop) and 375 (phone).
test("demo path: camera denied, calm one-line note, one tap to voice or text, timer waits", async ({ page }, info) => {
  test.setTimeout(90_000);
  if (info.project.name === "desktop") await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => {
    const md = navigator.mediaDevices;
    const real = md.getUserMedia.bind(md);
    md.getUserMedia = (c?: MediaStreamConstraints) => (c?.video ? Promise.reject(new DOMException("denied", "NotAllowedError")) : real(c));
  });
  const cp = await toDemoCheckpoint(page);
  const note = cp.getByTestId("device-note");
  await expect(note).toHaveText("The browser didn't allow the camera. Answer by voice or text instead; it counts exactly the same. The timer waits for you.", { timeout: 10_000 });
  // Calm: normal text colour, no alert role, no error words.
  expect(await note.evaluate((el) => getComputedStyle(el).color)).toBe(await cp.evaluate((el) => getComputedStyle(el.firstElementChild!).color));
  await expect(cp.getByRole("alert")).toHaveCount(0);
  await expect(cp).not.toContainText(/couldn't|error|failed/i);
  // One tap each way, and the timer is not running while they choose.
  await expect(cp.getByTestId("fallback-voice")).toBeVisible();
  await expect(cp.getByTestId("fallback-text")).toBeVisible();
  await expect(cp.getByTestId("fallback-voice")).toBeInViewport();
  await page.waitForTimeout(2000);
  expect(await thinkLeft(page)).toBe(15);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `docs/screens/night/checkpoint/${info.project.name}-5-camera-denied.png`, style: "nextjs-portal{display:none!important}" });

  await cp.getByTestId("fallback-voice").click();
  await expect(cp).toHaveAttribute("data-mode", "voice");
  await expect(cp.getByTestId("device-choice")).toHaveCount(0);
  await expect.poll(() => thinkLeft(page), { timeout: 5000 }).toBeLessThan(15);
});

test("real life: a one-line, off-topic answer gets a kind 'tell us more' follow-up", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "one size is enough");
  test.setTimeout(120_000);
  await page.goto("/play/sample");
  await page.getByRole("button", { name: "I agree, start" }).click();
  for (let i = 0; i < 60; i++) {
    const s = await nextStep(page);
    if (s === "real-life") break;
    if (s === "checkpoint") await answerCheckpoint(page, "text");
    else if (s === "choice") await page.locator('[data-testid^="option-"]').first().click();
    else if (s === "continue") await page.getByRole("button", { name: /^(Continue|Face it)$/ }).click();
    else throw new Error(`unexpected ${s}`);
  }
  await page.getByTestId("real-life-intro").getByRole("button", { name: "Start" }).click();
  const cp = page.getByTestId("checkpoint");
  await cp.locator('label:has(input[value="text"])').click();
  await cp.getByRole("button", { name: /start answering/i }).click();
  await cp.getByTestId("answer-text").fill("I like pizza.");
  await cp.getByRole("button", { name: "Done" }).click();
  await cp.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByTestId("checkpoint-question")).toHaveAttribute("aria-label", "Tell us a bit more: what went wrong, and what did you do about it?");
});
