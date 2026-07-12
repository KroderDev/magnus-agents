import type { PipelineNode, PipelineNodeResult } from "../types.js";

export class QuestionRelevanceNode implements PipelineNode {
  readonly id = "question-relevance";

  async run(
    state: Parameters<PipelineNode["run"]>[0],
    services: Parameters<PipelineNode["run"]>[1],
  ): Promise<PipelineNodeResult> {
    if (state.trigger?.reason !== "question-candidate") {
      return { signal: "continue" };
    }

    const response = await services.llm.generate({
      model: state.persona.model,
      messages: [
        {
          role: "system",
          content: state.persona.systemPrompt,
        },
        {
          role: "system",
          content: [
            "Decide if the player message is a good fit for this persona to answer in a Minecraft/Cobblemon server.",
            'Reply with exactly one token: "relevant" or "not-relevant".',
            "Mark relevant when the question matches this persona's in-character role, game knowledge, social guidance, or natural server banter.",
            "Mark not-relevant when it is unrelated, private, administrative, or outside what this persona should reasonably answer.",
          ].join("\n"),
        },
        {
          role: "user",
          content: [
            "Question relevance check:",
            `- Server: ${state.input.serverName}`,
            `- Player: ${state.input.playerName}`,
            `- Message: ${JSON.stringify(state.input.rawMessage)}`,
          ].join("\n"),
        },
      ],
      temperature: 0,
      maxTokens: 8,
    });

    const verdict = response.text.trim().toLowerCase();
    if (verdict.startsWith("relevant")) {
      state.trigger.reason = "question";
      state.diagnostics.decisionReason = "question-relevant";
      return { signal: "continue" };
    }

    state.route = "ignore";
    state.diagnostics.decisionReason = "question-not-relevant";
    return { signal: "stop", reason: "question did not fit persona relevance rules" };
  }
}
