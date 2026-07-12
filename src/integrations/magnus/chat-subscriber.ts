import type { ChatMessage } from "../../domain/types.js";
import type { RedisClient } from "./redis-client.js";
import { MessageSigner } from "./signer.js";
import {
  MAGNUS_CHAT_CHANNEL,
  decodeChatMessage,
  isPersonaMessage,
} from "./protocol.js";

export type ChatHandler = (msg: ChatMessage) => void;

export class ChatSubscriber {
  constructor(
    private readonly redis: RedisClient,
    private readonly signer: MessageSigner,
  ) {}

  async subscribe(handler: ChatHandler): Promise<void> {
    await this.redis.subscribe(MAGNUS_CHAT_CHANNEL, (_channel, raw) => {
      const payload = this.signer.verify(raw);
      if (!payload) return;

      const msg = decodeChatMessage(payload);
      if (!msg) return;

      if (isPersonaMessage(msg.playerUuid)) return;

      handler(msg);
    });
  }

  async unsubscribe(): Promise<void> {
    await this.redis.unsubscribe(MAGNUS_CHAT_CHANNEL);
  }
}
