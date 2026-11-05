import type { Profile } from "./store";

type Flag = "screenReader" | "reducedMotion" | "lowBandwidth";

/** Toggle one accommodation. Low bandwidth also moves a video default to voice (A4). */
export function withAccommodation(p: Profile, key: Flag, on: boolean): Profile {
  const next = { ...p, accommodations: { ...p.accommodations, [key]: on } };
  if (key === "lowBandwidth" && on && p.defaultMode === "video") next.defaultMode = "voice";
  return next;
}
