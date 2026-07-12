import { TriggerEngine } from "../../runtime/trigger-engine.js";
import type { PipelineNode, PipelineNodeResult } from "../types.js";

export class TriggerNode implements PipelineNode {
  readonly id = "trigger";

  constructor(private readonly triggers: TriggerEngine) {}

  async run(state: Parameters<PipelineNode["run"]>[0]): Promise<PipelineNodeResult> {
    const trigger = this.triggers.evaluate(state.input);
    if (!trigger) {
      state.route = "ignore";
      state.diagnostics.triggerReason = "no-trigger";
      return { signal: "stop", reason: "message did not match trigger rules" };
    }

    state.trigger = trigger;
    state.diagnostics.triggerReason = trigger.reason;
    return { signal: "continue" };
  }
}
