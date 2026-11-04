import { NextResponse } from "next/server";
import { GreenhousePayload } from "@/lib/ats/ats";

// Mock Greenhouse "create candidates" endpoint (E5.1). Validates and echoes; stores nothing.
export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body must be JSON" }, { status: 400 });
  }
  const r = GreenhousePayload.safeParse(json);
  if (!r.success) return NextResponse.json({ ok: false, error: r.error.issues.map((i) => i.message).join("; ") }, { status: 422 });
  return NextResponse.json({ ok: true, received: r.data.candidates.length, job_code: r.data.job_code });
}
