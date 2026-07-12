import type { ChatMessage, PersonaMessage, ServerPlayerInfo } from "../domain/types.js";
import type { PersonaConfig } from "../config/persona.js";
import type { LlmProvider } from "../integrations/llm/types.js";
import { ChatPublisher } from "../integrations/magnus/chat-publisher.js";
import { CooldownTracker } from "./cooldowns.js";
import { MessageMemory } from "./memory.js";
import { LoopGuard } from "./loop-guard.js";
import type { Logger } from "pino";
import type { ActionRegistry } from "../actions/registry.js";
import { ChatPipeline } from "../pipeline/chat-pipeline.js";

export class AgentRuntime {
  private readonly config: PersonaConfig;
  private readonly llm: LlmProvider;
  private readonly publisher: ChatPublisher;
  private readonly cooldowns: CooldownTracker;
  private readonly memory: MessageMemory;
  private readonly loopGuard: LoopGuard;
  private readonly log: Logger;
  private readonly pipeline: ChatPipeline;

  constructor(
    config: PersonaConfig,
    llm: LlmProvider,
    publisher: ChatPublisher,
    actions: ActionRegistry,
    log: Logger,
  ) {
    this.config = config;
    this.llm = llm;
    this.publisher = publisher;
    this.cooldowns = new CooldownTracker(
      config.cooldowns.globalSeconds,
      config.cooldowns.playerSeconds,
    );
    this.memory = new MessageMemory(config.memory.recentMessages);
    this.loopGuard = new LoopGuard();
    this.log = log.child({ personaId: config.id });
    this.pipeline = new ChatPipeline(config, {
      log: this.log.child({ component: "chat-pipeline" }),
      llm,
      publisher,
      memory: this.memory,
      cooldowns: this.cooldowns,
      loopGuard: this.loopGuard,
      actions,
      normalizeText: (text, maxChars) => this.normalizeGeneratedText(text, maxChars),
    });
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

    this.pipeline.run(msg).then((state) => {
      this.log.debug(
        {
          route: state.route,
          stopReason: state.stopReason,
          diagnostics: state.diagnostics,
          published: state.publishListeners ?? 0,
        },
        "chat pipeline finished",
      );
    }).catch((err) => this.log.error({ err }, "failed to run chat pipeline"));
    this.memory.addChatMessage(msg);
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
    this.memory.addAssistantMessage("startup", text);
    this.log.info({ listeners }, "startup greeting published");
  }

  private normalizeGeneratedText(text: string, maxChars: number = this.config.style.maxChars): string {
    let normalized = text.trim();
    if (normalized.length > maxChars) {
      normalized = normalized.slice(0, maxChars);
      const lastSpace = normalized.lastIndexOf(" ");
      if (lastSpace > maxChars * 0.7) {
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
