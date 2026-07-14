import type { ServerStateInfo } from "../../domain/types.js";
import type { RedisClient } from "./redis-client.js";
import { MessageSigner } from "./signer.js";
import { MAGNUS_SERVERSTATE_CHANNEL, decodeServerState } from "./protocol.js";
import type { Logger } from "pino";

export type ServerStateHandler = (info: ServerStateInfo) => void;

export class ServerStateSubscriber {
  constructor(
    private readonly redis: RedisClient,
    private readonly signer: MessageSigner,
    private readonly log: Logger,
  ) {}

  async subscribe(handler: ServerStateHandler): Promise<void> {
    await this.redis.subscribe(MAGNUS_SERVERSTATE_CHANNEL, (_channel, raw) => {
      this.log.debug({ bytes: raw.length }, "received raw magnus server state message");

      const payload = this.signer.verify(raw);
      if (!payload) {
        this.log.debug("dropping magnus server state message with invalid or expired signature");
        return;
      }

      const info = decodeServerState(payload);
      if (!info) {
        this.log.debug("dropping magnus server state message with invalid payload shape");
        return;
      }

      handler(info);
    });
  }

  async unsubscribe(): Promise<void> {
    await this.redis.unsubscribe(MAGNUS_SERVERSTATE_CHANNEL);
  }
}
