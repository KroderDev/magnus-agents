import { loadOptionalDotEnv } from "../src/config/dotenv.js";
import { loadEnv } from "../src/config/env.js";
import { createLogger } from "../src/transport/logger.js";
import { createRedisClient } from "../src/integrations/magnus/redis-client.js";
import { MessageSigner } from "../src/integrations/magnus/signer.js";
import { ChatPublisher } from "../src/integrations/magnus/chat-publisher.js";

async function main(): Promise<void> {
  loadOptionalDotEnv();
  const env = loadEnv();
  const log = createLogger(env.LOG_LEVEL);
  const message = process.argv[2] ?? "Hola cabros, llego el profe.";
  const personaId = process.argv[3] ?? "profesor-gepeto";
  const displayName = process.argv[4] ?? "Profesor Gepeto";

  const redis = createRedisClient({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
    log: log.child({ component: "redis-script" }),
  });

  let redisClockOffsetMs = 0;
  try {
    const redisNow = await redis.time();
    redisClockOffsetMs = redisNow - Date.now();
  } catch (err) {
    log.warn({ err }, "failed to measure redis clock offset, using local clock");
  }

  const signer = new MessageSigner(
    env.MAGNUS_MESSAGE_SIGNING_SECRET,
    () => Date.now() + redisClockOffsetMs,
  );
  const publisher = new ChatPublisher(
    redis,
    signer,
    log.child({ component: "chat-publisher-script" }),
    personaId,
  );

  try {
    const listeners = await publisher.publish({
      personaId,
      displayName,
      rawMessage: message,
    });
    log.info({ listeners, redisClockOffsetMs, personaId, displayName, message }, "chat message published");
  } finally {
    redis.close();
  }
}

main().catch((err) => {
  console.error("failed to send chat message", err);
  process.exit(1);
});
