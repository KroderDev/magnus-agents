import type { PipelineNode, PipelineNodeResult } from "../types.js";

export class VerifyNode implements PipelineNode {
  readonly id = "verify";

  async run(
    state: Parameters<PipelineNode["run"]>[0],
    services: Parameters<PipelineNode["run"]>[1],
  ): Promise<PipelineNodeResult> {
    if (state.route !== "reply") {
      return { signal: "continue" };
    }

    const normalized = services.normalizeText(state.draftText ?? "", state.persona.style.maxChars);
    if (!normalized) {
      state.route = "ignore";
      state.diagnostics.verificationReason = "empty-response";
      return { signal: "stop", reason: "llm returned empty response" };
    }

    if (services.loopGuard.isLooping(normalized)) {
      state.route = "ignore";
      state.diagnostics.verificationReason = "loop-risk";
      return { signal: "stop", reason: "loop detected" };
    }

    state.finalText = normalized;
    return { signal: "continue" };
  }
}
