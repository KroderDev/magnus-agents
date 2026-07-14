import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { KnowledgeBase } from "../src/runtime/knowledge-base.js";

describe("KnowledgeBase", () => {
  it("returns matching entries from a generic knowledge file", () => {
    const path = join(tmpdir(), `agent-knowledge-${process.pid}.json`);
    writeFileSync(path, JSON.stringify({
      version: "1",
      entries: [
        { id: "moon-garden", aliases: ["lunar garden"], content: "The garden opens after sunset." },
        { id: "sunken-library", aliases: ["library"], content: "The library is below the eastern bridge." },
      ],
    }));

    const knowledge = KnowledgeBase.load(path, { maxResults: 2, maxContextChars: 1000 });
    const result = knowledge.findRelevant("Where is the lunar garden?");

    expect(knowledge.size).toBe(2);
    expect(result).toContain("moon-garden");
    expect(result).toContain("opens after sunset");
    expect(result).not.toContain("sunken-library");
  });

  it("limits injected context length", () => {
    const path = join(tmpdir(), `agent-knowledge-limit-${process.pid}.json`);
    writeFileSync(path, JSON.stringify({
      entries: [{ id: "topic", content: "x".repeat(200) }],
    }));

    const result = KnowledgeBase.load(path, { maxResults: 1, maxContextChars: 30 })
      .findRelevant("Tell me about topic");

    expect(result).toContain("REFERENCE KNOWLEDGE");
    expect(result).not.toContain("x".repeat(31));
  });

  it("rejects malformed files", () => {
    const path = join(tmpdir(), `agent-knowledge-invalid-${process.pid}.json`);
    writeFileSync(path, JSON.stringify({ entries: [{ id: "missing-content" }] }));

    expect(() => KnowledgeBase.load(path, { maxResults: 1, maxContextChars: 100 }))
      .toThrow("Invalid knowledge file");
  });
});
