import type { ChatMessage, ServerPlayerInfo } from "../domain/types.js";

export interface MemoryEntry {
  role: "system" | "user" | "assistant";
  content: string;
}

export class MessageMemory {
  private readonly maxMessages: number;
  private recentMessages: ChatMessage[] = [];
  private playerList = new Map<string, ServerPlayerInfo>();

  constructor(maxMessages: number) {
    this.maxMessages = maxMessages;
  }

  addChatMessage(msg: ChatMessage): void {
    this.recentMessages.push(msg);
    if (this.recentMessages.length > this.maxMessages) {
      this.recentMessages = this.recentMessages.slice(-this.maxMessages);
    }
  }

  updatePlayerList(info: ServerPlayerInfo): void {
    this.playerList.set(info.serverName, info);
  }

  getRecentMessages(): ChatMessage[] {
    return this.recentMessages;
  }

  getPlayersByServer(): Map<string, string[]> {
    const result = new Map<string, string[]>();
    for (const [server, info] of this.playerList) {
      result.set(server, info.players.map((p) => p.name));
    }
    return result;
  }

  getTotalPlayers(): number {
    let count = 0;
    for (const [, info] of this.playerList) {
      count += info.players.length;
    }
    return count;
  }

  buildContextMessages(systemPrompt: string): MemoryEntry[] {
    const entries: MemoryEntry[] = [
      { role: "system", content: systemPrompt },
    ];

    for (const msg of this.recentMessages) {
      entries.push({
        role: "user",
        content: `${msg.playerName} (${msg.serverName}): ${msg.rawMessage}`,
      });
    }

    return entries;
  }
}
