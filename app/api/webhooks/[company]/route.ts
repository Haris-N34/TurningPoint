import { NextResponse } from "next/server";
import { receiveWebhook } from "@/lib/integrations/webhooks";

// Inbound ATS webhooks (C.2). Signed with HMAC-SHA256 (x-tp-signature: t=<unix>,v1=<hex>), 5-minute
// window, idempotency via the idempotency-key header. The raw body is verified before parsing.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ company: string }> }) {
  const { company } = await ctx.params;
  const raw = await req.text();
  if (raw.length > 64_000) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  const r = await receiveWebhook(company, raw, req.headers);
  return NextResponse.json(r.body, { status: r.status });
}
