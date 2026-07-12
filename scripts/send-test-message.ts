import { createHmac } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const IORedis = require("ioredis");

const SECRET = process.env.MAGNUS_MESSAGE_SIGNING_SECRET;
if (!SECRET) {
  console.error("Set MAGNUS_MESSAGE_SIGNING_SECRET env var (same as the agent)");
  process.exit(1);
}

const REDIS_HOST = process.env.REDIS_HOST ?? "127.0.0.1";
const REDIS_PORT = Number(process.env.REDIS_PORT ?? 6379);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;
const CHANNEL = "magnus:chat";

const message = process.argv[2] || "Hola Profesor Gepeto!";
const playerName = process.argv[3] || "TestPlayer";

// Use a fake Minecraft UUID (not starting with "persona:" so it isn't filtered)
const uuid = "00000000-0000-0000-0000-000000000001";

function sign(payload: string): string {
  const timestamp = Number(process.env.MAGNUS_FIXED_TIMESTAMP ?? Date.now());
  const data = `${timestamp}|${payload}`;
  const hmac = createHmac("sha256", SECRET!).update(data).digest("base64");
  return `${hmac}|${data}`;
}

const chatMsg = {
  serverName: "lobby",
  playerUuid: uuid,
  playerName,
  rawMessage: message,
  timestamp: Date.now(),
};

const encoded = JSON.stringify(chatMsg);

const redis = new IORedis({ host: REDIS_HOST, port: REDIS_PORT, password: REDIS_PASSWORD });

redis.time().then(([seconds, microseconds]) => {
  const redisTimestampMs = Number(seconds) * 1000 + Math.floor(Number(microseconds) / 1000);
  process.env.MAGNUS_FIXED_TIMESTAMP = String(redisTimestampMs);

  return redis.publish(CHANNEL, sign(encoded)).then((n) => {
    console.log(`published to ${CHANNEL} (${n} listener(s))`);
    console.log(`  player: ${playerName}`);
    console.log(`  message: ${message}`);
    console.log(`  timestamp: ${redisTimestampMs}`);
  });
}).finally(() => {
  redis.disconnect();
});
