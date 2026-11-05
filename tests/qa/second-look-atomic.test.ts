import { describe, expect, it } from "vitest";
import { handleMockAts } from "@/lib/integrations/ats/mockServer";
import { decideSecondLook, markOpened, rescuedCount } from "@/lib/integrations/secondLook";
import { createCompany } from "@/lib/integrations/store";

// QA night: Second Look marked an entry "restored" before telling the ATS. If the ATS call failed, the entry
// read as rescued (and counted on the impact dashboard) while the applicant stayed rejected in the ATS, and a
// retry was refused with "Already decided".
describe("QA: a failed ATS call leaves the Second Look entry queued", () => {
  it("restore fails cleanly and can be retried", async () => {
    const c = createCompany();
    await handleMockAts("greenhouse", c.id, "PATCH", ["v1", "applications", "gh_app_maya"], new URLSearchParams(), { status: "rejected" });
    const e = c.secondLook[0];
    markOpened(c.id, e.id);
    const saved = c.ats.greenhouse.applicants;
    c.ats.greenhouse.applicants = saved.filter((a) => a.id !== "gh_app_maya"); // the ATS loses the record
    await expect(decideSecondLook(c.id, e.id, "restore", "Strong evidence")).rejects.toThrow();
    expect(c.secondLook[0].status).toBe("queued");
    expect(rescuedCount(c.secondLook)).toBe(0);
    c.ats.greenhouse.applicants = saved;
    await decideSecondLook(c.id, e.id, "restore", "Strong evidence");
    expect(c.secondLook[0].status).toBe("restored");
    expect(c.ats.greenhouse.applicants.find((a) => a.id === "gh_app_maya")?.status).toBe("active");
  });
});
