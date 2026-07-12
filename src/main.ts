import { loadEnv } from "./config/env.js";
import { loadOptionalDotEnv } from "./config/dotenv.js";
import { loadPersonaConfig } from "./config/persona.js";
import { createLogger } from "./transport/logger.js";
import { startHealthServer } from "./transport/health.js";
import { createRedisClient } from "./integrations/magnus/redis-client.js";
import { MessageSigner } from "./integrations/magnus/signer.js";
import { ChatPublisher } from "./integrations/magnus/chat-publisher.js";
import { ChatSubscriber } from "./integrations/magnus/chat-subscriber.js";
import { PlayerListSubscriber } from "./integrations/magnus/playerlist-subscriber.js";
import { OpenAICompatibleProvider as LlmProvider } from "./integrations/llm/openai-provider.js";
import { AgentRuntime } from "./runtime/agent.js";
import { ActionRegistry } from "./actions/registry.js";

async function main(): Promise<void> {
  loadOptionalDotEnv();
  const env = loadEnv();
  const log = createLogger(env.LOG_LEVEL);
  const config = loadPersonaConfig(env.PERSONA_CONFIG_PATH);

  log.info({ personaId: config.id, displayName: config.displayName }, "starting persona agent");

  const redis = createRedisClient({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
  });

  const signer = new MessageSigner(env.MAGNUS_MESSAGE_SIGNING_SECRET);

  const llm = new LlmProvider({
    baseURL: env.LLM_BASE_URL,
    apiKey: env.LLM_API_KEY,
    defaultModel: env.LLM_MODEL,
    timeoutMs: env.LLM_TIMEOUT_MS,
  });

  const publisher = new ChatPublisher(redis, signer, config.id);
  const chatSub = new ChatSubscriber(redis, signer);
  const playerListSub = new PlayerListSubscriber(redis, signer);

  const actionRegistry = new ActionRegistry();
  if (config.actions.enabled) {
    log.warn("actions enabled in config but no actions registered (actions system is not yet implemented)");
  }

  const agent = new AgentRuntime(config, llm, publisher, log);

  await chatSub.subscribe((msg) => {
    agent.onChat(msg);
  });

  await playerListSub.subscribe((info) => {
    agent.onPlayerList(info);
  });

  const closeHealth = startHealthServer(env.HEALTH_PORT, log);

  const shutdown = async () => {
    log.info("shutting down");
    closeHealth();
    await chatSub.unsubscribe();
    await playerListSub.unsubscribe();
    redis.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  log.info({ actions: actionRegistry.count, triggers: config.triggers }, "agent ready");
}

main().catch((err) => {
  console.error("fatal startup error", err);
  process.exit(1);
});
