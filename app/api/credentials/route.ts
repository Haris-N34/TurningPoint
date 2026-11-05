import { NextResponse } from "next/server";
import { z } from "zod";
import { BadgeRequest, issueBadge } from "@/lib/integrations/credential";

// Issue an Open Badges 3.0 credential for a finished card (C.9). The candidate asks for it from the results page.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => undefined);
  const r = BadgeRequest.safeParse(body);
  if (!r.success) return NextResponse.json({ error: z.prettifyError(r.error) }, { status: 422 });
  const credential = issueBadge(r.data, new URL(req.url).origin);
  return NextResponse.json(credential, { headers: { "content-disposition": 'attachment; filename="turning-point-credential.json"' } });
}
