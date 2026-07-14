import type { PipelineNode, PipelineNodeResult } from "../types.js";

export class ContextNode implements PipelineNode {
  readonly id = "context";

  async run(
    state: Parameters<PipelineNode["run"]>[0],
    services: Parameters<PipelineNode["run"]>[1],
  ): Promise<PipelineNodeResult> {
    if (state.route !== "reply") {
      return { signal: "continue" };
    }

    state.contextMessages = services.memory.buildResponseContext(
      state.persona.systemPrompt,
      state.input,
      state.trigger?.reason ?? "reply",
      state.persona.style.maxChars,
    );

    const knowledgeContext = services.knowledge?.findRelevant(state.input.rawMessage);
    if (knowledgeContext) {
      state.contextMessages.splice(-1, 0, { role: "system", content: knowledgeContext });
    }

    return { signal: "continue" };
  }
}
