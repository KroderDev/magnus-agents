import type { AgentAction } from "./types.js";
import type { ActionRegistry } from "./registry.js";
import type { MessageMemory } from "../runtime/memory.js";
import type { ServerStateMemory } from "../runtime/server-state-memory.js";

const DEFAULT_TIMEOUT_MS = 1000;

export function registerBuiltinActions(
  registry: ActionRegistry,
  memory: MessageMemory,
  serverState: ServerStateMemory,
): void {
  registerIfMissing(registry, playersOnServerAction(memory));
  registerIfMissing(registry, whoIsOnlineAction(memory));
  registerIfMissing(registry, serverPopulationAction(memory, serverState));
  registerIfMissing(registry, whereIsPlayerAction(memory));
  registerIfMissing(registry, worldTimeAction(serverState));
  registerIfMissing(registry, serverWeatherAction(serverState));
  registerIfMissing(registry, serverStatusAction(memory, serverState));
}

function registerIfMissing(registry: ActionRegistry, action: AgentAction): void {
  if (!registry.get(action.id)) {
    registry.register(action);
  }
}

function playersOnServerAction(memory: MessageMemory): AgentAction {
  return {
    id: "players_on_server",
    title: "Players on server",
    description: "Lists currently visible players on one server from Magnus heartbeats.",
    readOnly: true,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    inputSchema: { type: "object", properties: { serverName: { type: "string" } } },
    execute: async (input, ctx) => {
      const serverName = stringInput(input, "serverName") ?? ctx.sourceServer;
      const players = memory.getPlayersByServer().get(serverName) ?? [];
      const output = players.length > 0
        ? `${serverName} currently has ${players.length} visible player(s): ${players.join(", ")}.`
        : `${serverName} currently has no visible players in recent Magnus heartbeats.`;
      return { success: true, output };
    },
  };
}

function whoIsOnlineAction(memory: MessageMemory): AgentAction {
  return {
    id: "who_is_online",
    title: "Who is online",
    description: "Lists visible online players grouped by server from Magnus heartbeats.",
    readOnly: true,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    inputSchema: { type: "object", properties: {} },
    execute: async () => {
      const playersByServer = memory.getPlayersByServer();
      if (playersByServer.size === 0) {
        return { success: true, output: "No recent Magnus player-list heartbeats are available." };
      }

      const output = [...playersByServer.entries()]
        .map(([serverName, players]) => (
          players.length > 0 ? `${serverName}: ${players.join(", ")}` : `${serverName}: no visible players`
        ))
        .join("; ");
      return { success: true, output };
    },
  };
}

function serverPopulationAction(memory: MessageMemory, serverState: ServerStateMemory): AgentAction {
  return {
    id: "server_population",
    title: "Server population",
    description: "Reports visible player counts for one server or the whole network.",
    readOnly: true,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    inputSchema: { type: "object", properties: { serverName: { type: "string" } } },
    execute: async (input, ctx) => {
      const requestedServer = stringInput(input, "serverName");
      if (requestedServer) {
        const state = serverState.get(requestedServer);
        const players = memory.getPlayersByServer().get(requestedServer) ?? [];
        const maxPlayers = state ? `/${state.maxPlayers}` : "";
        return { success: true, output: `${requestedServer} has ${players.length}${maxPlayers} visible player(s).` };
      }

      const totalPlayers = memory.getTotalPlayers();
      const currentServer = serverState.get(ctx.sourceServer);
      const currentMax = currentServer ? ` ${ctx.sourceServer} max players: ${currentServer.maxPlayers}.` : "";
      return { success: true, output: `Total visible players across Magnus heartbeats: ${totalPlayers}.${currentMax}` };
    },
  };
}

function whereIsPlayerAction(memory: MessageMemory): AgentAction {
  return {
    id: "where_is_player",
    title: "Where is player",
    description: "Finds the server where a visible player is currently online.",
    readOnly: true,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    inputSchema: { type: "object", properties: { playerName: { type: "string" } }, required: ["playerName"] },
    execute: async (input) => {
      const playerName = stringInput(input, "playerName");
      if (!playerName) {
        return { success: false, error: "Missing playerName." };
      }

      const needle = playerName.toLowerCase();
      for (const [serverName, players] of memory.getPlayersByServer()) {
        const match = players.find((candidate) => candidate.toLowerCase() === needle);
        if (match) {
          return { success: true, output: `${match} is currently visible on ${serverName}.` };
        }
      }

      return { success: true, output: `${playerName} is not visible in recent Magnus player-list heartbeats.` };
    },
  };
}

function worldTimeAction(serverState: ServerStateMemory): AgentAction {
  return {
    id: "world_time",
    title: "World time",
    description: "Reports current Minecraft world time from Magnus server-state heartbeats.",
    readOnly: true,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    inputSchema: { type: "object", properties: { serverName: { type: "string" }, dimension: { type: "string" } } },
    execute: async (input, ctx) => {
      const serverName = stringInput(input, "serverName") ?? ctx.sourceServer;
      const dimension = stringInput(input, "dimension");
      const found = serverState.findWorld(serverName, dimension ?? undefined);
      if (!found) {
        return { success: false, error: `No recent server-state heartbeat is available for ${serverName}.` };
      }

      const { state, world } = found;
      return {
        success: true,
        output: [
          `${serverName} ${world.dimension} is currently ${world.phase}.`,
          `timeOfDay=${world.timeOfDay}, dayNumber=${world.dayNumber}, isDay=${world.isDay}.`,
          `Observed at ${new Date(state.timestamp).toISOString()} from Magnus server-state heartbeat.`,
        ].join(" "),
      };
    },
  };
}

function serverWeatherAction(serverState: ServerStateMemory): AgentAction {
  return {
    id: "server_weather",
    title: "Server weather",
    description: "Reports current weather from Magnus server-state heartbeats.",
    readOnly: true,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    inputSchema: { type: "object", properties: { serverName: { type: "string" }, dimension: { type: "string" } } },
    execute: async (input, ctx) => {
      const serverName = stringInput(input, "serverName") ?? ctx.sourceServer;
      const dimension = stringInput(input, "dimension");
      const found = serverState.findWorld(serverName, dimension ?? undefined);
      if (!found) {
        return { success: false, error: `No recent server-state heartbeat is available for ${serverName}.` };
      }

      const { state, world } = found;
      const weather = world.isThundering ? "thundering" : world.isRaining ? "raining" : "clear";
      return {
        success: true,
        output: `${serverName} ${world.dimension} weather is ${weather}. Observed at ${new Date(state.timestamp).toISOString()}.`,
      };
    },
  };
}

function serverStatusAction(memory: MessageMemory, serverState: ServerStateMemory): AgentAction {
  return {
    id: "server_status",
    title: "Server status",
    description: "Summarizes recent player and world state for a server.",
    readOnly: true,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    inputSchema: { type: "object", properties: { serverName: { type: "string" } } },
    execute: async (input, ctx) => {
      const serverName = stringInput(input, "serverName") ?? ctx.sourceServer;
      const players = memory.getPlayersByServer().get(serverName) ?? [];
      const state = serverState.get(serverName);
      if (!state) {
        return {
          success: true,
          output: `${serverName} has ${players.length} visible player(s), but no recent server-state heartbeat is available.`,
        };
      }

      const worlds = state.worlds.map((world) => `${world.dimension}: ${world.phase}`).join(", ");
      return {
        success: true,
        output: `${serverName} has ${players.length}/${state.maxPlayers} visible player(s). Worlds: ${worlds || "none"}.`,
      };
    },
  };
}

function stringInput(input: unknown, key: string): string | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return null;
  }

  const value = (input as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
