import { describe, expect, it } from "vitest";
import { signWebhook } from "@/lib/integrations/crypto";
import { createCompany } from "@/lib/integrations/store";
import { receiveWebhook } from "@/lib/integrations/webhooks";

// QA night: the integration console's webhook log printed the raw payload: the applicant's full email
// and the whole resume text. Emails are masked everywhere else ("for logs and the console").
describe("QA: webhook log holds no raw applicant contact or resume", () => {
  it("masks the email and drops the resume text from the logged payload", async () => {
    const c = createCompany();
    const body = JSON.stringify({
      id: "evt_1",
      type: "application.created",
      provider: "greenhouse",
      created_at: "2026-11-05T08:00:00Z",
      data: { application_id: "app_1", job_id: "job_x", candidate: { name: "Jordan Rivera", email: "jordan.rivera@example.com" }, resume_text: "Jordan Rivera\n123 Main Street\nLed a team of 12" },
    });
    const headers = new Headers({ "x-tp-signature": signWebhook(c.webhookSecret, body) });
    const r = await receiveWebhook(c.id, body, headers);
    expect(r.status).toBe(200);
    const logged = JSON.stringify(c.events[0].payload);
    expect(logged).not.toContain("jordan.rivera@example.com");
    expect(logged).not.toContain("123 Main Street");
    expect(logged).toContain("j***@example.com");
  });

  it("also for rejected (bad signature) deliveries", async () => {
    const c = createCompany();
    const body = JSON.stringify({ id: "evt_2", type: "application.created", provider: "greenhouse", created_at: "x", data: { application_id: "a", job_id: "j", candidate: { name: "N", email: "n.person@example.com" } } });
    await receiveWebhook(c.id, body, new Headers({ "x-tp-signature": signWebhook("wrong", body) }));
    expect(JSON.stringify(c.events[0].payload)).not.toContain("n.person@example.com");
  });
});
