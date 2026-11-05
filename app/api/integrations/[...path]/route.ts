import { NextResponse } from "next/server";
import { handleIntegrations } from "@/lib/integrations/console";

// Integration console and app endpoints (C.3, C.10, C.11). In-process store. With TP_CONSOLE_SECRET set, console
// routes need it in the x-tp-console-secret header (docs/DEPLOY.md); candidate routes stay open.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const url = new URL(req.url);
  const body = req.method === "GET" ? undefined : await req.json().catch(() => undefined);
  const r = await handleIntegrations(req.method, path, url.searchParams, body, url.origin, req.headers.get("x-tp-console-secret"));
  return NextResponse.json(r.json, { status: r.status });
}

export const GET = handle;
export const POST = handle;
