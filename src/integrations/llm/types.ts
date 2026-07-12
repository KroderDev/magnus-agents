export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmRequest {
  model: string;
  messages: LlmMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface LlmResponse {
  text: string;
}

export interface LlmProvider {
  generate(request: LlmRequest, signal?: AbortSignal): Promise<LlmResponse>;
}
