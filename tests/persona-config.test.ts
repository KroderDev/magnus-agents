import { describe, expect, it } from "vitest";
import { personaConfigSchema } from "../src/config/persona.js";

describe("persona config schema", () => {
  const baseConfig = {
    id: "test-persona",
    displayName: "Test Persona",
    systemPrompt: "You are a test persona.",
  };

  it("parses legacy trigger booleans without losing behavior", () => {
    const result = personaConfigSchema.parse({
      ...baseConfig,
      triggers: {
        onMention: true,
        onQuestion: true,
        onJoinBurst: true,
      },
    });

    expect(result.triggers.mention.enabled).toBe(true);
    expect(result.triggers.question.enabled).toBe(true);
    expect(result.triggers.joinBurst.enabled).toBe(true);
    expect(result.triggers.mention.aliases).toEqual([]);
    expect(result.triggers.serverBecomesActive.enabled).toBe(false);
  });

  it("lets explicit modern trigger config override legacy booleans", () => {
    const result = personaConfigSchema.parse({
      ...baseConfig,
      triggers: {
        onQuestion: false,
        question: {
          enabled: true,
          requireMention: true,
          useSemanticRelevance: false,
        },
        mention: {
          enabled: true,
          aliases: ["profe"],
        },
      },
    });

    expect(result.triggers.question.enabled).toBe(true);
    expect(result.triggers.question.requireMention).toBe(true);
    expect(result.triggers.question.useSemanticRelevance).toBe(false);
    expect(result.triggers.mention.aliases).toEqual(["profe"]);
  });
});
