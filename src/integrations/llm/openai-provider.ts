import OpenAI from "openai";
import type { LlmProvider, LlmRequest, LlmResponse } from "./types.js";

export interface OpenAIProviderConfig {
  baseURL: string;
  apiKey: string;
  defaultModel: string;
  timeoutMs: number;
}

export class OpenAICompatibleProvider implements LlmProvider {
  private readonly client: OpenAI;
  private readonly defaultModel: string;
  private readonly timeoutMs: number;

  constructor(config: OpenAIProviderConfig) {
    this.client = new OpenAI({
      baseURL: config.baseURL,
      apiKey: config.apiKey,
      timeout: config.timeoutMs,
      maxRetries: 1,
    });
    this.defaultModel = config.defaultModel;
    this.timeoutMs = config.timeoutMs;
  }

  async generate(request: LlmRequest, signal?: AbortSignal): Promise<LlmResponse> {
    const completion = await this.client.chat.completions.create(
      {
        model: request.model || this.defaultModel,
        messages: request.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        temperature: request.temperature,
        max_tokens: request.maxTokens,
      },
      {
        signal,
        timeout: this.timeoutMs,
      },
    );

    const text = completion.choices[0]?.message?.content ?? "";
    return { text };
  }
}
