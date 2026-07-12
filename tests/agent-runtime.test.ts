import pino from "pino";
import { describe, expect, it, vi } from "vitest";
import type { PersonaConfig } from "../src/config/persona.js";
import { AgentRuntime } from "../src/runtime/agent.js";
import type { LlmProvider } from "../src/integrations/llm/types.js";
import type { ChatPublisher } from "../src/integrations/magnus/chat-publisher.js";
import type { ChatMessage, ServerPlayerInfo } from "../src/domain/types.js";

const baseConfig: PersonaConfig = {
  id: "test-persona",
  displayName: "Test Persona",
  model: "test-model",
  systemPrompt: "You are a witty professor who speaks like a game server regular.",
  temperature: 0.8,
  maxTokens: 64,
  allowedInputServers: ["*"],
  triggers: {
    onMention: true,
    onQuestion: true,
    onJoinBurst: false,
  },
  cooldowns: { globalSeconds: 20, playerSeconds: 60 },
  memory: { recentMessages: 12 },
  style: { maxChars: 40, roleplay: true },
  actions: { enabled: false },
};

function createRuntime(overrides: Partial<PersonaConfig> = {}) {
  const generate = vi.fn<LlmProvider["generate"]>().mockResolvedValue({
    text: "Saludos, cabros curiosos, ya llego el profe a meter ruido en el server.",
  });
  const publish = vi.fn().mockResolvedValue(1);

  const runtime = new AgentRuntime(
    {
      ...baseConfig,
      ...overrides,
      triggers: { ...baseConfig.triggers, ...overrides.triggers },
      cooldowns: { ...baseConfig.cooldowns, ...overrides.cooldowns },
      memory: { ...baseConfig.memory, ...overrides.memory },
      style: { ...baseConfig.style, ...overrides.style },
      actions: { ...baseConfig.actions, ...overrides.actions },
    },
    { generate },
    { publish } as unknown as ChatPublisher,
    pino({ enabled: false }),
  );

  return { runtime, generate, publish };
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
      triggers: { onMention: true, onQuestion: false, onJoinBurst: false },
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
      triggers: { onMention: true, onQuestion: false, onJoinBurst: false },
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
});
