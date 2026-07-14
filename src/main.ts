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
import { ServerStateSubscriber } from "./integrations/magnus/serverstate-subscriber.js";
import { OpenAICompatibleProvider as LlmProvider } from "./integrations/llm/openai-provider.js";
import { AgentRuntime } from "./runtime/agent.js";
import { ActionRegistry } from "./actions/registry.js";
import { MAGNUS_CHAT_CHANNEL, MAGNUS_PLAYERLIST_CHANNEL, MAGNUS_SERVERSTATE_CHANNEL } from "./integrations/magnus/protocol.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  loadOptionalDotEnv();
  const env = loadEnv();
  const log = createLogger(env.LOG_LEVEL);
  const config = loadPersonaConfig(env.PERSONA_CONFIG_PATH);

  log.info(
    {
      personaId: config.id,
      displayName: config.displayName,
      redisHost: env.REDIS_HOST,
      redisPort: env.REDIS_PORT,
      hasRedisPassword: Boolean(env.REDIS_PASSWORD),
      startupGreeting: env.STARTUP_GREETING,
      startupGreetingDelayMs: env.STARTUP_GREETING_DELAY_MS,
    },
    "starting persona agent",
  );

  log.info("creating redis client");
  const redis = createRedisClient({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
    log: log.child({ component: "redis" }),
  });

  let redisClockOffsetMs = 0;
  try {
    const redisNow = await redis.time();
    redisClockOffsetMs = redisNow - Date.now();
    log.info({ redisClockOffsetMs }, "measured redis clock offset");
  } catch (err) {
    log.warn({ err }, "failed to measure redis clock offset, using local clock");
  }

  log.debug({ redisClockOffsetMs }, "creating magnus message signer");
  const signer = new MessageSigner(
    env.MAGNUS_MESSAGE_SIGNING_SECRET,
    () => Date.now() + redisClockOffsetMs,
  );

  log.debug({ baseURL: env.LLM_BASE_URL, model: env.LLM_MODEL }, "creating llm provider");
  const llm = new LlmProvider({
    baseURL: env.LLM_BASE_URL,
    apiKey: env.LLM_API_KEY,
    defaultModel: env.LLM_MODEL,
    timeoutMs: env.LLM_TIMEOUT_MS,
  });

  const publisher = new ChatPublisher(redis, signer, log.child({ component: "chat-publisher" }), config.id);
  const chatSub = new ChatSubscriber(redis, signer, log.child({ component: "chat-subscriber" }));
  const playerListSub = new PlayerListSubscriber(
    redis,
    signer,
    log.child({ component: "playerlist-subscriber" }),
  );
  const serverStateSub = new ServerStateSubscriber(redis, signer, log.child({ component: "serverstate-subscriber" }));

  const actionRegistry = new ActionRegistry();
  const agent = new AgentRuntime(config, llm, publisher, actionRegistry, log);
  if (config.actions.enabled && actionRegistry.count === 0) {
    log.warn("actions enabled in config but no actions registered");
  }

  log.info({ channel: MAGNUS_CHAT_CHANNEL }, "subscribing to magnus chat");
  await chatSub.subscribe((msg) => {
    agent.onChat(msg);
  });

  log.info({ channel: MAGNUS_PLAYERLIST_CHANNEL }, "subscribing to magnus player list");
  await playerListSub.subscribe((info) => {
    agent.onPlayerList(info);
  });

  log.info({ channel: MAGNUS_SERVERSTATE_CHANNEL }, "subscribing to magnus server state");
  await serverStateSub.subscribe((info) => {
    agent.onServerState(info);
  });

  const closeHealth = startHealthServer(env.HEALTH_PORT, log);
  log.info({ healthPort: env.HEALTH_PORT }, "health server started");

  const shutdown = async () => {
    log.info("shutting down");
    closeHealth();
    await chatSub.unsubscribe();
    await playerListSub.unsubscribe();
    await serverStateSub.unsubscribe();
    redis.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  log.info(
    {
      actions: actionRegistry.count,
      triggers: config.triggers,
      subscribedChannels: [MAGNUS_CHAT_CHANNEL, MAGNUS_PLAYERLIST_CHANNEL, MAGNUS_SERVERSTATE_CHANNEL],
      healthPort: env.HEALTH_PORT,
      logLevel: env.LOG_LEVEL,
    },
    "agent ready",
  );

  if (env.STARTUP_GREETING) {
    if (env.STARTUP_GREETING_DELAY_MS > 0) {
      log.info({ startupGreetingDelayMs: env.STARTUP_GREETING_DELAY_MS }, "waiting before startup greeting");
      await sleep(env.STARTUP_GREETING_DELAY_MS);
    }

    log.info("generating startup greeting");
    try {
      await agent.publishStartupGreeting();
    } catch (err) {
      log.error({ err }, "failed to publish startup greeting");
    }
  }
}

main().catch((err) => {
  console.error("fatal startup error", err);
  process.exit(1);
});
