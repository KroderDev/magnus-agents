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
      triggers: {
        ...baseConfig.triggers,
        mention: { ...baseConfig.triggers.mention, enabled: false },
        question: { ...baseConfig.triggers.question, enabled: true, useSemanticRelevance: false },
      },
    };
    const engine = new TriggerEngine(config);
    const result = engine.evaluate(msg("Alguien sabe donde esta el spawn"));
    expect(result?.shouldRespond).toBe(true);
    expect(result?.reason).toBe("question");
  });

  it("should trigger on configured alias mention", () => {
    const config: PersonaConfig = {
      ...baseConfig,
      triggers: {
        ...baseConfig.triggers,
        mention: { enabled: true, aliases: ["profe"] },
      },
    };

    const engine = new TriggerEngine(config);
    expect(engine.evaluate(msg("oye profe, cachai donde esta el gimnasio?"))?.reason).toBe("mention");
  });

  it("should mark non-mentioned questions as question candidates when semantic relevance is enabled", () => {
    const engine = new TriggerEngine(baseConfig);
    expect(engine.evaluate(msg("alguien sabe donde pillar hierro"))?.reason).toBe("question-candidate");
  });

  it("should trigger on configured help keywords without a direct mention", () => {
    const config: PersonaConfig = {
      ...baseConfig,
      triggers: {
        ...baseConfig.triggers,
        question: {
          ...baseConfig.triggers.question,
          helpSignals: [
            { pattern: "ayuda", match: "includes", priority: 1 },
            { pattern: "como entro", match: "includes", priority: 2 },
          ],
        },
      },
    };

    const engine = new TriggerEngine(config);
    expect(engine.evaluate(msg("como entro a kanto? ayuda"))?.reason).toBe("help-request");
  });

  it("should support regex help signals", () => {
    const config: PersonaConfig = {
      ...baseConfig,
      triggers: {
        ...baseConfig.triggers,
        question: {
          ...baseConfig.triggers.question,
          helpSignals: [
            { pattern: "(no se|no sé).*(salir|entrar|ir)", match: "regex", priority: 4 },
          ],
        },
      },
    };

    const engine = new TriggerEngine(config);
    expect(engine.evaluate(msg("no se salir del lobby"))?.reason).toBe("help-request");
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
      triggers: {
        ...baseConfig.triggers,
        mention: { ...baseConfig.triggers.mention, enabled: false },
        question: { ...baseConfig.triggers.question, enabled: false },
      },
    };
    const engine = new TriggerEngine(config);
    expect(engine.evaluate(msg("Test Persona help"))).toBeNull();
    expect(engine.evaluate(msg("donde esta?"))).toBeNull();
  });
});
