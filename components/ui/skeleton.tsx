import { cn } from "@/lib/utils";

/** One placeholder block. Pulses unless the user prefers reduced motion (global CSS rule). */
export function Skeleton({ className }: { className?: string }) {
  return <div data-skeleton-block aria-hidden className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

/** Page-level loading state: a heading, a line and a few cards in the shape of the page to come. */
export function PageSkeleton({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" aria-busy="true" className="mx-auto max-w-5xl space-y-5 px-5 py-10 sm:px-10">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-10 w-2/3 max-w-md" />
      <Skeleton className="h-4 w-1/2 max-w-sm" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
    </div>
  );
}
