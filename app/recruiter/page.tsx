import { Suspense } from "react";
import { Inbox } from "@/components/recruiter/Inbox";

export default function RecruiterHome() {
  return (
    <Suspense>
      <Inbox />
    </Suspense>
  );
}
