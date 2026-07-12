import type { ServerPlayerInfo } from "../../domain/types.js";
import type { RedisClient } from "./redis-client.js";
import { MessageSigner } from "./signer.js";
import { MAGNUS_PLAYERLIST_CHANNEL, decodePlayerList } from "./protocol.js";

export type PlayerListHandler = (info: ServerPlayerInfo) => void;

export class PlayerListSubscriber {
  constructor(
    private readonly redis: RedisClient,
    private readonly signer: MessageSigner,
  ) {}

  async subscribe(handler: PlayerListHandler): Promise<void> {
    await this.redis.subscribe(MAGNUS_PLAYERLIST_CHANNEL, (_channel, raw) => {
      const payload = this.signer.verify(raw);
      if (!payload) return;

      const info = decodePlayerList(payload);
      if (!info) return;

      handler(info);
    });
  }

  async unsubscribe(): Promise<void> {
    await this.redis.unsubscribe(MAGNUS_PLAYERLIST_CHANNEL);
  }
}
