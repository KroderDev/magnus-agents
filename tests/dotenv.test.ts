import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseDotEnv, loadOptionalDotEnv } from "../src/config/dotenv.js";

describe("dotenv loading", () => {
  const originalCwd = process.cwd();
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "magnus-agents-"));
    process.chdir(tempDir);
    delete process.env.LLM_BASE_URL;
    delete process.env.LLM_API_KEY;
    delete process.env.LLM_MODEL;
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tempDir, { recursive: true, force: true });
    delete process.env.LLM_BASE_URL;
    delete process.env.LLM_API_KEY;
    delete process.env.LLM_MODEL;
  });

  it("parses dotenv content with comments, export prefixes, and quotes", () => {
    const parsed = parseDotEnv([
      "# comment",
      "export LLM_BASE_URL=http://127.0.0.1:11434/v1",
      "LLM_API_KEY='ollama'",
      'LLM_MODEL="llama3.1:8b-instruct"',
      "INVALID LINE",
    ].join("\n"));

    expect(parsed).toEqual({
      LLM_BASE_URL: "http://127.0.0.1:11434/v1",
      LLM_API_KEY: "ollama",
      LLM_MODEL: "llama3.1:8b-instruct",
    });
  });

  it("loads .env when present", () => {
    writeFileSync(
      join(tempDir, ".env"),
      [
        "LLM_BASE_URL=http://127.0.0.1:11434/v1",
        "LLM_API_KEY=ollama",
        "LLM_MODEL=llama3.1:8b-instruct",
      ].join("\n"),
    );

    loadOptionalDotEnv();

    expect(process.env.LLM_BASE_URL).toBe("http://127.0.0.1:11434/v1");
    expect(process.env.LLM_API_KEY).toBe("ollama");
    expect(process.env.LLM_MODEL).toBe("llama3.1:8b-instruct");
  });

  it("does not override env vars that are already set", () => {
    process.env.LLM_MODEL = "from-process-env";
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(join(tempDir, ".env"), "LLM_MODEL=from-dotenv\n");

    loadOptionalDotEnv();

    expect(process.env.LLM_MODEL).toBe("from-process-env");
  });
});
