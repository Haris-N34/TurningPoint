import { Suspense } from "react";
import { RecruiterCard } from "@/components/recruiter/RecruiterCard";

export default async function RecruiterCardPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  return (
    <Suspense>
      <RecruiterCard attemptId={attemptId} />
    </Suspense>
  );
}
