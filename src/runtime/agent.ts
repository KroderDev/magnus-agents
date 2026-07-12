import type { ChatMessage, PersonaMessage, ServerPlayerInfo } from "../domain/types.js";
import type { PersonaConfig } from "../config/persona.js";
import type { LlmProvider } from "../integrations/llm/types.js";
import { ChatPublisher } from "../integrations/magnus/chat-publisher.js";
import { CooldownTracker } from "./cooldowns.js";
import { MessageMemory } from "./memory.js";
import { TriggerEngine } from "./trigger-engine.js";
import { LoopGuard } from "./loop-guard.js";
import type { Logger } from "pino";

export class AgentRuntime {
  private readonly config: PersonaConfig;
  private readonly llm: LlmProvider;
  private readonly publisher: ChatPublisher;
  private readonly triggers: TriggerEngine;
  private readonly cooldowns: CooldownTracker;
  private readonly memory: MessageMemory;
  private readonly loopGuard: LoopGuard;
  private readonly log: Logger;

  constructor(
    config: PersonaConfig,
    llm: LlmProvider,
    publisher: ChatPublisher,
    log: Logger,
  ) {
    this.config = config;
    this.llm = llm;
    this.publisher = publisher;
    this.triggers = new TriggerEngine(config);
    this.cooldowns = new CooldownTracker(
      config.cooldowns.globalSeconds,
      config.cooldowns.playerSeconds,
    );
    this.memory = new MessageMemory(config.memory.recentMessages);
    this.loopGuard = new LoopGuard();
    this.log = log.child({ personaId: config.id });
  }

  onChat(msg: ChatMessage): void {
    this.memory.addChatMessage(msg);

    const trigger = this.triggers.evaluate(msg);
    if (!trigger) return;

    if (!this.cooldowns.canRespond(msg.playerUuid)) {
      this.log.debug({ player: msg.playerName }, "cooldown active, skipping");
      return;
    }

    this.respond(trigger.targetUuid, msg.playerName, trigger.targetServer, trigger.reason).catch(
      (err) => this.log.error({ err }, "failed to respond"),
    );
  }

  onPlayerList(info: ServerPlayerInfo): void {
    this.memory.updatePlayerList(info);
  }

  private async respond(
    targetUuid: string,
    tergetName: string,
    targetServer: string,
    reason: string,
  ): Promise<void> {
    this.log.info({ tergetName, targetServer, reason }, "triggered response");

    const contextMessages = this.memory.buildContextMessages(
      this.config.systemPrompt,
      tergetName,
    );

    contextMessages.push({
      role: "user",
      content: `${tergetName} just messaged you. What do you say?`,
    });

    const model = this.config.model || "default";
    const response = await this.llm.generate({
      model,
      messages: contextMessages,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
    });

    let text = response.text.trim();
    if (text.length > this.config.style.maxChars) {
      text = text.slice(0, this.config.style.maxChars);
      const lastSpace = text.lastIndexOf(" ");
      if (lastSpace > this.config.style.maxChars * 0.7) {
        text = text.slice(0, lastSpace);
      }
    }

    if (!text) {
      this.log.warn("llm returned empty response");
      return;
    }

    if (this.loopGuard.isLooping(text)) {
      this.log.warn("loop detected, suppressing response");
      return;
    }

    const personaMsg: PersonaMessage = {
      personaId: this.config.id,
      displayName: this.config.displayName,
      rawMessage: text,
    };

    await this.publisher.publish(personaMsg);
    this.cooldowns.recordResponse(targetUuid);
    this.log.info({ text: text.slice(0, 80) }, "response published");
  }
}
