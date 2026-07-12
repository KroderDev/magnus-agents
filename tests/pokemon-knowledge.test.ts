import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { PokemonKnowledge } from "../src/runtime/pokemon-knowledge.js";

describe("PokemonKnowledge", () => {
  it("returns spawn and evolution facts from one file", () => {
    const path = join(tmpdir(), `pokemon-knowledge-${process.pid}.json`);
    writeFileSync(path, JSON.stringify({
      source: { modpack: "Cobbleverse", modpackVersion: "1.7.40", cobblemonVersion: "1.7.3", datapack: "v30" },
      pokemon: { bulbasaur: {
        profile: { evolutions: [{ variant: "level_up", result: "ivysaur", requirements: [{ variant: "level", minLevel: 16 }] }] },
        spawns: [{ pokemon: "bulbasaur", level: "5-32", condition: { biomes: ["#cobblemon:is_jungle"] } }],
      } },
    }));

    const result = PokemonKnowledge.load(path).findInQuestion("¿Dónde aparece Bulbasaur y cuándo evoluciona?");
    expect(result).toContain("Cobbleverse 1.7.40");
    expect(result).toContain("ivysaur");
    expect(result).toContain("minLevel\":16");
    expect(result).toContain("#cobblemon:is_jungle");
  });
});
