import pino from "pino";
import { describe, expect, it, vi } from "vitest";
import type { PersonaConfig } from "../src/config/persona.js";
import { AgentRuntime } from "../src/runtime/agent.js";
import type { LlmProvider } from "../src/integrations/llm/types.js";
import type { ChatPublisher } from "../src/integrations/magnus/chat-publisher.js";

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
  spawnKnowledge: { enabled: false, directory: "data/cobblemon-spawns" },
  style: { maxChars: 40, roleplay: true },
  actions: { enabled: false },
};

describe("AgentRuntime startup greeting", () => {
  it("generates the startup greeting from the persona prompt", async () => {
    const generate = vi.fn<LlmProvider["generate"]>().mockResolvedValue({
      text: "Saludos, cabros curiosos, ya llego el profe a meter ruido en el server.",
    });
    const publish = vi.fn().mockResolvedValue(1);

    const runtime = new AgentRuntime(
      baseConfig,
      { generate },
      { publish } as unknown as ChatPublisher,
      pino({ enabled: false }),
    );

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
