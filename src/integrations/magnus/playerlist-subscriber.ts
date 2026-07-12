import type { ServerPlayerInfo } from "../../domain/types.js";
import type { RedisClient } from "./redis-client.js";
import { MessageSigner } from "./signer.js";
import { MAGNUS_PLAYERLIST_CHANNEL, decodePlayerList } from "./protocol.js";
import type { Logger } from "pino";

export type PlayerListHandler = (info: ServerPlayerInfo) => void;

export class PlayerListSubscriber {
  constructor(
    private readonly redis: RedisClient,
    private readonly signer: MessageSigner,
    private readonly log: Logger,
  ) {}

  async subscribe(handler: PlayerListHandler): Promise<void> {
    await this.redis.subscribe(MAGNUS_PLAYERLIST_CHANNEL, (_channel, raw) => {
      this.log.debug({ bytes: raw.length }, "received raw magnus player list message");

      const payload = this.signer.verify(raw);
      if (!payload) {
        this.log.debug("dropping magnus player list message with invalid or expired signature");
        return;
      }

      const info = decodePlayerList(payload);
      if (!info) {
        this.log.debug("dropping magnus player list message with invalid payload shape");
        return;
      }

      handler(info);
    });
  }

  async unsubscribe(): Promise<void> {
    await this.redis.unsubscribe(MAGNUS_PLAYERLIST_CHANNEL);
  }
}
