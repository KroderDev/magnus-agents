import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

interface SpeciesData {
  name?: string;
  nationalPokedexNumber?: number;
  primaryType?: string;
  secondaryType?: string;
  abilities?: string[];
  baseStats?: Record<string, number>;
  moves?: string[];
  evolutions?: unknown[];
}

function jsonFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? jsonFiles(path) : name.endsWith(".json") ? [path] : [];
  });
}

const [spawnDirectory, speciesDirectory, outputPath] = process.argv.slice(2);
if (!spawnDirectory || !speciesDirectory || !outputPath) {
  throw new Error("Usage: tsx scripts/build-cobblemon-knowledge.ts <spawns> <species> <output>");
}

const pokemon: Record<string, { profile?: SpeciesData; spawns?: unknown[] }> = {};

for (const path of jsonFiles(speciesDirectory)) {
  const species = JSON.parse(readFileSync(path, "utf8")) as SpeciesData;
  const key = basename(path, ".json").toLowerCase();
  pokemon[key] = {
    ...pokemon[key],
    profile: {
      name: species.name,
      nationalPokedexNumber: species.nationalPokedexNumber,
      primaryType: species.primaryType,
      secondaryType: species.secondaryType,
      abilities: species.abilities,
      baseStats: species.baseStats,
      moves: species.moves,
      evolutions: species.evolutions,
    },
  };
}

for (const path of jsonFiles(spawnDirectory)) {
  const file = JSON.parse(readFileSync(path, "utf8")) as { enabled?: boolean; spawns?: Array<{ pokemon?: string }> };
  if (file.enabled === false) continue;
  for (const spawn of file.spawns ?? []) {
    const key = spawn.pokemon?.trim().split(/\s+/, 1)[0]?.toLowerCase();
    if (!key) continue;
    pokemon[key] = { ...pokemon[key], spawns: [...(pokemon[key]?.spawns ?? []), spawn] };
  }
}

writeFileSync(outputPath, JSON.stringify({
  source: { modpack: "Cobbleverse", modpackVersion: "1.7.40", cobblemonVersion: "1.7.3", datapack: "COBBLEVERSE-DP-v30" },
  pokemon,
}));

console.log(`Wrote ${Object.keys(pokemon).length} Pokémon to ${outputPath}`);
