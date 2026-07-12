import type { PipelineNode, PipelineNodeResult } from "../types.js";

export class ToolPlanningNode implements PipelineNode {
  readonly id = "tool-planning";

  async run(
    state: Parameters<PipelineNode["run"]>[0],
    services: Parameters<PipelineNode["run"]>[1],
  ): Promise<PipelineNodeResult> {
    if (!state.persona.actions.enabled) {
      state.toolCandidates = [];
      return { signal: "continue" };
    }

    state.toolCandidates = services.actions.list();
    return { signal: "continue" };
  }
}
