import type { ChatMessage } from "../../domain/types.js";
import type { RedisClient } from "./redis-client.js";
import { MessageSigner } from "./signer.js";
import type { Logger } from "pino";
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
    private readonly log: Logger,
  ) {}

  async subscribe(handler: ChatHandler): Promise<void> {
    await this.redis.subscribe(MAGNUS_CHAT_CHANNEL, (_channel, raw) => {
      this.log.debug({ bytes: raw.length }, "received raw magnus chat message");

      const payload = this.signer.verify(raw);
      if (!payload) {
        this.log.debug("dropping magnus chat message with invalid or expired signature");
        return;
      }

      const msg = decodeChatMessage(payload);
      if (!msg) {
        this.log.debug("dropping magnus chat message with invalid payload shape");
        return;
      }

      if (isPersonaMessage(msg.playerUuid)) {
        this.log.debug({ playerUuid: msg.playerUuid }, "ignoring persona chat message");
        return;
      }

      handler(msg);
    });
  }

  async unsubscribe(): Promise<void> {
    await this.redis.unsubscribe(MAGNUS_CHAT_CHANNEL);
  }
}
