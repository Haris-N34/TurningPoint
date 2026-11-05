import type { WitnessRecord } from "@/lib/witness/witness";

export const RELATIONSHIP_LABELS: Record<WitnessRecord["relationship"], string> = {
  supervisor: "Supervisor",
  peer: "Peer",
  community_partner: "Community partner",
  instructor: "Instructor",
  other: "Other",
};

/** Status in words (never colour only). A pending link past its date reads as expired. */
export function witnessStatus(w: Pick<WitnessRecord, "status" | "expiresAt">, now = new Date()): string {
  if (w.status === "confirmed") return "Confirmed";
  if (w.status === "declined") return "Could not confirm";
  if (w.status === "expired" || Date.parse(w.expiresAt) < now.getTime()) return "Link expired";
  return "Waiting for reply";
}
