export interface ChatMessage {
  serverName: string;
  playerUuid: string;
  playerName: string;
  rawMessage: string;
  timestamp: number;
}

export interface PlayerEntry {
  uuid: string;
  name: string;
}

export interface ServerPlayerInfo {
  serverName: string;
  players: PlayerEntry[];
  timestamp: number;
}

export interface PersonaMessage {
  personaId: string;
  displayName: string;
  rawMessage: string;
  targetServers?: string[];
}
