import { NextResponse } from "next/server";
import { handleMockAts } from "@/lib/integrations/ats/mockServer";
import { PROVIDERS, type Provider } from "@/lib/integrations/store";

// Mock ATS over HTTP (C.1): Harvest-shaped Greenhouse and Workday-shaped APIs. Mocks only.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ provider: string; company: string; path: string[] }> };

async function handle(req: Request, ctx: Ctx) {
  const { provider, company, path } = await ctx.params;
  if (!PROVIDERS.includes(provider as Provider)) return NextResponse.json({ message: "Unknown provider" }, { status: 404 });
  let body: unknown;
  if (req.method !== "GET") body = await req.json().catch(() => undefined);
  const r = await handleMockAts(provider as Provider, company, req.method, path, new URL(req.url).searchParams, body);
  return NextResponse.json(r.json, { status: r.status, headers: { "x-mock-ats": provider } });
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
