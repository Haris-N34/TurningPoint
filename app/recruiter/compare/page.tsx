import { Suspense } from "react";
import { Compare } from "@/components/recruiter/Compare";
export const metadata = { title: "Compare capability | Turning Point" };
export default function ComparePage() { return <Suspense fallback={<p className="p-8">Loading comparison…</p>}><Compare/></Suspense>; }
