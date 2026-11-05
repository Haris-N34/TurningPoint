import Link from "next/link";
import { Button } from "@/components/ui/button";

/** One back link style for every sub-page: quiet, aligned with the content edge. */
export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Button asChild variant="ghost" size="sm" className="-ml-3.5">
      <Link href={href}>
        <span aria-hidden>←</span> {children}
      </Link>
    </Button>
  );
}
