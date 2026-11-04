import { expect, type Page } from "@playwright/test";

/** Fake browser speech recognition: every recording "hears" this sentence (no network in tests). */
export const FAKE_SPEECH =
  "I let the team vote because nobody wanted logistics and the funder pulled out in June so we cut the second weekend.";

export async function installFakeSpeech(page: Page, text = FAKE_SPEECH) {
  await page.addInitScript((said: string) => {
    class FakeRec {
      continuous = false;
      interimResults = false;
      lang = "en";
      onresult: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      private t: ReturnType<typeof setTimeout> | undefined;
      start() {
        this.t = setTimeout(() => {
          const res = Object.assign([{ transcript: said }], { isFinal: true });
          this.onresult?.({ resultIndex: 0, results: [res] });
        }, 400);
      }
      stop() {
        clearTimeout(this.t);
        setTimeout(() => this.onend?.(), 50);
      }
    }
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition = FakeRec;
    (window as unknown as Record<string, unknown>).SpeechRecognition = FakeRec;
  }, text);
}

export async function setProfile(page: Page, profile: Record<string, unknown>) {
  await page.addInitScript((p) => {
    if (!localStorage.getItem("tp:profile")) localStorage.setItem("tp:profile", JSON.stringify(p));
  }, profile);
}

export type Mode = "video" | "voice" | "text";

export async function answerCheckpoint(page: Page, mode: Mode, typed = "I cut the second weekend instead of vendor spots because vendors were the draw.") {
  const cp = page.getByTestId("checkpoint");
  await expect(cp).toBeVisible();
  await expect(page.getByTestId("checkpoint-question")).toHaveAttribute("aria-label", /\S/);
  await cp.locator(`label:has(input[value="${mode}"])`).click();
  await cp.getByRole("button", { name: /start answering/i }).click();
  await expect(cp).toHaveAttribute("data-phase", "answer");
  if (mode === "text") {
    await cp.getByTestId("answer-text").fill(typed);
  } else {
    await page.waitForTimeout(1200);
  }
  await cp.getByRole("button", { name: "Done" }).click();
  await expect(cp.getByTestId("transcript")).not.toBeEmpty();
  const q = await page.getByTestId("checkpoint-question").getAttribute("aria-label");
  await cp.getByRole("button", { name: "Submit" }).click();
  // Closed, or replaced by the next checkpoint (real life is followed by its follow-up).
  await expect
    .poll(async () => {
      if (!(await cp.isVisible())) return true;
      const now = await page.getByTestId("checkpoint-question").getAttribute("aria-label", { timeout: 300 }).catch(() => null);
      return now !== null && now !== q;
    })
    .toBe(true);
}

const OPTION = '[data-testid^="option-"]';

/** Wait until the game settles on something actionable and say what it is. */
export async function nextStep(page: Page) {
  const anything = page
    .getByTestId("checkpoint")
    .or(page.getByTestId("end"))
    .or(page.getByTestId("real-life-intro"))
    .or(page.getByTestId("story-title"))
    .or(page.locator(OPTION).first())
    .or(page.getByRole("button", { name: /^(Continue|Face it)$/ }));
  await expect(anything.first()).toBeVisible();
  await page.waitForTimeout(300); // let scene transitions finish
  if (await page.getByTestId("checkpoint").isVisible()) return "checkpoint" as const;
  if (await page.getByTestId("end").isVisible()) return "end" as const;
  if (await page.getByTestId("real-life-intro").isVisible()) return "real-life" as const;
  if (await page.getByTestId("story-title").isVisible()) return "title" as const;
  if (await page.locator(OPTION).first().isVisible()) return "choice" as const;
  return "continue" as const;
}

/** Make choices (first option) until a decision checkpoint opens. Returns the label of the last choice. */
export async function playToCheckpoint(page: Page) {
  let label = "";
  for (let i = 0; i < 20; i++) {
    const s = await nextStep(page);
    if (s === "checkpoint") return label;
    if (s === "choice") {
      label = (await page.locator(OPTION).first().innerText()).trim();
      await page.locator(OPTION).first().click();
    } else if (s === "continue") {
      await page.getByRole("button", { name: /^(Continue|Face it)$/ }).click();
    } else {
      throw new Error(`no checkpoint before ${s}`);
    }
  }
  throw new Error("no checkpoint");
}

/** Play to the end with the keyboard, answering every checkpoint in one mode. Returns how many were answered. */
export async function playToEnd(page: Page, mode: Mode = "text") {
  let answered = 0;
  for (let i = 0; i < 60; i++) {
    const s = await nextStep(page);
    if (s === "end") return answered;
    if (s === "checkpoint") {
      await answerCheckpoint(page, mode);
      answered++;
    } else if (s === "real-life") {
      await page.getByTestId("real-life-intro").getByRole("button", { name: "Start" }).click();
    } else if (s === "title") {
      await page.getByTestId("story-title").fill("The summer our garden lost its funding");
      await page.getByRole("button", { name: "Finish" }).click();
    } else {
      // Keyboard only (C2.6): focus must already be on the right control.
      await expect(page.locator(":focus")).toBeVisible();
      if (s === "choice") await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
    }
  }
  throw new Error("did not reach the end");
}
