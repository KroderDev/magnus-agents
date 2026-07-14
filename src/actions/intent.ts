import type { PersonaConfig } from "../config/persona.js";
import type { ActionRegistry } from "./registry.js";
import type { ActionRequest, AgentAction } from "./types.js";

const PLAYER_NAME_PATTERN = "([A-Za-z0-9_]{2,16})";

export function isActionAllowed(action: AgentAction, config: PersonaConfig["actions"]): boolean {
  if (!config.enabled || config.mode === "off") {
    return false;
  }

  if (config.readOnlyOnly && action.readOnly === false) {
    return false;
  }

  return config.allowed.includes("*") || config.allowed.includes(action.id);
}

export function detectActionRequest(
  text: string,
  sourceServer: string,
  registry: ActionRegistry,
  config: PersonaConfig["actions"],
): ActionRequest | null {
  const explicit = matchExplicitAction(text, sourceServer, registry, config);
  if (explicit) {
    return explicit;
  }

  if (config.mode === "explicit") {
    return null;
  }

  const lower = text.toLowerCase();
  const requestedServer = extractServerName(lower) ?? sourceServer;

  const wherePlayer = matchWhereIsPlayer(text, registry, config);
  if (wherePlayer) {
    return wherePlayer;
  }

  if (matchesAllowed("server_weather", registry, config) && /\b(weather|rain|raining|clima|llueve|lloviendo)\b/i.test(text)) {
    return { id: "server_weather", input: { serverName: requestedServer }, reason: "weather-question" };
  }

  if (matchesAllowed("world_time", registry, config) && /\b(time|hora|day|night|dia|d[ií]a|noche)\b/i.test(text)) {
    return { id: "world_time", input: { serverName: requestedServer }, reason: "time-question" };
  }

  if (
    matchesAllowed("server_population", registry, config)
    && /\b(how many players|player count|population|poblaci[oó]n|cu[aá]ntos jugadores)\b/i.test(text)
  ) {
    return { id: "server_population", input: { serverName: requestedServer }, reason: "population-question" };
  }

  if (
    matchesAllowed("players_on_server", registry, config)
    && /\b(players on|players in|who is on|quien esta en|qui[eé]n est[aá] en)\b/i.test(text)
  ) {
    return { id: "players_on_server", input: { serverName: requestedServer }, reason: "server-player-question" };
  }

  if (
    matchesAllowed("who_is_online", registry, config)
    && /\b(who is online|who's online|online players|qui[eé]n est[aá] online|quienes estan online|qui[eé]nes est[aá]n online)\b/i.test(text)
  ) {
    return { id: "who_is_online", input: {}, reason: "online-player-question" };
  }

  if (matchesAllowed("server_status", registry, config) && /\b(server status|estado del server|estado servidor)\b/i.test(text)) {
    return { id: "server_status", input: { serverName: requestedServer }, reason: "server-status-question" };
  }

  return null;
}

function matchExplicitAction(
  text: string,
  sourceServer: string,
  registry: ActionRegistry,
  config: PersonaConfig["actions"],
): ActionRequest | null {
  const explicit = /\b(?:tool|action):\s*([a-z0-9_-]+)/i.exec(text);
  if (!explicit) {
    return null;
  }

  const actionId = explicit[1];
  if (!matchesAllowed(actionId, registry, config)) {
    return null;
  }

  return { id: actionId, input: { serverName: sourceServer }, reason: "explicit-action-request" };
}

function matchWhereIsPlayer(text: string, registry: ActionRegistry, config: PersonaConfig["actions"]): ActionRequest | null {
  if (!matchesAllowed("where_is_player", registry, config)) {
    return null;
  }

  const patterns = [
    new RegExp(`\\bwhere\\s+(?:is|isn't|isnt|s)\\s+${PLAYER_NAME_PATTERN}`, "i"),
    new RegExp(`\\bd[oó]nde\\s+est[aá]\\s+${PLAYER_NAME_PATTERN}`, "i"),
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match?.[1]) {
      return { id: "where_is_player", input: { playerName: match[1] }, reason: "player-location-question" };
    }
  }

  return null;
}

function matchesAllowed(id: string, registry: ActionRegistry, config: PersonaConfig["actions"]): boolean {
  const action = registry.get(id);
  return Boolean(action && isActionAllowed(action, config));
}

function extractServerName(lowerText: string): string | null {
  const match = /\b(?:on|in|en)\s+([a-z0-9_-]{2,32})\b/i.exec(lowerText);
  return match?.[1] ?? null;
}
