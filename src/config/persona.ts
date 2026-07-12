import { readFileSync } from "node:fs";
import { z } from "zod";
import { parse as parseYaml } from "yaml";

export const personaConfigSchema = z.object({
  id: z.string().min(1).regex(/^[a-z0-9_-]+$/, "id must be lowercase alphanumeric with hyphens or underscores"),
  displayName: z.string().min(1),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).default(0.8),
  maxTokens: z.number().positive().optional(),
  allowedInputServers: z.array(z.string()).default(["*"]),
  systemPrompt: z.string().min(1),
  cooldowns: z.object({
    globalSeconds: z.number().positive().default(20),
    playerSeconds: z.number().positive().default(60),
  }).default({ globalSeconds: 20, playerSeconds: 60 }),
  memory: z.object({
    recentMessages: z.number().positive().default(12),
  }).default({ recentMessages: 12 }),
  style: z.object({
    maxChars: z.number().positive().default(180),
    roleplay: z.boolean().default(true),
  }).default({ maxChars: 180, roleplay: true }),
  triggers: z.object({
    onMention: z.boolean().default(true),
    onQuestion: z.boolean().default(false),
    onJoinBurst: z.boolean().default(false),
  }).default({ onMention: true }),
  actions: z.object({
    enabled: z.boolean().default(false),
  }).default({ enabled: false }),
});

export type PersonaConfig = z.infer<typeof personaConfigSchema>;

export function loadPersonaConfig(path: string): PersonaConfig {
  const raw = readFileSync(path, "utf-8");
  const parsed = parseYaml(raw);
  const result = personaConfigSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Invalid persona config at ${path}: ${result.error.flatten().fieldErrors}`);
  }
  return result.data;
}
