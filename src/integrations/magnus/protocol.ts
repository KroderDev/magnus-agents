import type { ChatMessage, PersonaMessage, ServerPlayerInfo } from "../../domain/types.js";

export const MAGNUS_CHAT_CHANNEL = "magnus:chat";
export const MAGNUS_PLAYERLIST_CHANNEL = "magnus:playerlist";

export const PERSONA_UUID_PREFIX = "persona:";

export function isPersonaMessage(playerUuid: string): boolean {
  return playerUuid.startsWith(PERSONA_UUID_PREFIX);
}

export function encodeChatMessage(msg: ChatMessage): string {
  return JSON.stringify(msg);
}

export function decodeChatMessage(raw: string): ChatMessage | null {
  try {
    const obj = JSON.parse(raw);
    if (
      typeof obj.serverName !== "string" ||
      typeof obj.playerUuid !== "string" ||
      typeof obj.playerName !== "string" ||
      typeof obj.rawMessage !== "string"
    ) {
      return null;
    }
    return {
      serverName: obj.serverName,
      playerUuid: obj.playerUuid,
      playerName: obj.playerName,
      rawMessage: obj.rawMessage,
      timestamp: typeof obj.timestamp === "number" ? obj.timestamp : Date.now(),
    };
  } catch {
    return null;
  }
}

export function decodePlayerList(raw: string): ServerPlayerInfo | null {
  try {
    const obj = JSON.parse(raw);
    if (typeof obj.serverName !== "string" || !Array.isArray(obj.players)) {
      return null;
    }
    return {
      serverName: obj.serverName,
      players: obj.players.map((p: { uuid: string; name: string }) => ({
        uuid: String(p.uuid),
        name: String(p.name),
      })),
      timestamp: typeof obj.timestamp === "number" ? obj.timestamp : Date.now(),
    };
  } catch {
    return null;
  }
}

export function buildChatMessage(persona: PersonaMessage, agentServerName: string): ChatMessage {
  return {
    serverName: agentServerName,
    playerUuid: `${PERSONA_UUID_PREFIX}${persona.personaId}`,
    playerName: persona.displayName,
    rawMessage: persona.rawMessage,
    timestamp: Date.now(),
  };
}
