import type { PipelineNode, PipelineNodeResult } from "../types.js";

export class GuardNode implements PipelineNode {
  readonly id = "guard";

  async run(
    state: Parameters<PipelineNode["run"]>[0],
    services: Parameters<PipelineNode["run"]>[1],
  ): Promise<PipelineNodeResult> {
    if (!state.trigger) {
      state.route = "ignore";
      return { signal: "stop", reason: "missing trigger state" };
    }

    if (/^\s*[/.!]/.test(state.input.rawMessage)) {
      state.route = "ignore";
      state.diagnostics.decisionReason = "command-like-message";
      return { signal: "stop", reason: "command-like messages are ignored" };
    }

    if (!services.cooldowns.canRespond(state.trigger.targetUuid)) {
      state.route = "ignore";
      state.diagnostics.decisionReason = "cooldown";
      return { signal: "stop", reason: "cooldown active" };
    }

    return { signal: "continue" };
  }
}
