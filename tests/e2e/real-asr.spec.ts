import path from "node:path";
import { expect, test } from "@playwright/test";
import { playToCheckpoint } from "./helpers";

// Opt-in (REAL_ASR=1): real spoken audio through the fake microphone, the browser's real speech API
// (which in test Chromium has no speech service, exactly like Chromium, Brave and some Edge builds),
// and the real on-device Whisper model (downloaded from huggingface.co, about 40 MB, cached after).
// The speech was generated with espeak-ng: "I kept Saturday and Sunday because the market is the whole
// point. I cut the stage and the promotion instead, and I told the vendors first."
const WAV = path.join(__dirname, "../fixtures/audio/answer-speech.wav");
test.use({
  launchOptions: {
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
      `--use-file-for-fake-audio-capture=${WAV}`,
    ],
  },
});

for (const mode of ["voice", "video"] as const)
  test(`real speech becomes a transcript even when live captions don't work (${mode})`, async ({
    page,
  }, info) => {
    test.skip(
      process.env.REAL_ASR !== "1",
      "set REAL_ASR=1 (downloads the on-device model)",
    );
    test.skip(info.project.name !== "desktop", "one size is enough");
    test.setTimeout(180_000);
    await page.goto("/play/sample");
    await page.getByRole("button", { name: "I agree, start" }).click();
    await playToCheckpoint(page);
    const cp = page.getByTestId("checkpoint");
    await cp.locator(`label:has(input[value="${mode}"])`).click();
    await cp.getByRole("button", { name: /start answering/i }).click();
    await expect(cp).toHaveAttribute("data-phase", "answer", {
      timeout: 20_000,
    });
    // Before the fix this said "Listening" while nothing was being heard.
    await expect(cp.getByTestId("speech-status")).toContainText(
      "Live captions aren't working in this browser",
      { timeout: 8000 },
    );
    await page.waitForTimeout(12_000);
    await cp.getByRole("button", { name: "Done" }).click();
    await expect(cp.getByTestId("transcript")).not.toHaveValue("", {
      timeout: 120_000,
    });
    const text = (
      await cp.getByTestId("transcript").inputValue()
    ).toLowerCase();
    // The bug was "no words at all". Accuracy on this robotic voice varies a little run to run (the
    // candidate fixes words in the box), so most of the key words must come through.
    const keys = [
      "saturday",
      "sunday",
      "market",
      "stage",
      "promotion",
      "cut",
      "told",
    ];
    expect(keys.filter((w) => text.includes(w)).length).toBeGreaterThanOrEqual(
      5,
    );
  });
