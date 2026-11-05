import { expect, test } from "@playwright/test";
import { issueBadge } from "@/lib/integrations/credential";

// QA night: a badge signed with any key other than the server's issuer key must not verify, even though
// its signature is internally consistent. This test process has its own random issuer key: a stranger.
test("/verify rejects a badge self-signed by another key", async ({ page }) => {
  const forged = issueBadge(
    { attemptId: "att_forged", challengeTitle: "Field Operations Analyst", company: "Prairie Grid Energy (fictional)", finishedAt: "2026-11-04T17:00:00Z", skills: [{ skill: "collaboration", level: "strong" }] },
    "https://evil.example",
  );
  await page.goto("/verify");
  await page.getByTestId("verify-input").fill(JSON.stringify(forged));
  await page.getByTestId("verify-check").click();
  await expect(page.getByTestId("verify-result")).toHaveAttribute("data-valid", "false");
  await expect(page.getByTestId("verify-result")).toContainText(/not Turning Point/i);
});
