import type { KV, Store } from "@/lib/store/store";
import { seedDemo, DEMO_EMPLOYERS } from "./seed";

// P.2: one-step demo reset. Clears every `tp:` key and all local recordings, then reloads the seed.

export const DEMO_ATTEMPT = "att_demo_maya";

/** Screens the demo panel jumps to. */
export const DEMO_JUMPS = [
  { label: "Game", href: "/game/launch-week" },
  { label: "Results", href: `/results/${DEMO_ATTEMPT}` },
  { label: "Recruiter card", href: `/recruiter/card/${DEMO_ATTEMPT}?challenge=${DEMO_EMPLOYERS[0].id}` },
  { label: "Admin impact", href: "/admin/impact" },
] as const;

/** Remove every key this app owns (prefix `tp:`). Returns how many were removed. */
export function clearDemoKeys(kv: KV): number {
  const ks: string[] = [];
  for (let i = 0; i < kv.length; i++) {
    const k = kv.key(i);
    if (k?.startsWith("tp:")) ks.push(k);
  }
  for (const k of ks) kv.removeItem(k);
  return ks.length;
}

export async function resetDemo(s: Store, kv: KV, media: { clear: () => Promise<void> }) {
  clearDemoKeys(kv);
  try {
    await media.clear();
  } catch {
    // No IndexedDB (private window): no recordings to clear.
  }
  return seedDemo(s);
}
