import type { PipelineNode, PipelineNodeResult } from "../types.js";

export class ActionRouteNode implements PipelineNode {
  readonly id = "action-route";

  async run(
    state: Parameters<PipelineNode["run"]>[0],
    services: Parameters<PipelineNode["run"]>[1],
  ): Promise<PipelineNodeResult> {
    if (state.route !== "action") {
      return { signal: "continue" };
    }

    services.log.warn(
      { message: state.input.rawMessage, toolCandidates: state.toolCandidates?.map((tool) => tool.id) ?? [] },
      "action route selected but action execution is not implemented yet",
    );
    return { signal: "stop", reason: "action route is reserved for future tool execution" };
  }
}
