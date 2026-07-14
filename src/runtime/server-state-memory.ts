import type { ServerStateInfo, WorldStateInfo } from "../domain/types.js";

export class ServerStateMemory {
  private readonly states = new Map<string, ServerStateInfo>();

  update(info: ServerStateInfo): void {
    this.states.set(info.serverName, info);
  }

  get(serverName: string): ServerStateInfo | undefined {
    return this.states.get(serverName);
  }

  list(): ServerStateInfo[] {
    return [...this.states.values()];
  }

  findWorld(serverName: string, dimension?: string): { state: ServerStateInfo; world: WorldStateInfo } | null {
    const state = this.states.get(serverName);
    if (!state) {
      return null;
    }

    const world = dimension
      ? state.worlds.find((candidate) => candidate.dimension === dimension)
      : state.worlds.find((candidate) => candidate.dimension === "minecraft:overworld") ?? state.worlds[0];

    return world ? { state, world } : null;
  }
}
