import type { ChatMessage, ServerPlayerInfo } from "../domain/types.js";
import type { LlmMessage } from "../integrations/llm/types.js";

interface AssistantMemoryEntry {
  kind: "assistant";
  serverName: string;
  content: string;
  timestamp: number;
}

interface ChatMemoryEntry {
  kind: "chat";
  message: ChatMessage;
}

type MemoryEntry = ChatMemoryEntry | AssistantMemoryEntry;

export class MessageMemory {
  private readonly maxMessages: number;
  private recentMessages: ChatMessage[] = [];
  private recentEntries: MemoryEntry[] = [];
  private playerList = new Map<string, ServerPlayerInfo>();

  constructor(maxMessages: number) {
    this.maxMessages = maxMessages;
  }

  addChatMessage(msg: ChatMessage): void {
    this.recentMessages.push(msg);
    if (this.recentMessages.length > this.maxMessages) {
      this.recentMessages = this.recentMessages.slice(-this.maxMessages);
    }

    this.recentEntries.push({ kind: "chat", message: msg });
    this.trimEntries();
  }

  addAssistantMessage(serverName: string, content: string, timestamp: number = Date.now()): void {
    this.recentEntries.push({ kind: "assistant", serverName, content, timestamp });
    this.trimEntries();
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

  buildResponseContext(systemPrompt: string, trigger: ChatMessage, reason: string, maxChars: number): LlmMessage[] {
    const messages: LlmMessage[] = [
      { role: "system", content: systemPrompt },
      {
        role: "system",
        content: [
          "Conversation rules:",
          "- Treat the final user block as the only message you are answering right now.",
          "- Use earlier messages only as background context.",
          "- Stay grounded in the same server as the current message unless the context clearly requires otherwise.",
          `- Keep the reply under ${maxChars} characters.`,
        ].join("\n"),
      },
    ];

    const worldState = this.buildWorldStateMessage(trigger);
    if (worldState) {
      messages.push({ role: "system", content: worldState });
    }

    const history = this.selectRelevantHistory(trigger);
    if (history.length > 0) {
      messages.push({
        role: "system",
        content: "Recent relevant conversation follows. These are older messages, not the one you must answer now.",
      });
      messages.push(...history);
    }

    messages.push({
      role: "user",
      content: [
        "Current message to answer now:",
        `- Server: ${trigger.serverName}`,
        `- Player: ${trigger.playerName}`,
        `- Trigger reason: ${reason}`,
        `- Message: ${JSON.stringify(trigger.rawMessage)}`,
        "Reply in character. Answer this message directly, not an earlier one.",
      ].join("\n"),
    });

    return messages;
  }

  private trimEntries(): void {
    const maxEntries = this.maxMessages * 2;
    if (this.recentEntries.length > maxEntries) {
      this.recentEntries = this.recentEntries.slice(-maxEntries);
    }
  }

  private selectRelevantHistory(trigger: ChatMessage): LlmMessage[] {
    const selected: MemoryEntry[] = [];
    const seen = new Set<string>();
    const candidates = this.recentEntries.filter((entry) => !this.isCurrentTriggerEntry(entry, trigger));

    const addMatches = (predicate: (entry: MemoryEntry) => boolean, limit: number) => {
      for (let i = candidates.length - 1; i >= 0 && limit > 0; i -= 1) {
        const entry = candidates[i];
        if (!predicate(entry)) {
          continue;
        }

        const key = this.entryKey(entry);
        if (seen.has(key)) {
          continue;
        }

        seen.add(key);
        selected.push(entry);
        limit -= 1;
      }
    };

    addMatches(
      (entry) => entry.kind === "chat"
        && entry.message.serverName === trigger.serverName
        && entry.message.playerUuid === trigger.playerUuid,
      3,
    );
    addMatches(
      (entry) => entry.kind === "assistant" && entry.serverName === trigger.serverName,
      2,
    );
    addMatches(
      (entry) => entry.kind === "chat" && entry.message.serverName === trigger.serverName,
      Math.max(0, this.maxMessages - selected.length),
    );

    selected.sort((a, b) => this.entryTimestamp(a) - this.entryTimestamp(b));

    return selected.map((entry) => this.toLlmMessage(entry));
  }

  private buildWorldStateMessage(trigger: ChatMessage): string | null {
    const serverInfo = this.playerList.get(trigger.serverName);
    const serverPlayers = serverInfo?.players.map((player) => player.name) ?? [];
    const totalPlayers = this.getTotalPlayers();

    if (!serverInfo && totalPlayers === 0) {
      return null;
    }

    const serverSummary = serverInfo
      ? `Players currently visible on ${trigger.serverName}: ${serverPlayers.length > 0 ? serverPlayers.join(", ") : "none"}.`
      : `No recent player list heartbeat is available for ${trigger.serverName}.`;

    return `${serverSummary} Total visible players across Magnus heartbeats: ${totalPlayers}.`;
  }

  private toLlmMessage(entry: MemoryEntry): LlmMessage {
    if (entry.kind === "assistant") {
      return {
        role: "assistant",
        content: `You previously said on ${entry.serverName}: ${entry.content}`,
      };
    }

    return {
      role: "user",
      content: `${entry.message.playerName} (${entry.message.serverName}): ${entry.message.rawMessage}`,
    };
  }

  private isCurrentTriggerEntry(entry: MemoryEntry, trigger: ChatMessage): boolean {
    return entry.kind === "chat"
      && entry.message.timestamp === trigger.timestamp
      && entry.message.playerUuid === trigger.playerUuid
      && entry.message.serverName === trigger.serverName
      && entry.message.rawMessage === trigger.rawMessage;
  }

  private entryTimestamp(entry: MemoryEntry): number {
    return entry.kind === "assistant" ? entry.timestamp : entry.message.timestamp;
  }

  private entryKey(entry: MemoryEntry): string {
    if (entry.kind === "assistant") {
      return `assistant:${entry.serverName}:${entry.timestamp}:${entry.content}`;
    }

    return `chat:${entry.message.serverName}:${entry.message.playerUuid}:${entry.message.timestamp}:${entry.message.rawMessage}`;
  }
}
