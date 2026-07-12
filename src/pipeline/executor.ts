import type { ChatPipelineServices, ChatPipelineState, PipelineNode } from "./types.js";

export class PipelineExecutor {
  constructor(private readonly nodes: PipelineNode[]) {}

  async run(state: ChatPipelineState, services: ChatPipelineServices): Promise<ChatPipelineState> {
    for (const node of this.nodes) {
      const result = await node.run(state, services);
      if (result.signal === "stop") {
        state.stopReason = result.reason ?? state.stopReason ?? `stopped at ${node.id}`;
        return state;
      }
    }

    return state;
  }
}
