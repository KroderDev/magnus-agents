import type { PipelineNode, PipelineNodeResult } from "../types.js";
import { isActionAllowed } from "../../actions/intent.js";

export class ActionRouteNode implements PipelineNode {
  readonly id = "action-route";

  async run(
    state: Parameters<PipelineNode["run"]>[0],
    services: Parameters<PipelineNode["run"]>[1],
  ): Promise<PipelineNodeResult> {
    if (state.route !== "action") {
      return { signal: "continue" };
    }

    if (!state.actionRequest) {
      state.route = "ignore";
      return { signal: "stop", reason: "missing action request" };
    }

    const action = services.actions.get(state.actionRequest.id);
    if (!action || !isActionAllowed(action, state.persona.actions)) {
      state.route = "ignore";
      return { signal: "stop", reason: `action not allowed: ${state.actionRequest.id}` };
    }

    const result = await services.actions.execute(state.actionRequest.id, state.actionRequest.input, {
      personaId: state.persona.id,
      sourceUuid: state.input.playerUuid,
      sourceName: state.input.playerName,
      sourceServer: state.input.serverName,
    });
    state.actionResult = result;

    services.log.info(
      {
        action: state.actionRequest.id,
        success: result.success,
        reason: state.actionRequest.reason,
        error: result.error,
      },
      "agent action executed",
    );

    state.contextMessages = [
      { role: "system", content: state.persona.systemPrompt },
      {
        role: "system",
        content: [
          "You just used a read-only Magnus server-data tool to answer the player.",
          "Use only the tool result below for factual claims about server state.",
          "If the tool failed or data is unavailable, say you cannot confirm right now.",
          `Keep the reply under ${state.persona.style.maxChars} characters.`,
        ].join("\n"),
      },
      {
        role: "user",
        content: [
          "Current player message:",
          `- Server: ${state.input.serverName}`,
          `- Player: ${state.input.playerName}`,
          `- Message: ${JSON.stringify(state.input.rawMessage)}`,
          "Tool result:",
          JSON.stringify({
            action: state.actionRequest.id,
            input: state.actionRequest.input,
            success: result.success,
            output: result.output,
            error: result.error,
          }),
          "Reply in character with a concise answer.",
        ].join("\n"),
      },
    ];
    state.route = "reply";
    return { signal: "continue" };
  }
}
