import type { CacheTable } from "../providers/cached";
import recorded from "./recorded.json";

// Recorded outputs replayed in AI_MODE=cached (B9). Regenerate with `pnpm ai:record`
// (records every prompt fixture with the current provider: live when AI_MODE=live and a key is set).
export const CACHE: CacheTable = recorded as CacheTable;
