import pino from "pino";
import { describe, expect, it, vi } from "vitest";
import type { PersonaConfig } from "../src/config/persona.js";
import { AgentRuntime } from "../src/runtime/agent.js";
import type { LlmProvider } from "../src/integrations/llm/types.js";
import type { ChatPublisher } from "../src/integrations/magnus/chat-publisher.js";
import type { ChatMessage, ServerPlayerInfo } from "../src/domain/types.js";
import { ActionRegistry } from "../src/actions/registry.js";

type PersonaOverrides = Partial<Omit<PersonaConfig, "triggers" | "cooldowns" | "memory" | "style" | "actions">> & {
  triggers?: Partial<{
    mention: Partial<PersonaConfig["triggers"]["mention"]>;
    question: Partial<PersonaConfig["triggers"]["question"]>;
    joinBurst: Partial<PersonaConfig["triggers"]["joinBurst"]>;
    serverBecomesActive: Partial<PersonaConfig["triggers"]["serverBecomesActive"]>;
  }>;
  cooldowns?: Partial<PersonaConfig["cooldowns"]>;
  memory?: Partial<PersonaConfig["memory"]>;
  style?: Partial<PersonaConfig["style"]>;
  actions?: Partial<PersonaConfig["actions"]>;
};

const baseConfig: PersonaConfig = {
  id: "test-persona",
  displayName: "Test Persona",
  model: "test-model",
  systemPrompt: "You are a witty professor who speaks like a game server regular.",
  temperature: 0.8,
  maxTokens: 64,
  allowedInputServers: ["*"],
  triggers: {
    mention: {
      enabled: true,
      aliases: [],
    },
    question: {
      enabled: true,
      requireMention: false,
      useSemanticRelevance: true,
      helpKeywords: [],
      helpSignals: [],
    },
    joinBurst: {
      enabled: false,
      minJoins: 3,
      windowSeconds: 20,
      cooldownSeconds: 180,
    },
    serverBecomesActive: {
      enabled: false,
      minPlayers: 2,
      cooldownSeconds: 300,
    },
  },
  cooldowns: { globalSeconds: 20, playerSeconds: 60 },
  memory: { recentMessages: 12 },
  style: { maxChars: 40, roleplay: true },
  actions: { enabled: false },
};

function createRuntime(overrides: PersonaOverrides = {}) {
  const generate = vi.fn<LlmProvider["generate"]>().mockResolvedValue({
    text: "Saludos, cabros curiosos, ya llego el profe a meter ruido en el server.",
  });
  const publish = vi.fn().mockResolvedValue(1);

  const actions = new ActionRegistry();

  const runtime = new AgentRuntime(
    {
      ...baseConfig,
      ...overrides,
      triggers: {
        ...baseConfig.triggers,
        ...overrides.triggers,
        mention: {
          ...baseConfig.triggers.mention,
          ...overrides.triggers?.mention,
        },
        question: {
          ...baseConfig.triggers.question,
          ...overrides.triggers?.question,
        },
        joinBurst: {
          ...baseConfig.triggers.joinBurst,
          ...overrides.triggers?.joinBurst,
        },
        serverBecomesActive: {
          ...baseConfig.triggers.serverBecomesActive,
          ...overrides.triggers?.serverBecomesActive,
        },
      },
      cooldowns: { ...baseConfig.cooldowns, ...overrides.cooldowns },
      memory: { ...baseConfig.memory, ...overrides.memory },
      style: { ...baseConfig.style, ...overrides.style },
      actions: { ...baseConfig.actions, ...overrides.actions },
    },
    { generate },
    { publish } as unknown as ChatPublisher,
    actions,
    pino({ enabled: false }),
  );

  return { runtime, generate, publish, actions };
}

function chatMessage(overrides: Partial<ChatMessage>): ChatMessage {
  return {
    serverName: "lobby",
    playerUuid: "uuid-1",
    playerName: "Ash",
    rawMessage: "hola",
    timestamp: Date.now(),
    ...overrides,
  };
}

function playerList(serverName: string, players: string[], timestamp = Date.now()): ServerPlayerInfo {
  return {
    serverName,
    timestamp,
    players: players.map((name, index) => ({ uuid: `${serverName}-${index}`, name })),
  };
}

describe("AgentRuntime startup greeting", () => {
  it("generates the startup greeting from the persona prompt", async () => {
    const { runtime, generate, publish } = createRuntime();

    await runtime.publishStartupGreeting();

    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "test-model",
        messages: [
          { role: "system", content: baseConfig.systemPrompt },
          expect.objectContaining({
            role: "user",
          }),
        ],
        temperature: baseConfig.temperature,
        maxTokens: baseConfig.maxTokens,
      }),
    );
    expect(publish).toHaveBeenCalledWith({
      personaId: baseConfig.id,
      displayName: baseConfig.displayName,
      rawMessage: "Saludos, cabros curiosos, ya llego el",
    });
  });
});

describe("AgentRuntime chat context", () => {
  it("frames the current trigger explicitly and keeps unrelated server chat out of history", async () => {
    const { runtime, generate } = createRuntime({
      triggers: {
        mention: { enabled: true },
        question: { enabled: false },
      },
    });

    runtime.onChat(chatMessage({
      playerUuid: "uuid-2",
      playerName: "Misty",
      rawMessage: "seguimos farmeando apricorns",
      timestamp: 1,
    }));
    runtime.onChat(chatMessage({
      serverName: "kanto",
      playerUuid: "uuid-3",
      playerName: "Brock",
      rawMessage: "mensaje viejo de otro server",
      timestamp: 2,
    }));

    const current = chatMessage({
      playerUuid: "uuid-1",
      playerName: "Ash",
      rawMessage: "Test Persona, donde pillo hierro?",
      timestamp: 3,
    });
    runtime.onChat(current);

    await vi.waitFor(() => expect(generate).toHaveBeenCalledTimes(1));

    const request = generate.mock.calls[0]?.[0];
    expect(request).toBeDefined();
    const finalMessage = request.messages[request.messages.length - 1];

    expect(finalMessage.role).toBe("user");
    expect(finalMessage.content).toContain('Message: "Test Persona, donde pillo hierro?"');

    const earlierMessages = request.messages.slice(0, -1).map((message) => message.content);
    expect(earlierMessages.some((content) => content.includes(current.rawMessage))).toBe(false);
    expect(earlierMessages.some((content) => content.includes("mensaje viejo de otro server"))).toBe(false);
    expect(earlierMessages.some((content) => content.includes("seguimos farmeando apricorns"))).toBe(true);
  });

  it("includes assistant history and player-list world state in later responses", async () => {
    const { runtime, generate, publish } = createRuntime({
      triggers: {
        mention: { enabled: true },
        question: { enabled: false },
      },
      cooldowns: { globalSeconds: 0.001, playerSeconds: 0.001 },
    });

    runtime.onPlayerList(playerList("lobby", ["Ash", "Misty"]));
    runtime.onPlayerList(playerList("kanto", ["Brock"]));

    runtime.onChat(chatMessage({
      playerUuid: "uuid-1",
      playerName: "Ash",
      rawMessage: "Test Persona, hola po",
      timestamp: 10,
    }));

    await vi.waitFor(() => expect(generate).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(publish).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 10));

    runtime.onChat(chatMessage({
      playerUuid: "uuid-2",
      playerName: "Misty",
      rawMessage: "Test Persona, y ahora que hago yo?",
      timestamp: 11,
    }));

    await vi.waitFor(() => expect(generate).toHaveBeenCalledTimes(2));

    const request = generate.mock.calls[1]?.[0];
    expect(request).toBeDefined();
    expect(request.messages.some((message) => (
      message.role === "assistant"
        && message.content.includes("Saludos, cabros curiosos, ya llego el")
    ))).toBe(true);
    expect(request.messages.some((message) => (
      message.role === "system"
        && message.content.includes("Players currently visible on lobby: Ash, Misty.")
        && message.content.includes("Total visible players across Magnus heartbeats: 3.")
    ))).toBe(true);
  });

  it("supports an alternate action route without drafting or publishing chat", async () => {
    const { runtime, generate, publish, actions } = createRuntime({
      actions: { enabled: true },
      triggers: {
        mention: { enabled: true },
        question: { enabled: false },
      },
    });

    actions.register({
      id: "who-is-online",
      description: "Dummy action for pipeline route tests",
      execute: async () => ({ success: true, output: "ok" }),
    });

    runtime.onChat(chatMessage({
      playerUuid: "uuid-9",
      playerName: "Gary",
      rawMessage: "Test Persona action: revisa quien esta online",
      timestamp: 20,
    }));

    await new Promise((resolve) => setTimeout(resolve, 25));

    expect(generate).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it("runs semantic relevance checks for non-mentioned questions before replying", async () => {
    const { runtime, generate, publish } = createRuntime({
      cooldowns: { globalSeconds: 0.001, playerSeconds: 0.001 },
    });

    generate.mockImplementation(async (request) => {
      const finalMessage = request.messages[request.messages.length - 1]?.content ?? "";
      if (finalMessage.includes("Question relevance check:")) {
        return { text: "relevant" };
      }

      return { text: "Te sirve ir por hierro a las cuevas del spawn primero." };
    });

    runtime.onChat(chatMessage({
      rawMessage: "alguien sabe donde pillar hierro",
      timestamp: 30,
    }));

    await vi.waitFor(() => expect(generate).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(publish).toHaveBeenCalledTimes(1));

    expect(generate.mock.calls[0]?.[0].messages.at(-1)?.content).toContain("Question relevance check:");
    expect(generate.mock.calls[1]?.[0].messages.at(-1)?.content).toContain('Message: "alguien sabe donde pillar hierro"');
  });

  it("publishes a proactive join burst message to the affected server", async () => {
    const { runtime, generate, publish } = createRuntime({
      cooldowns: { globalSeconds: 0.001, playerSeconds: 0.001 },
      triggers: {
        question: { enabled: false },
        joinBurst: {
          enabled: true,
          minJoins: 3,
          windowSeconds: 20,
          cooldownSeconds: 180,
        },
      },
    });

    runtime.onPlayerList(playerList("lobby", ["Ash"], 1000));
    runtime.onPlayerList(playerList("lobby", ["Ash", "Misty"], 2000));
    runtime.onPlayerList(playerList("lobby", ["Ash", "Misty", "Brock"], 3000));

    await vi.waitFor(() => expect(generate).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(publish).toHaveBeenCalledTimes(1));

    expect(generate.mock.calls[0]?.[0].messages.at(-1)?.content).toContain("Reason: join-burst");
    expect(publish).toHaveBeenCalledWith({
      personaId: baseConfig.id,
      displayName: baseConfig.displayName,
      rawMessage: "Saludos, cabros curiosos, ya llego el",
      targetServers: ["lobby"],
    });
  });

  it("publishes a proactive server activation message when a server comes alive", async () => {
    const { runtime, generate, publish } = createRuntime({
      cooldowns: { globalSeconds: 0.001, playerSeconds: 0.001 },
      triggers: {
        question: { enabled: false },
        joinBurst: { enabled: false },
        serverBecomesActive: {
          enabled: true,
          minPlayers: 2,
          cooldownSeconds: 300,
        },
      },
    });

    runtime.onPlayerList(playerList("kanto", [], 1000));
    runtime.onPlayerList(playerList("kanto", ["Ash", "Misty"], 2000));

    await vi.waitFor(() => expect(generate).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(publish).toHaveBeenCalledTimes(1));

    expect(generate.mock.calls[0]?.[0].messages.at(-1)?.content).toContain("Reason: server-became-active");
    expect(publish).toHaveBeenCalledWith({
      personaId: baseConfig.id,
      displayName: baseConfig.displayName,
      rawMessage: "Saludos, cabros curiosos, ya llego el",
      targetServers: ["kanto"],
    });
  });
});
