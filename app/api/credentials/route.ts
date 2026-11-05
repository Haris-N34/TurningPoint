import { NextResponse } from "next/server";
import { z } from "zod";
import { BadgeFromEvidence, issueBadgeFromEvidence } from "@/lib/integrations/credential";

// Issue an Open Badges 3.0 credential for a finished card (C.9). The candidate asks for it from the results page.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => undefined);
  // Levels are never taken from the browser: it sends the answers, Turning Point scores them (QA night).
  if (body && typeof body === "object" && "skills" in body) return NextResponse.json({ error: "Send the answers (evidence), not levels. Turning Point computes the levels." }, { status: 422 });
  const r = BadgeFromEvidence.safeParse(body);
  if (!r.success) return NextResponse.json({ error: z.prettifyError(r.error) }, { status: 422 });
  const credential = issueBadgeFromEvidence(r.data, new URL(req.url).origin);
  return NextResponse.json(credential, { headers: { "content-disposition": 'attachment; filename="turning-point-credential.json"' } });
}
