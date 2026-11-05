import type { Metadata } from "next";
import { VerifyCredential } from "@/components/site/VerifyCredential";

export const metadata: Metadata = { title: "Verify a credential · Turning Point" };

export default function VerifyPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-6 px-6 py-12 sm:px-10">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">Public</p>
        <h1 className="mt-3 font-display text-4xl leading-tight">Verify a credential</h1>
        <p className="mt-3 text-muted-foreground">
          Check a Turning Point Open Badges 3.0 file. We verify the Ed25519 signature; any change to the file after it was issued makes the check fail.
          Nothing you check is stored.
        </p>
      </header>
      <VerifyCredential />
    </main>
  );
}
