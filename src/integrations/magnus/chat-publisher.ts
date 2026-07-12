import type { PersonaMessage } from "../../domain/types.js";
import type { RedisClient } from "./redis-client.js";
import { MessageSigner } from "./signer.js";
import type { Logger } from "pino";
import {
  MAGNUS_CHAT_CHANNEL,
  buildChatMessage,
  encodeChatMessage,
} from "./protocol.js";

export class ChatPublisher {
  private readonly agentServerName: string;

  constructor(
    private readonly redis: RedisClient,
    private readonly signer: MessageSigner,
    private readonly log: Logger,
    personaId: string,
  ) {
    this.agentServerName = `agent:${personaId}`;
  }

  async publish(persona: PersonaMessage): Promise<number> {
    const msg = buildChatMessage(persona, this.agentServerName);
    const encoded = encodeChatMessage(msg);
    const signed = this.signer.sign(encoded);

    this.log.info(
      {
        channel: MAGNUS_CHAT_CHANNEL,
        server: msg.serverName,
        playerUuid: msg.playerUuid,
        playerName: msg.playerName,
        text: msg.rawMessage.slice(0, 180),
      },
      "publishing persona chat message",
    );

    const listeners = await this.redis.publish(MAGNUS_CHAT_CHANNEL, signed);
    this.log.info({ channel: MAGNUS_CHAT_CHANNEL, listeners }, "persona chat message published");
    return listeners;
  }
}
