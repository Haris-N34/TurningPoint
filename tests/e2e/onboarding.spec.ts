import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { playToCheckpoint } from "./helpers";

async function toPreferences(page: import("@playwright/test").Page) {
  await page.goto("/candidate/intro");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Show how you think");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByText(/Two or three surprise checkpoints/)).toBeVisible();
  await expect(page.getByText(/never score faces/)).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
}

test("intro saves accommodations, skips devices for text and applies timers", async ({ page }) => {
  await toPreferences(page);
  await page.getByLabel("Text only", { exact: true }).check();
  await page.getByLabel("2× time", { exact: true }).check();
  await page.getByLabel("Screen reader mode", { exact: true }).check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByText("Text mode is ready. No camera or microphone needed.")).toBeVisible();
  await page.getByRole("link", { name: "Continue to challenge" }).click();
  await page.getByRole("button", { name: "I agree, start" }).click();
  await playToCheckpoint(page);
  await expect(page.getByTestId("checkpoint")).toContainText("Take 30 seconds to think. You then have 120 seconds.");
  const p = await page.evaluate(() => JSON.parse(localStorage.getItem("tp:profile")!));
  expect(p.accommodations).toMatchObject({ textOnly: true, screenReader: true, timeMultiplier: 2 });
});

test("device check previews video and releases tracks on navigation", async ({ page }) => {
  await toPreferences(page);
  await page.getByLabel("Video", { exact: true }).check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Check devices" }).click();
  await expect(page.getByRole("button", { name: "Device connected", exact: true })).toBeVisible();
  const preview = page.getByLabel("Live camera preview");
  await expect.poll(() => preview.evaluate((v: HTMLVideoElement) => v.videoWidth)).toBeGreaterThan(0);
  await expect(page.getByRole("meter", { name: "Microphone level" })).toBeVisible();
  await page.evaluate(() => { (window as unknown as { checkedStream: MediaStream }).checkedStream = (document.querySelector("video") as HTMLVideoElement).srcObject as MediaStream; });
  await page.getByRole("button", { name: "Back", exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { checkedStream: MediaStream }).checkedStream.getTracks().every(t => t.readyState === "ended"))).toBe(true);
});

test("denied devices fall back to text without blocking the challenge", async ({ page }) => {
  await page.addInitScript(() => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException("Denied", "NotAllowedError"); }; });
  await toPreferences(page);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Check devices" }).click();
  await expect(page.getByRole("status")).toContainText("Text mode is ready");
  await expect(page.getByLabel("Text only", { exact: true })).toBeChecked();
  await page.getByRole("link", { name: "Continue to challenge" }).click();
  await expect(page.getByRole("button", { name: "I agree, start" })).toBeVisible();
});

test("every preparation screen fits and has no serious axe findings", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/candidate/intro");
  for (let i = 0; i < 4; i++) {
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
    expect((await new AxeBuilder({ page }).analyze()).violations.filter(v => ["serious", "critical"].includes(v.impact ?? ""))).toEqual([]);
    if (i < 3) await page.getByRole("button", { name: "Continue", exact: true }).click();
  }
});
