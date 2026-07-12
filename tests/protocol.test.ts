import { describe, it, expect } from "vitest";
import {
  decodeChatMessage,
  encodeChatMessage,
  decodePlayerList,
  buildChatMessage,
  isPersonaMessage,
} from "../src/integrations/magnus/protocol.js";
import type { ChatMessage, PersonaMessage } from "../src/domain/types.js";

describe("Magnus protocol", () => {
  it("should encode and decode chat messages", () => {
    const msg: ChatMessage = {
      serverName: "survival",
      playerUuid: "uuid-123",
      playerName: "PlayerOne",
      rawMessage: "Hello world",
      timestamp: 1700000000000,
    };

    const encoded = encodeChatMessage(msg);
    const decoded = decodeChatMessage(encoded);

    expect(decoded).not.toBeNull();
    expect(decoded!.serverName).toBe("survival");
    expect(decoded!.playerName).toBe("PlayerOne");
    expect(decoded!.rawMessage).toBe("Hello world");
  });

  it("should handle missing fields gracefully", () => {
    expect(decodeChatMessage("{}")).toBeNull();
    expect(decodeChatMessage('{"serverName": "test"}')).toBeNull();
    expect(decodeChatMessage("not json")).toBeNull();
  });

  it("should decode player list", () => {
    const raw = JSON.stringify({
      serverName: "lobby",
      players: [
        { uuid: "u1", name: "Alice" },
        { uuid: "u2", name: "Bob" },
      ],
      timestamp: 1700000000000,
    });

    const info = decodePlayerList(raw);
    expect(info).not.toBeNull();
    expect(info!.serverName).toBe("lobby");
    expect(info!.players).toHaveLength(2);
    expect(info!.players[0].name).toBe("Alice");
  });

  it("should build persona chat messages", () => {
    const persona: PersonaMessage = {
      personaId: "profesor-gepeto",
      displayName: "Profesor Gepeto",
      rawMessage: "Hola entrenadores!",
    };

    const msg = buildChatMessage(persona, "agent:profesor-gepeto");
    expect(msg.serverName).toBe("agent:profesor-gepeto");
    expect(msg.playerUuid).toBe("persona:profesor-gepeto");
    expect(msg.playerName).toBe("Profesor Gepeto");
    expect(msg.rawMessage).toBe("Hola entrenadores!");
  });

  it("should detect persona messages", () => {
    expect(isPersonaMessage("persona:profesor-gepeto")).toBe(true);
    expect(isPersonaMessage("persona:oak")).toBe(true);
    expect(isPersonaMessage("uuid-12345")).toBe(false);
    expect(isPersonaMessage("regular-player-uuid")).toBe(false);
  });
});
