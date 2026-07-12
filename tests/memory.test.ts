import { describe, expect, it } from "vitest";
import { MessageMemory } from "../src/runtime/memory.js";
import type { ChatMessage, ServerPlayerInfo } from "../src/domain/types.js";

function chatMessage(overrides: Partial<ChatMessage>): ChatMessage {
  return {
    serverName: "lobby",
    playerUuid: "uuid-1",
    playerName: "Ash",
    rawMessage: "hola",
    timestamp: 1,
    ...overrides,
  };
}

function playerList(serverName: string, players: string[], timestamp = Date.now()): ServerPlayerInfo {
  return {
    serverName,
    timestamp,
    players: players.map((name, index) => ({ uuid: `${serverName}-${index}`, name })),
  };
}

describe("MessageMemory", () => {
  it("builds response context with the current message separated from history", () => {
    const memory = new MessageMemory(6);
    memory.addChatMessage(chatMessage({ rawMessage: "viejo mensaje", timestamp: 1 }));
    memory.addChatMessage(chatMessage({
      serverName: "kanto",
      playerUuid: "uuid-2",
      playerName: "Brock",
      rawMessage: "otro server",
      timestamp: 2,
    }));
    memory.addAssistantMessage("lobby", "Te dije que fueras al spawn", 3);
    memory.updatePlayerList(playerList("lobby", ["Ash", "Misty"], 4));

    const current = chatMessage({ rawMessage: "donde esta el gimnasio?", timestamp: 5 });
    const messages = memory.buildResponseContext("system prompt", current, "mention", 120);

    expect(messages[0]).toEqual({ role: "system", content: "system prompt" });
    expect(messages[messages.length - 1]?.content).toContain('Message: "donde esta el gimnasio?"');
    expect(messages.slice(0, -1).some((message) => message.content.includes("donde esta el gimnasio?"))).toBe(false);
    expect(messages.some((message) => message.role === "assistant" && message.content.includes("Te dije que fueras al spawn"))).toBe(true);
    expect(messages.some((message) => message.role === "system" && message.content.includes("Players currently visible on lobby: Ash, Misty."))).toBe(true);
    expect(messages.some((message) => message.content.includes("otro server"))).toBe(false);
  });
});
