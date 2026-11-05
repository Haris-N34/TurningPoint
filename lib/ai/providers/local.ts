import type { PromptDef } from "../prompts/types";
import { LOCAL_MODEL, type GenerateResult, type Provider } from "./types";

/** Runs each prompt's deterministic implementation. No network, no key, same input gives the same output. */
export class LocalProvider implements Provider {
  readonly name = "local" as const;
  generateSync<I, O>(p: PromptDef<I, O>, input: I): GenerateResult {
    return { output: p.local(input), model: LOCAL_MODEL, costUsd: 0 };
  }
  async generate<I, O>(p: PromptDef<I, O>, input: I) {
    return this.generateSync(p, input);
  }
}
