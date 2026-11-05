import { Suspense } from "react";
import { Compare } from "@/components/recruiter/Compare";

export const metadata = { title: "Compare | Turning Point" };
export default function ComparePage() {
  return (
    <Suspense>
      <Compare />
    </Suspense>
  );
}
