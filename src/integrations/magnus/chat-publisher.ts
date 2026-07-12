import { type PersonaMessage, type ChatMessage } from "../../domain/types.js";
import type { RedisClient } from "./redis-client.js";
import { MessageSigner } from "./signer.js";
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
    personaId: string,
  ) {
    this.agentServerName = `agent:${personaId}`;
  }

  publish(persona: PersonaMessage): Promise<number> {
    const msg = buildChatMessage(persona, this.agentServerName);
    const encoded = encodeChatMessage(msg);
    const signed = this.signer.sign(encoded);
    return this.redis.publish(MAGNUS_CHAT_CHANNEL, signed);
  }
}
