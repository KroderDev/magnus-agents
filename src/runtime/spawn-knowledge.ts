import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

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

interface SpawnFile {
  enabled?: boolean;
  spawns?: SpawnEntry[];
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function speciesName(properties: string): string {
  return properties.trim().split(/\s+/, 1)[0] ?? "";
}

function describeCondition(condition: SpawnCondition | undefined): string[] {
  if (!condition) return [];
  const details: string[] = [];
  if (condition.biomes?.length) details.push(`biomas ${condition.biomes.join(", ")}`);
  if (condition.timeRange) details.push(`horario ${condition.timeRange}`);
  if (condition.minY !== undefined || condition.maxY !== undefined) {
    details.push(`altura Y ${condition.minY ?? "mínima"}-${condition.maxY ?? "máxima"}`);
  }
  if (condition.minSkyLight !== undefined || condition.maxSkyLight !== undefined) {
    details.push(`luz de cielo ${condition.minSkyLight ?? 0}-${condition.maxSkyLight ?? 15}`);
  }
  if (condition.isRaining === true) details.push("con lluvia");
  if (condition.isThundering === true) details.push("con tormenta");
  return details;
}

export class SpawnKnowledge {
  private readonly bySpecies = new Map<string, SpawnEntry[]>();

  static load(directory: string): SpawnKnowledge {
    const knowledge = new SpawnKnowledge();
    for (const file of readdirSync(directory).filter((name) => name.endsWith(".json"))) {
      const parsed = JSON.parse(readFileSync(join(directory, file), "utf8")) as SpawnFile;
      if (parsed.enabled === false) continue;
      for (const spawn of parsed.spawns ?? []) {
        const key = normalize(speciesName(spawn.pokemon));
        if (!key) continue;
        const entries = knowledge.bySpecies.get(key) ?? [];
        entries.push(spawn);
        knowledge.bySpecies.set(key, entries);
      }
    }
    return knowledge;
  }

  get size(): number {
    return this.bySpecies.size;
  }

  findInQuestion(question: string): string | undefined {
    const normalizedQuestion = ` ${normalize(question).replace(/[^a-z0-9]+/g, " ")} `;
    const match = [...this.bySpecies.keys()]
      .filter((name) => normalizedQuestion.includes(` ${normalize(name).replace(/[^a-z0-9]+/g, " ")} `))
      .sort((a, b) => b.length - a.length)[0];
    if (!match) return undefined;

    const allSpawns = this.bySpecies.get(match) ?? [];
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

    const omitted = allSpawns.length > lines.length
      ? `\n- Hay ${allSpawns.length - lines.length} variantes adicionales; indica que existen sin inventar sus condiciones.`
      : "";
    return `DATOS AUTORITATIVOS DE SPAWN PARA ${match.toUpperCase()}:\n${lines.join("\n")}${omitted}\n` +
      "Usa estos datos para responder. Traduce etiquetas de bioma a lenguaje natural, no inventes condiciones y aclara que datapacks del servidor pueden modificarlas.";
  }
}
