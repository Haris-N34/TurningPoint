import { Suspense } from "react";
import { VerifyIdentity } from "@/components/candidate/VerifyIdentity";

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyIdentity />
    </Suspense>
  );
}
