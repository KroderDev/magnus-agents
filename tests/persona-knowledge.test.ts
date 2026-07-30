import { describe, expect, it } from "vitest";
import { personaConfigSchema } from "../src/config/persona.js";

const basePersona = {
  id: "test-persona",
  displayName: "Test Persona",
  systemPrompt: "Answer questions.",
};

describe("persona knowledge config", () => {
  it("defaults to disabled", () => {
    const result = personaConfigSchema.parse(basePersona);

    expect(result.knowledge).toEqual({
      enabled: false,
      maxResults: 3,
      maxContextChars: 4000,
    });
  });

  it("requires a path when enabled", () => {
    const result = personaConfigSchema.safeParse({
      ...basePersona,
      knowledge: { enabled: true },
    });

    expect(result.success).toBe(false);
  });
});
