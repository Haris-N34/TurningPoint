import { NextResponse } from "next/server";
import { handleIntegrations } from "@/lib/integrations/console";

// Integration console and app endpoints (C.3, C.10, C.11). Demo build: no auth, in-process store.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const url = new URL(req.url);
  const body = req.method === "GET" ? undefined : await req.json().catch(() => undefined);
  const r = await handleIntegrations(req.method, path, url.searchParams, body, url.origin);
  return NextResponse.json(r.json, { status: r.status });
}

export const GET = handle;
export const POST = handle;
