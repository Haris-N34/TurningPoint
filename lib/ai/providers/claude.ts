import type { PromptDef } from "../prompts/types";
import { costOf, MODELS, type GenerateResult, type Provider } from "./types";

// Live provider: Claude through the official Anthropic SDK. Used only when AI_MODE=live and
// ANTHROPIC_API_KEY is set on the server; the key is read from the environment, never from code.
// Current models reject sampling parameters, so "temperature 0" for the Evidence Scanner is met by
// recording outputs once and replaying them (AI_MODE=cached), not by a request parameter.

type Usage = { input_tokens: number; output_tokens: number };
type ParseResponse = { parsed_output: unknown; stop_reason: string | null; usage: Usage; model?: string };
/** The slice of the SDK client this provider uses, so tests can pass a fake. */
export type MessagesClient = { messages: { parse(req: Record<string, unknown>): Promise<ParseResponse> } };

export class ClaudeProvider implements Provider {
  readonly name = "claude" as const;
  constructor(
    private apiKey: string,
    private client?: MessagesClient,
  ) {}

  private async sdk(): Promise<MessagesClient> {
    if (this.client) return this.client;
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    this.client = new Anthropic({ apiKey: this.apiKey }) as unknown as MessagesClient;
    return this.client;
  }

  async generate<I, O>(p: PromptDef<I, O>, input: I): Promise<GenerateResult> {
    const client = await this.sdk();
    const { zodOutputFormat } = await import("@anthropic-ai/sdk/helpers/zod");
    const model = MODELS[p.tier];
    const res = await client.messages.parse({
      model,
      max_tokens: 16000,
      system: p.system,
      messages: [{ role: "user", content: p.render(input) }],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      output_config: { format: zodOutputFormat(p.schema as any) },
    });
    if (res.stop_reason === "refusal") throw new Error("Model declined the request");
    if (res.stop_reason === "max_tokens") throw new Error("Output was cut off");
    return { output: res.parsed_output, model, costUsd: costOf(model, res.usage.input_tokens, res.usage.output_tokens) };
  }
}
