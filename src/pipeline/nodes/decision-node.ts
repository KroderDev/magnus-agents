import type { PipelineNode, PipelineNodeResult } from "../types.js";
import { detectActionRequest } from "../../actions/intent.js";

export class DecisionNode implements PipelineNode {
  readonly id = "decision";

  async run(
    state: Parameters<PipelineNode["run"]>[0],
    services: Parameters<PipelineNode["run"]>[1],
  ): Promise<PipelineNodeResult> {
    const actionRequest = detectActionRequest(
      state.input.rawMessage,
      state.input.serverName,
      services.actions,
      state.persona.actions,
    );
    if (actionRequest) {
      state.route = "action";
      state.actionRequest = actionRequest;
      state.diagnostics.routeReason = actionRequest.reason;
      return { signal: "continue" };
    }

    state.route = "reply";
    state.diagnostics.routeReason = state.trigger?.reason ?? "reply";
    return { signal: "continue" };
  }
}
