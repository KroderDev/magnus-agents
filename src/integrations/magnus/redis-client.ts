import { createRequire } from "node:module";
import type { Logger } from "pino";

const require = createRequire(import.meta.url);
const IORedis = require("ioredis");

interface RedisInstance {
  publish(channel: string, message: string): Promise<number>;
  time(): Promise<[string, string]>;
  subscribe(...channels: string[]): Promise<void>;
  unsubscribe(...channels: string[]): Promise<void>;
  on(event: string, listener: (...args: unknown[]) => void): void;
  disconnect(): void;
}

export interface RedisClient {
  publish(channel: string, message: string): Promise<number>;
  time(): Promise<number>;
  subscribe(channel: string, callback: (channel: string, message: string) => void): Promise<void>;
  unsubscribe(channel: string): Promise<void>;
  close(): void;
}

function newConnection(options: { host: string; port: number; password?: string }): RedisInstance {
  return new IORedis({
    host: options.host,
    port: options.port,
    password: options.password || undefined,
    lazyConnect: false,
    retryStrategy(times: number) {
      if (times > 10) return null;
      return Math.min(times * 200, 3000);
    },
  });
}

function attachConnectionLogging(connection: RedisInstance, connectionName: "pub" | "sub", log: Logger): void {
  connection.on("connect", () => {
    log.debug({ connection: connectionName }, "redis connection established");
  });
  connection.on("ready", () => {
    log.info({ connection: connectionName }, "redis connection ready");
  });
  connection.on("reconnecting", (delay: unknown) => {
    log.warn({ connection: connectionName, delay }, "redis reconnecting");
  });
  connection.on("close", () => {
    log.debug({ connection: connectionName }, "redis connection closed");
  });
  connection.on("end", () => {
    log.warn({ connection: connectionName }, "redis connection ended");
  });
  connection.on("error", (err: unknown) => {
    log.error({ connection: connectionName, err }, "redis connection error");
  });
}

export function createRedisClient(options: {
  host: string;
  port: number;
  password?: string;
  log: Logger;
}): RedisClient {
  const pub = newConnection(options);
  const sub = newConnection(options);

  attachConnectionLogging(pub, "pub", options.log);
  attachConnectionLogging(sub, "sub", options.log);

  return {
    async publish(channel: string, message: string): Promise<number> {
      return pub.publish(channel, message);
    },
    async time(): Promise<number> {
      const [seconds, microseconds] = await pub.time();
      return Number(seconds) * 1000 + Math.floor(Number(microseconds) / 1000);
    },
    async subscribe(channel: string, callback: (channel: string, message: string) => void): Promise<void> {
      await sub.subscribe(channel);
      options.log.info({ channel }, "redis subscription active");
      sub.on("message", (...args: unknown[]) => {
        const [ch, msg] = args;
        if (typeof ch !== "string" || typeof msg !== "string") {
          return;
        }

        if (ch === channel) {
          callback(ch, msg);
        }
      });
    },
    async unsubscribe(channel: string): Promise<void> {
      await sub.unsubscribe(channel);
    },
    close(): void {
      pub.disconnect();
      sub.disconnect();
    },
  };
}
