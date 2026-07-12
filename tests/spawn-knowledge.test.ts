import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SpawnKnowledge } from "../src/runtime/spawn-knowledge.js";

describe("SpawnKnowledge", () => {
  it("finds a species in a Spanish spawn question and formats its rules", () => {
    const directory = mkdtempSync(join(tmpdir(), "spawn-knowledge-"));
    writeFileSync(join(directory, "0025_pikachu.json"), JSON.stringify({
      enabled: true,
      spawns: [{
        pokemon: "pikachu",
        bucket: "uncommon",
        level: "16-32",
        spawnablePositionType: "grounded",
        condition: { biomes: ["#cobblemon:is_forest"], minSkyLight: 8 },
      }],
    }));

    const knowledge = SpawnKnowledge.load(directory);
    const result = knowledge.findInQuestion("Profe, ¿dónde spawnea Pikachu?");

    expect(knowledge.size).toBe(1);
    expect(result).toContain("PIKACHU");
    expect(result).toContain("#cobblemon:is_forest");
    expect(result).toContain("nivel 16-32");
  });

  it("does not inject data when no known species is mentioned", () => {
    const directory = mkdtempSync(join(tmpdir(), "spawn-knowledge-"));
    writeFileSync(join(directory, "empty.json"), JSON.stringify({ enabled: true, spawns: [] }));
    expect(SpawnKnowledge.load(directory).findInQuestion("¿Dónde encuentro uno bueno?")).toBeUndefined();
  });
});
