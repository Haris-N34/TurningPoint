import { NextResponse } from "next/server";
import { handlePublicApi } from "@/lib/integrations/api";

// Public REST API (C.4). Bearer API key per company, token-bucket rate limit, OpenAPI at /api/v1/openapi.json.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const url = new URL(req.url);
  const r = handlePublicApi(req.method, path, url.searchParams, req.headers.get("authorization"), url.origin);
  return NextResponse.json(r.json, { status: r.status, headers: r.headers });
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
