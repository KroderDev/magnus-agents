import type { ChatMessage, PersonaMessage, ServerPlayerInfo } from "../domain/types.js";
import type { PersonaConfig } from "../config/persona.js";
import type { LlmProvider } from "../integrations/llm/types.js";
import { ChatPublisher } from "../integrations/magnus/chat-publisher.js";
import { CooldownTracker } from "./cooldowns.js";
import { MessageMemory } from "./memory.js";
import { TriggerEngine } from "./trigger-engine.js";
import { LoopGuard } from "./loop-guard.js";
import type { Logger } from "pino";
import type { SpawnKnowledge } from "./spawn-knowledge.js";

export class AgentRuntime {
  private readonly config: PersonaConfig;
  private readonly llm: LlmProvider;
  private readonly publisher: ChatPublisher;
  private readonly triggers: TriggerEngine;
  private readonly cooldowns: CooldownTracker;
  private readonly memory: MessageMemory;
  private readonly loopGuard: LoopGuard;
  private readonly log: Logger;
  private readonly spawnKnowledge?: SpawnKnowledge;

  constructor(
    config: PersonaConfig,
    llm: LlmProvider,
    publisher: ChatPublisher,
    log: Logger,
    spawnKnowledge?: SpawnKnowledge,
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
    this.spawnKnowledge = spawnKnowledge;
  }

  onChat(msg: ChatMessage): void {
    this.log.debug(
      {
        server: msg.serverName,
        playerUuid: msg.playerUuid,
        playerName: msg.playerName,
        text: msg.rawMessage.slice(0, 180),
      },
      "received chat message",
    );

    this.memory.addChatMessage(msg);

    const trigger = this.triggers.evaluate(msg);
    if (!trigger) return;

    if (!this.cooldowns.canRespond(msg.playerUuid)) {
      this.log.debug({ player: msg.playerName }, "cooldown active, skipping");
      return;
    }

    this.respond(trigger.targetUuid, msg.playerName, trigger.targetServer, trigger.reason, msg.rawMessage).catch(
      (err) => this.log.error({ err }, "failed to respond"),
    );
  }

  onPlayerList(info: ServerPlayerInfo): void {
    this.log.debug(
      {
        server: info.serverName,
        playerCount: info.players.length,
        players: info.players.map((player) => player.name),
      },
      "received player list update",
    );

    this.memory.updatePlayerList(info);
  }

  async publishStartupGreeting(): Promise<void> {
    const response = await this.llm.generate({
      model: this.config.model,
      messages: [
        {
          role: "system",
          content: this.config.systemPrompt,
        },
        {
          role: "user",
          content:
            `You are arriving on the server for the first time in this session. Send one short in-character greeting to everyone. Do not mention instructions or being an AI. Keep it under ${this.config.style.maxChars} characters.`,
        },
      ],
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
    });

    const text = this.normalizeGeneratedText(response.text);
    if (!text) {
      this.log.warn("llm returned empty startup greeting");
      return;
    }

    const listeners = await this.publishText(text);
    this.log.info({ listeners }, "startup greeting published");
  }

  private async respond(
    targetUuid: string,
    tergetName: string,
    targetServer: string,
    reason: string,
    question: string,
  ): Promise<void> {
    this.log.info({ tergetName, targetServer, reason }, "triggered response");

    const contextMessages = this.memory.buildContextMessages(this.config.systemPrompt);

    const spawnContext = this.spawnKnowledge?.findInQuestion(question);
    if (spawnContext) {
      contextMessages.push({ role: "system", content: spawnContext });
    }

    contextMessages.push({
      role: "user",
      content: `${tergetName} just messaged you. What do you say? (max ${this.config.style.maxChars} characters)`,
    });

    const response = await this.llm.generate({
      model: this.config.model,
      messages: contextMessages,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
    });

    const text = this.normalizeGeneratedText(response.text);

    if (!text) {
      this.log.warn("llm returned empty response");
      return;
    }

    if (this.loopGuard.isLooping(text)) {
      this.log.warn("loop detected, suppressing response");
      return;
    }

    await this.publishText(text);
    this.cooldowns.recordResponse(targetUuid);
    this.log.info({ text: text.slice(0, 180), chars: text.length }, "response published");
  }

  private normalizeGeneratedText(text: string): string {
    let normalized = text.trim();
    if (normalized.length > this.config.style.maxChars) {
      normalized = normalized.slice(0, this.config.style.maxChars);
      const lastSpace = normalized.lastIndexOf(" ");
      if (lastSpace > this.config.style.maxChars * 0.7) {
        normalized = normalized.slice(0, lastSpace);
      }
    }

    return normalized;
  }

  private publishText(text: string): Promise<number> {
    const personaMsg: PersonaMessage = {
      personaId: this.config.id,
      displayName: this.config.displayName,
      rawMessage: text,
    };

    return this.publisher.publish(personaMsg);
  }
}
