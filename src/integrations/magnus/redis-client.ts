import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const IORedis = require("ioredis");

interface RedisInstance {
  publish(channel: string, message: string): Promise<number>;
  subscribe(...channels: string[]): Promise<void>;
  unsubscribe(...channels: string[]): Promise<void>;
  on(event: "message", listener: (channel: string, message: string) => void): void;
  disconnect(): void;
}

export interface RedisClient {
  publish(channel: string, message: string): Promise<number>;
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

export function createRedisClient(options: {
  host: string;
  port: number;
  password?: string;
}): RedisClient {
  const pub = newConnection(options);
  const sub = newConnection(options);

  return {
    async publish(channel: string, message: string): Promise<number> {
      return pub.publish(channel, message);
    },
    async subscribe(channel: string, callback: (channel: string, message: string) => void): Promise<void> {
      await sub.subscribe(channel);
      sub.on("message", (ch: string, msg: string) => {
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
