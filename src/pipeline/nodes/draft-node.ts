import type { PipelineNode, PipelineNodeResult } from "../types.js";

export class DraftNode implements PipelineNode {
  readonly id = "draft";

  async run(
    state: Parameters<PipelineNode["run"]>[0],
    services: Parameters<PipelineNode["run"]>[1],
  ): Promise<PipelineNodeResult> {
    if (state.route !== "reply") {
      return { signal: "continue" };
    }

    if (!state.contextMessages) {
      state.route = "ignore";
      return { signal: "stop", reason: "missing response context" };
    }

    const response = await services.llm.generate({
      model: state.persona.model,
      messages: state.contextMessages,
      temperature: state.persona.temperature,
      maxTokens: state.persona.maxTokens,
    });

    state.draftText = response.text;
    return { signal: "continue" };
  }
}
