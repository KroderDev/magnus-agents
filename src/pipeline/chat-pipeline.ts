import type { PersonaConfig } from "../config/persona.js";
import type { ChatMessage } from "../domain/types.js";
import type { ChatPipelineServices, ChatPipelineState } from "./types.js";
import { PipelineExecutor } from "./executor.js";
import { TriggerNode } from "./nodes/trigger-node.js";
import { GuardNode } from "./nodes/guard-node.js";
import { QuestionRelevanceNode } from "./nodes/question-relevance-node.js";
import { DecisionNode } from "./nodes/decision-node.js";
import { ContextNode } from "./nodes/context-node.js";
import { ToolPlanningNode } from "./nodes/tool-planning-node.js";
import { ActionRouteNode } from "./nodes/action-route-node.js";
import { DraftNode } from "./nodes/draft-node.js";
import { VerifyNode } from "./nodes/verify-node.js";
import { PublishNode } from "./nodes/publish-node.js";
import { TriggerEngine } from "../runtime/trigger-engine.js";

export class ChatPipeline {
  private readonly executor: PipelineExecutor;

  constructor(private readonly persona: PersonaConfig, private readonly services: ChatPipelineServices) {
    this.executor = new PipelineExecutor([
      new TriggerNode(new TriggerEngine(persona)),
      new GuardNode(),
      new QuestionRelevanceNode(),
      new DecisionNode(),
      new ContextNode(),
      new ToolPlanningNode(),
      new ActionRouteNode(),
      new DraftNode(),
      new VerifyNode(),
      new PublishNode(),
    ]);
  }

  run(input: ChatMessage): Promise<ChatPipelineState> {
    return this.executor.run(
      {
        persona: this.persona,
        input,
        route: "ignore",
        diagnostics: {},
      },
      this.services,
    );
  }
}
