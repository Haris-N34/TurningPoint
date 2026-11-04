import { expect, test } from "@playwright/test";
import { answerCheckpoint, FAKE_SPEECH, installFakeSpeech, playToCheckpoint, playToEnd, setProfile, type Mode } from "./helpers";

type Answer = { id: string; kind: string; mode: string; question: string; transcript: { text: string; words: unknown[] }; media?: string; retakeUsed: boolean };

for (const mode of ["video", "voice", "text"] as Mode[]) {
  test(`records every checkpoint in ${mode} mode and shows transcripts on results (M2)`, async ({ page }) => {
    await installFakeSpeech(page);
    await page.goto("/play/sample");
    await page.getByRole("button", { name: "Start" }).click();
    const answered = await playToEnd(page, mode);
    expect(answered).toBeGreaterThanOrEqual(4); // 2 or 3 decisions + real life + follow-up

    const started = Date.now();
    await page.getByTestId("see-results").click();
    await expect(page.getByTestId("results")).toBeVisible();
    const answers: Answer[] = await page.evaluate(() => {
      const k = Object.keys(localStorage).find((x) => x.startsWith("tp:run:"))!;
      return JSON.parse(localStorage.getItem(k)!).extra.answers;
    });
    expect(answers.filter((a) => a.kind === "decision").length).toBeGreaterThanOrEqual(2);
    expect(answers.map((a) => a.kind)).toEqual(expect.arrayContaining(["real_life", "follow_up"]));
    for (const a of answers) {
      expect(a.mode).toBe(mode);
      expect(a.transcript.text.length).toBeGreaterThan(0);
      expect(a.transcript.words.length).toBeGreaterThan(0);
      if (mode !== "text") expect(a.media).toBeTruthy();
      await expect(page.getByTestId(`answer-${a.id}`)).toContainText(a.transcript.text.slice(0, 20));
    }
    if (mode !== "text") expect(answers[0].transcript.text).toBe(FAKE_SPEECH);
    expect(Date.now() - started).toBeLessThan(30_000); // C4.7
  });
}

test("checkpoint question quotes the choice just made (C4.2)", async ({ page }) => {
  await page.goto("/play/sample");
  await page.getByRole("button", { name: "Start" }).click();
  const label = await playToCheckpoint(page);
  await expect(page.getByTestId("checkpoint-question")).toHaveAttribute("aria-label", new RegExp(`"${label}"`));
});

test("text mode blocks paste, allows one retake, and logs focus loss as context (C4.4, C4.5, C4.8)", async ({ page }) => {
  await setProfile(page, { accommodations: { textOnly: true, timeMultiplier: 1 } });
  await page.goto("/play/sample");
  await page.getByRole("button", { name: "Start" }).click();
  await playToCheckpoint(page);
  const cp = page.getByTestId("checkpoint");
  await expect(cp.locator('input[value="video"]')).toBeDisabled();
  await cp.getByRole("button", { name: /start answering/i }).click();

  const box = cp.getByTestId("answer-text");
  await box.focus();
  await page.evaluate(() => {
    const ta = document.querySelector('[data-testid="answer-text"]')!;
    const dt = new DataTransfer();
    dt.setData("text/plain", "pasted from ChatGPT");
    ta.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await expect(box).toHaveValue("");
  await expect(cp.getByText("Paste is off")).toBeVisible();

  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.waitForTimeout(1100);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await box.fill("First try.");
  await cp.getByRole("button", { name: "Done" }).click();
  await cp.getByRole("button", { name: /Retake/ }).click();
  await cp.getByTestId("answer-text").fill("Second try, better.");
  await cp.getByRole("button", { name: "Done" }).click();
  await expect(cp.getByRole("button", { name: /Retake/ })).toHaveCount(0);
  await cp.getByRole("button", { name: "Submit" }).click();

  const extra = await page.evaluate(() => {
    const k = Object.keys(localStorage).find((x) => x.startsWith("tp:run:"))!;
    return JSON.parse(localStorage.getItem(k)!).extra;
  });
  expect(extra.answers[0].retakeUsed).toBe(true);
  expect(extra.answers[0].transcript.text).toBe("Second try, better.");
  expect(extra.integrity.map((n: { kind: string }) => n.kind)).toEqual(expect.arrayContaining(["focus_lost", "retake_used"]));
});

test("accommodation multiplier stretches the timers (C1.4)", async ({ page }) => {
  await setProfile(page, { accommodations: { timeMultiplier: 2, textOnly: true } });
  await page.goto("/play/sample");
  await page.getByRole("button", { name: "Start" }).click();
  await playToCheckpoint(page);
  await expect(page.getByTestId("checkpoint").getByText("Take 30 seconds to think. You then have 120 seconds.")).toBeVisible();
  await answerCheckpoint(page, "text");
});
