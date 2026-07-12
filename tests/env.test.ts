import { describe, expect, it } from "vitest";
import { envSchema } from "../src/config/env.js";

describe("env schema", () => {
  const baseEnv = {
    MAGNUS_MESSAGE_SIGNING_SECRET: "secret",
    LLM_BASE_URL: "http://127.0.0.1:11434/v1",
    LLM_API_KEY: "ollama",
    LLM_MODEL: "gemma4",
    PERSONA_CONFIG_PATH: "./personas/profesor-gepeto.yaml",
  };

  it("defaults startup greeting to false", () => {
    const result = envSchema.parse(baseEnv);

    expect(result.STARTUP_GREETING).toBe(false);
    expect(result.STARTUP_GREETING_DELAY_MS).toBe(0);
  });

  it("coerces startup greeting from string values", () => {
    const result = envSchema.parse({
      ...baseEnv,
      STARTUP_GREETING: "true",
      STARTUP_GREETING_DELAY_MS: "5000",
    });

    expect(result.STARTUP_GREETING).toBe(true);
    expect(result.STARTUP_GREETING_DELAY_MS).toBe(5000);
  });
});
