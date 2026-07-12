import { z } from "zod";

export const envSchema = z.object({
  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().default(""),

  MAGNUS_MESSAGE_SIGNING_SECRET: z.string().min(1),

  LLM_BASE_URL: z.string().url(),
  LLM_API_KEY: z.string(),
  LLM_MODEL: z.string().min(1),
  LLM_TIMEOUT_MS: z.coerce.number().positive().default(15000),

  PERSONA_CONFIG_PATH: z.string().min(1),

  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
  HEALTH_PORT: z.coerce.number().positive().default(3000),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function loadEnv(): EnvConfig {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("Invalid environment configuration:", result.error.flatten());
    process.exit(1);
  }
  return result.data;
}
