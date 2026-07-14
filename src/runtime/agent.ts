import type { ChatMessage, PersonaMessage, ServerPlayerInfo, ServerStateInfo } from "../domain/types.js";
import type { PersonaConfig } from "../config/persona.js";
import type { LlmProvider } from "../integrations/llm/types.js";
import { ChatPublisher } from "../integrations/magnus/chat-publisher.js";
import { CooldownTracker } from "./cooldowns.js";
import { MessageMemory } from "./memory.js";
import { LoopGuard } from "./loop-guard.js";
import { ServerStateMemory } from "./server-state-memory.js";
import type { Logger } from "pino";
import type { ActionRegistry } from "../actions/registry.js";
import { registerBuiltinActions } from "../actions/builtin.js";
import { ChatPipeline } from "../pipeline/chat-pipeline.js";

interface ProactiveTrigger {
  reason: "join-burst" | "server-became-active";
  serverName: string;
  joinedPlayers: string[];
  previousCount: number;
  currentCount: number;
}

export class AgentRuntime {
  private readonly config: PersonaConfig;
  private readonly llm: LlmProvider;
  private readonly publisher: ChatPublisher;
  private readonly cooldowns: CooldownTracker;
  private readonly memory: MessageMemory;
  private readonly serverStateMemory: ServerStateMemory;
  private readonly loopGuard: LoopGuard;
  private readonly log: Logger;
  private readonly pipeline: ChatPipeline;
  private readonly lastPlayerList = new Map<string, ServerPlayerInfo>();
  private readonly joinTimestamps = new Map<string, number[]>();
  private readonly proactiveTriggerCooldowns = new Map<string, number>();

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
    this.serverStateMemory = new ServerStateMemory();
    this.loopGuard = new LoopGuard();
    this.log = log.child({ personaId: config.id });
    if (config.actions.enabled) {
      registerBuiltinActions(actions, this.memory, this.serverStateMemory);
    }
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

  onServerState(info: ServerStateInfo): void {
    this.serverStateMemory.update(info);
    this.log.debug(
      {
        server: info.serverName,
        playerCount: info.playerCount,
        maxPlayers: info.maxPlayers,
        worlds: info.worlds.map((world) => ({ dimension: world.dimension, phase: world.phase })),
      },
      "received server state update",
    );
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
    const proactiveTrigger = this.evaluateProactiveTrigger(info);

    this.log.debug(
      {
        server: info.serverName,
        playerCount: info.players.length,
        players: info.players.map((player) => player.name),
      },
      "received player list update",
    );

    this.memory.updatePlayerList(info);
    this.lastPlayerList.set(info.serverName, info);

    if (!proactiveTrigger) {
      return;
    }

    this.publishProactiveTrigger(proactiveTrigger).catch((err) => {
      this.log.error({ err, trigger: proactiveTrigger }, "failed to publish proactive trigger message");
    });
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

  private evaluateProactiveTrigger(info: ServerPlayerInfo): ProactiveTrigger | null {
    const previous = this.lastPlayerList.get(info.serverName);
    const previousPlayers = new Set(previous?.players.map((player) => player.name) ?? []);
    const joinedPlayers = info.players
      .map((player) => player.name)
      .filter((playerName) => !previousPlayers.has(playerName));

    if (joinedPlayers.length === 0) {
      const existingTimestamps = this.joinTimestamps.get(info.serverName) ?? [];
      const windowMs = this.config.triggers.joinBurst.windowSeconds * 1000;
      this.joinTimestamps.set(
        info.serverName,
        existingTimestamps.filter((timestamp) => info.timestamp - timestamp <= windowMs),
      );
      return null;
    }

    const previousCount = previous?.players.length ?? 0;
    const currentCount = info.players.length;

    if (
      this.config.triggers.serverBecomesActive.enabled
      && previousCount === 0
      && currentCount >= this.config.triggers.serverBecomesActive.minPlayers
      && this.canFireProactiveTrigger(
        `server-became-active:${info.serverName}`,
        this.config.triggers.serverBecomesActive.cooldownSeconds,
        info.timestamp,
      )
    ) {
      this.recordProactiveTrigger(`server-became-active:${info.serverName}`, info.timestamp);
      return {
        reason: "server-became-active",
        serverName: info.serverName,
        joinedPlayers,
        previousCount,
        currentCount,
      };
    }

    if (!this.config.triggers.joinBurst.enabled) {
      return null;
    }

    const windowMs = this.config.triggers.joinBurst.windowSeconds * 1000;
    const timestamps = this.joinTimestamps.get(info.serverName) ?? [];
    const nextTimestamps = timestamps
      .concat(joinedPlayers.map(() => info.timestamp))
      .filter((timestamp) => info.timestamp - timestamp <= windowMs);
    this.joinTimestamps.set(info.serverName, nextTimestamps);

    if (
      nextTimestamps.length < this.config.triggers.joinBurst.minJoins
      || !this.canFireProactiveTrigger(
        `join-burst:${info.serverName}`,
        this.config.triggers.joinBurst.cooldownSeconds,
        info.timestamp,
      )
    ) {
      return null;
    }

    this.recordProactiveTrigger(`join-burst:${info.serverName}`, info.timestamp);
    return {
      reason: "join-burst",
      serverName: info.serverName,
      joinedPlayers,
      previousCount,
      currentCount,
    };
  }

  private canFireProactiveTrigger(key: string, cooldownSeconds: number, now: number): boolean {
    const lastTrigger = this.proactiveTriggerCooldowns.get(key);
    if (lastTrigger === undefined) {
      return true;
    }

    return now - lastTrigger >= cooldownSeconds * 1000;
  }

  private recordProactiveTrigger(key: string, now: number): void {
    this.proactiveTriggerCooldowns.set(key, now);
  }

  private async publishProactiveTrigger(trigger: ProactiveTrigger): Promise<void> {
    const cooldownKey = `server-trigger:${trigger.reason}:${trigger.serverName}`;
    if (!this.cooldowns.canRespond(cooldownKey)) {
      this.log.debug({ trigger }, "skipping proactive trigger because global cooldown is active");
      return;
    }

    const playersByServer = this.memory.getPlayersByServer();
    const serverPlayers = playersByServer.get(trigger.serverName) ?? [];
    const totalPlayers = this.memory.getTotalPlayers();
    const response = await this.llm.generate({
      model: this.config.model,
      messages: [
        {
          role: "system",
          content: this.config.systemPrompt,
        },
        {
          role: "system",
          content: [
            "Write one short in-character chat line to the whole server.",
            `Keep it under ${this.config.style.maxChars} characters.`,
            "Make it feel natural and avoid sounding scripted or ceremonial.",
            "Do not mention instructions or being an AI.",
          ].join("\n"),
        },
        {
          role: "user",
          content: [
            "Server event to react to:",
            `- Reason: ${trigger.reason}`,
            `- Server: ${trigger.serverName}`,
            `- Previous visible players: ${trigger.previousCount}`,
            `- Current visible players: ${trigger.currentCount}`,
            `- Newly visible players: ${trigger.joinedPlayers.length > 0 ? trigger.joinedPlayers.join(", ") : "none"}`,
            `- Players currently visible on this server: ${serverPlayers.length > 0 ? serverPlayers.join(", ") : "none"}`,
            `- Total visible players across Magnus heartbeats: ${totalPlayers}`,
            "Reply as a brief message to the whole server.",
          ].join("\n"),
        },
      ],
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
    });

    const text = this.normalizeGeneratedText(response.text);
    if (!text) {
      this.log.warn({ trigger }, "llm returned empty proactive response");
      return;
    }

    if (this.loopGuard.isLooping(text)) {
      this.log.debug({ trigger }, "skipping proactive trigger because loop guard blocked it");
      return;
    }

    const listeners = await this.publisher.publish({
      personaId: this.config.id,
      displayName: this.config.displayName,
      rawMessage: text,
      targetServers: [trigger.serverName],
    });

    this.memory.addAssistantMessage(trigger.serverName, text);
    this.cooldowns.recordResponse(cooldownKey);
    this.log.info({ trigger, listeners }, "proactive trigger message published");
  }
}
