import { describe, it, expect } from "vitest";
import { TriggerEngine } from "../src/runtime/trigger-engine.js";
import type { PersonaConfig } from "../src/config/persona.js";
import type { ChatMessage } from "../src/domain/types.js";

const baseConfig: PersonaConfig = {
  id: "test-persona",
  displayName: "Test Persona",
  systemPrompt: "You are a test.",
  allowedInputServers: ["*"],
  triggers: {
    onMention: true,
    onQuestion: true,
    onJoinBurst: false,
  },
  cooldowns: { globalSeconds: 20, playerSeconds: 60 },
  memory: { recentMessages: 12 },
  style: { maxChars: 180, roleplay: true },
  actions: { enabled: false },
};

function msg(text: string, server = "lobby"): ChatMessage {
  return {
    serverName: server,
    playerUuid: "uuid-1",
    playerName: "Player",
    rawMessage: text,
    timestamp: Date.now(),
  };
}

describe("TriggerEngine", () => {
  it("should trigger on direct name mention", () => {
    const engine = new TriggerEngine(baseConfig);
    const result = engine.evaluate(msg("Hola Test Persona, como estas?"));
    expect(result?.shouldRespond).toBe(true);
    expect(result?.reason).toBe("mention");
  });

  it("should trigger on persona ID mention", () => {
    const engine = new TriggerEngine(baseConfig);
    const result = engine.evaluate(msg("Hey test-persona, help!"));
    expect(result?.shouldRespond).toBe(true);
  });

  it("should trigger on question", () => {
    const config: PersonaConfig = {
      ...baseConfig,
      triggers: { ...baseConfig.triggers, onMention: false, onQuestion: true },
    };
    const engine = new TriggerEngine(config);
    const result = engine.evaluate(msg("Alguien sabe donde esta el spawn?"));
    expect(result?.shouldRespond).toBe(true);
    expect(result?.reason).toBe("question");
  });

  it("should not trigger on regular chat", () => {
    const engine = new TriggerEngine(baseConfig);
    const result = engine.evaluate(msg("Que bonito el spawn"));
    expect(result).toBeNull();
  });

  it("should respect allowed servers", () => {
    const config: PersonaConfig = {
      ...baseConfig,
      allowedInputServers: ["kanto"],
    };
    const engine = new TriggerEngine(config);
    expect(engine.evaluate(msg("test-persona", "lobby"))).toBeNull();
    expect(engine.evaluate(msg("test-persona", "kanto"))?.shouldRespond).toBe(true);
  });

  it("should not trigger with both disabled", () => {
    const config: PersonaConfig = {
      ...baseConfig,
      triggers: { onMention: false, onQuestion: false },
    };
    const engine = new TriggerEngine(config);
    expect(engine.evaluate(msg("Test Persona help"))).toBeNull();
    expect(engine.evaluate(msg("donde esta?"))).toBeNull();
  });
});
