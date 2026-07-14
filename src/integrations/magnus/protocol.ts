import type { ChatMessage, PersonaMessage, ServerPlayerInfo, ServerStateInfo } from "../../domain/types.js";

export const MAGNUS_CHAT_CHANNEL = "magnus:chat";
export const MAGNUS_PLAYERLIST_CHANNEL = "magnus:playerlist";
export const MAGNUS_SERVERSTATE_CHANNEL = "magnus:serverstate";

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
      targetServers: Array.isArray(obj.targetServers)
        ? obj.targetServers.map((server: unknown) => String(server))
        : undefined,
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

export function decodeServerState(raw: string): ServerStateInfo | null {
  try {
    const obj = JSON.parse(raw);
    if (
      typeof obj.serverName !== "string"
      || typeof obj.playerCount !== "number"
      || typeof obj.maxPlayers !== "number"
      || !Array.isArray(obj.worlds)
    ) {
      return null;
    }

    return {
      serverName: obj.serverName,
      playerCount: obj.playerCount,
      maxPlayers: obj.maxPlayers,
      worlds: obj.worlds.map((world: {
        dimension: string;
        timeOfDay: number;
        dayNumber: number;
        phase: string;
        isDay: boolean;
        isRaining: boolean;
        isThundering: boolean;
      }) => ({
        dimension: String(world.dimension),
        timeOfDay: Number(world.timeOfDay),
        dayNumber: Number(world.dayNumber),
        phase: String(world.phase),
        isDay: Boolean(world.isDay),
        isRaining: Boolean(world.isRaining),
        isThundering: Boolean(world.isThundering),
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
    targetServers: persona.targetServers,
  };
}
