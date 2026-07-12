import type { PipelineNode, PipelineNodeResult } from "../types.js";

export class PublishNode implements PipelineNode {
  readonly id = "publish";

  async run(
    state: Parameters<PipelineNode["run"]>[0],
    services: Parameters<PipelineNode["run"]>[1],
  ): Promise<PipelineNodeResult> {
    if (state.route !== "reply") {
      return { signal: "stop", reason: state.stopReason ?? `route ${state.route} does not publish chat` };
    }

    if (!state.finalText || !state.trigger) {
      state.route = "ignore";
      return { signal: "stop", reason: "missing final text or trigger state" };
    }

    state.publishListeners = await services.publisher.publish({
      personaId: state.persona.id,
      displayName: state.persona.displayName,
      rawMessage: state.finalText,
    });
    services.memory.addAssistantMessage(state.trigger.targetServer, state.finalText);
    services.cooldowns.recordResponse(state.trigger.targetUuid);

    return { signal: "continue" };
  }
}
