import type { PipelineNode, PipelineNodeResult } from "../types.js";

export class DecisionNode implements PipelineNode {
  readonly id = "decision";

  async run(
    state: Parameters<PipelineNode["run"]>[0],
    services: Parameters<PipelineNode["run"]>[1],
  ): Promise<PipelineNodeResult> {
    const requestedAction = /\b(tool|action):/i.test(state.input.rawMessage);
    if (requestedAction && state.persona.actions.enabled && services.actions.count > 0) {
      state.route = "action";
      state.diagnostics.routeReason = "explicit-action-request";
      return { signal: "continue" };
    }

    state.route = "reply";
    state.diagnostics.routeReason = state.trigger?.reason ?? "reply";
    return { signal: "continue" };
  }
}
