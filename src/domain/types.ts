export interface ChatMessage {
  serverName: string;
  playerUuid: string;
  playerName: string;
  rawMessage: string;
  timestamp: number;
  targetServers?: string[];
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

export interface WorldStateInfo {
  dimension: string;
  timeOfDay: number;
  dayNumber: number;
  phase: string;
  isDay: boolean;
  isRaining: boolean;
  isThundering: boolean;
}

export interface ServerStateInfo {
  serverName: string;
  playerCount: number;
  maxPlayers: number;
  worlds: WorldStateInfo[];
  timestamp: number;
}

export interface PersonaMessage {
  personaId: string;
  displayName: string;
  rawMessage: string;
  targetServers?: string[];
}
