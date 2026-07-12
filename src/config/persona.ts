import { readFileSync } from "node:fs";
import { z } from "zod";
import { parse as parseYaml } from "yaml";

const modernTriggerConfigSchema = z.object({
  mention: z.object({
    enabled: z.boolean().default(true),
    aliases: z.array(z.string().min(1)).default([]),
  }).default({ enabled: true, aliases: [] }),
  question: z.object({
    enabled: z.boolean().default(false),
    requireMention: z.boolean().default(false),
    useSemanticRelevance: z.boolean().default(true),
  }).default({ enabled: false, requireMention: false, useSemanticRelevance: true }),
  joinBurst: z.object({
    enabled: z.boolean().default(false),
    minJoins: z.number().int().positive().default(3),
    windowSeconds: z.number().positive().default(20),
    cooldownSeconds: z.number().positive().default(180),
  }).default({ enabled: false, minJoins: 3, windowSeconds: 20, cooldownSeconds: 180 }),
  serverBecomesActive: z.object({
    enabled: z.boolean().default(false),
    minPlayers: z.number().int().positive().default(2),
    cooldownSeconds: z.number().positive().default(300),
  }).default({ enabled: false, minPlayers: 2, cooldownSeconds: 300 }),
});

const triggerConfigSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object") {
    return raw;
  }

  const input = raw as {
    mention?: { enabled?: boolean; aliases?: string[] };
    question?: { enabled?: boolean; requireMention?: boolean; useSemanticRelevance?: boolean };
    joinBurst?: { enabled?: boolean; minJoins?: number; windowSeconds?: number; cooldownSeconds?: number };
    serverBecomesActive?: { enabled?: boolean; minPlayers?: number; cooldownSeconds?: number };
    onMention?: boolean;
    onQuestion?: boolean;
    onJoinBurst?: boolean;
  };

  return {
    ...input,
    mention: input.mention ?? (input.onMention !== undefined ? { enabled: input.onMention } : undefined),
    question: input.question ?? (input.onQuestion !== undefined ? { enabled: input.onQuestion } : undefined),
    joinBurst: input.joinBurst ?? (input.onJoinBurst !== undefined ? { enabled: input.onJoinBurst } : undefined),
  };
}, modernTriggerConfigSchema);

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
  triggers: triggerConfigSchema.default({}),
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
