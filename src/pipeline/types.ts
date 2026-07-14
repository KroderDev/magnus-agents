import type { Logger } from "pino";
import type { PersonaConfig } from "../config/persona.js";
import type { ChatMessage } from "../domain/types.js";
import type { LlmMessage, LlmProvider } from "../integrations/llm/types.js";
import type { ChatPublisher } from "../integrations/magnus/chat-publisher.js";
import type { TriggerResult } from "../runtime/trigger-engine.js";
import type { MessageMemory } from "../runtime/memory.js";
import type { CooldownTracker } from "../runtime/cooldowns.js";
import type { LoopGuard } from "../runtime/loop-guard.js";
import type { ActionRegistry } from "../actions/registry.js";
import type { ActionRequest, ActionResult, AgentAction } from "../actions/types.js";
import type { KnowledgeBase } from "../runtime/knowledge-base.js";

export type AgentRoute = "ignore" | "reply" | "action";
export type PipelineSignal = "continue" | "stop";

export interface PipelineNodeResult {
  signal: PipelineSignal;
  reason?: string;
}

export interface ChatPipelineState {
  persona: PersonaConfig;
  input: ChatMessage;
  route: AgentRoute;
  trigger?: TriggerResult;
  contextMessages?: LlmMessage[];
  toolCandidates?: AgentAction[];
  actionRequest?: ActionRequest;
  actionResult?: ActionResult;
  draftText?: string;
  finalText?: string;
  publishListeners?: number;
  stopReason?: string;
  diagnostics: {
    triggerReason?: string;
    decisionReason?: string;
    routeReason?: string;
    verificationReason?: string;
  };
}

export interface ChatPipelineServices {
  log: Logger;
  llm: LlmProvider;
  publisher: ChatPublisher;
  memory: MessageMemory;
  cooldowns: CooldownTracker;
  loopGuard: LoopGuard;
  actions: ActionRegistry;
  knowledge?: KnowledgeBase;
  normalizeText(text: string, maxChars: number): string;
}

export interface PipelineNode {
  readonly id: string;
  run(state: ChatPipelineState, services: ChatPipelineServices): Promise<PipelineNodeResult>;
}
