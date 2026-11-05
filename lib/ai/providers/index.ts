import { CACHE } from "../cache";
import { CachedProvider } from "./cached";
import { ClaudeProvider } from "./claude";
import { LocalProvider } from "./local";
import type { AiMode, Provider } from "./types";

export { CachedProvider } from "./cached";
export { ClaudeProvider } from "./claude";
export { LocalProvider } from "./local";
export * from "./types";

type Env = Record<string, string | undefined>;

// `process.env.X` is read literally so Next can inline NEXT_PUBLIC_AI_MODE into the browser bundle.
const defaultEnv = (): Env => ({
  AI_MODE: process.env.AI_MODE,
  NEXT_PUBLIC_AI_MODE: process.env.NEXT_PUBLIC_AI_MODE,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
});

/** Kill switch (PRD v2 B1): AI_MODE=live|cached|off. Default off: no network, deterministic rules. */
export function aiMode(env: Env = defaultEnv()): AiMode {
  const m = (env.AI_MODE ?? env.NEXT_PUBLIC_AI_MODE ?? "off").trim().toLowerCase();
  return m === "live" || m === "cached" ? m : "off";
}

/**
 * The provider for this process. Live needs a server and a key; without either it degrades to cached,
 * so a missing key can never break the demo. The browser never sees the key.
 */
export function resolveProvider(env: Env = defaultEnv(), isServer = typeof window === "undefined"): Provider {
  const mode = aiMode(env);
  if (mode === "live" && isServer && env.ANTHROPIC_API_KEY) return new ClaudeProvider(env.ANTHROPIC_API_KEY);
  if (mode === "live" || mode === "cached") return new CachedProvider(CACHE);
  return new LocalProvider();
}

let current: Provider | undefined;
export function provider(): Provider {
  return (current ??= resolveProvider());
}
/** Tests swap the provider; pass undefined to go back to the environment's. */
export function setProvider(p: Provider | undefined) {
  current = p;
}
