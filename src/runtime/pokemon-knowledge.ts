import { readFileSync } from "node:fs";

interface SpawnCondition {
  biomes?: string[];
  minSkyLight?: number;
  maxSkyLight?: number;
  minY?: number;
  maxY?: number;
  timeRange?: string;
  isRaining?: boolean;
  isThundering?: boolean;
}

interface SpawnEntry {
  pokemon: string;
  bucket?: string;
  level?: string;
  spawnablePositionType?: string;
  condition?: SpawnCondition;
  anticondition?: SpawnCondition;
}

interface Evolution {
  variant?: string;
  result?: string;
  consumeHeldItem?: boolean;
  requirements?: Array<Record<string, unknown>>;
}

interface PokemonEntry {
  profile?: { name?: string; evolutions?: Evolution[] };
  spawns?: SpawnEntry[];
}

interface KnowledgeFile {
  source: { modpack: string; modpackVersion: string; cobblemonVersion: string; datapack: string };
  pokemon: Record<string, PokemonEntry>;
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function describeCondition(condition: SpawnCondition | undefined): string[] {
  if (!condition) return [];
  const details: string[] = [];
  if (condition.biomes?.length) details.push(`biomas ${condition.biomes.join(", ")}`);
  if (condition.timeRange) details.push(`horario ${condition.timeRange}`);
  if (condition.minY !== undefined || condition.maxY !== undefined) details.push(`altura Y ${condition.minY ?? "mínima"}-${condition.maxY ?? "máxima"}`);
  if (condition.minSkyLight !== undefined || condition.maxSkyLight !== undefined) details.push(`luz de cielo ${condition.minSkyLight ?? 0}-${condition.maxSkyLight ?? 15}`);
  if (condition.isRaining === true) details.push("con lluvia");
  if (condition.isThundering === true) details.push("con tormenta");
  return details;
}

export class PokemonKnowledge {
  private constructor(private readonly data: KnowledgeFile) {}

  static load(path: string): PokemonKnowledge {
    return new PokemonKnowledge(JSON.parse(readFileSync(path, "utf8")) as KnowledgeFile);
  }

  get size(): number {
    return Object.keys(this.data.pokemon).length;
  }

  findInQuestion(question: string): string | undefined {
    const normalizedQuestion = ` ${normalize(question).replace(/[^a-z0-9]+/g, " ")} `;
    const match = Object.keys(this.data.pokemon)
      .filter((name) => normalizedQuestion.includes(` ${normalize(name).replace(/[^a-z0-9]+/g, " ")} `))
      .sort((a, b) => b.length - a.length)[0];
    if (!match) return undefined;

    const entry = this.data.pokemon[match];
    if (!entry) return undefined;
    const sections: string[] = [];

    if (entry.profile?.evolutions?.length) {
      const evolutions = entry.profile.evolutions.map((evolution) =>
        `- evoluciona a ${evolution.result ?? "desconocido"}; método ${evolution.variant ?? "desconocido"}; requisitos ${JSON.stringify(evolution.requirements ?? [])}`,
      );
      sections.push(`EVOLUCIONES:\n${evolutions.join("\n")}`);
    }

    const allSpawns = entry.spawns ?? [];
    if (allSpawns.length) {
      const lines = allSpawns.slice(0, 12).map((spawn, index) => {
        const details = [
          `variante ${index + 1}`,
          spawn.bucket && `rareza ${spawn.bucket}`,
          spawn.level && `nivel ${spawn.level}`,
          spawn.spawnablePositionType && `posición ${spawn.spawnablePositionType}`,
          ...describeCondition(spawn.condition),
          spawn.anticondition?.biomes?.length && `no aparece en ${spawn.anticondition.biomes.join(", ")}`,
        ].filter(Boolean);
        return `- ${details.join("; ")}`;
      });
      sections.push(`SPAWNS:\n${lines.join("\n")}`);
    }

    if (!sections.length) return undefined;
    const source = this.data.source;
    return `DATOS AUTORITATIVOS PARA ${match.toUpperCase()} (${source.modpack} ${source.modpackVersion}, Cobblemon ${source.cobblemonVersion}):\n${sections.join("\n")}\n` +
      "Responde solo con los datos relevantes a la pregunta, traduce identificadores técnicos a español natural y no inventes condiciones.";
  }
}
