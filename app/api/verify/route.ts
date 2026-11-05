import { NextResponse } from "next/server";
import { verifyBadge } from "@/lib/integrations/credential";

// Public verification of a Turning Point credential (C.9). Anyone can check a file; nothing is stored.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const text = await req.text();
  if (text.length > 100_000) return NextResponse.json({ valid: false, reason: "File too large" }, { status: 413 });
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return NextResponse.json({ valid: false, reason: "Not valid JSON" });
  }
  return NextResponse.json(verifyBadge(json));
}
