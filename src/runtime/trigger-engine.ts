import type { ChatMessage } from "../domain/types.js";
import type { PersonaConfig } from "../config/persona.js";

export interface TriggerResult {
  shouldRespond: boolean;
  reason: string;
  targetUuid: string;
  targetServer: string;
}

const QUESTION_MARKERS = /[?¿]/;
export class TriggerEngine {
  private readonly triggers: PersonaConfig["triggers"];
  private readonly personaId: string;
  private readonly displayName: string;
  private readonly allowedServers: string[];

  constructor(config: PersonaConfig) {
    this.triggers = config.triggers;
    this.personaId = config.id;
    this.displayName = config.displayName;
    this.allowedServers = config.allowedInputServers;
  }

  evaluate(msg: ChatMessage): TriggerResult | null {
    if (!this.isServerAllowed(msg.serverName)) {
      return null;
    }

    if (this.triggers.onMention && this.isDirectMention(msg.rawMessage)) {
      return {
        shouldRespond: true,
        reason: "mention",
        targetUuid: msg.playerUuid,
        targetServer: msg.serverName,
      };
    }

    if (this.triggers.onQuestion && this.hasQuestionMarker(msg.rawMessage)) {
      return {
        shouldRespond: true,
        reason: "question",
        targetUuid: msg.playerUuid,
        targetServer: msg.serverName,
      };
    }

    return null;
  }

  private isServerAllowed(server: string): boolean {
    if (this.allowedServers.includes("*")) return true;
    return this.allowedServers.includes(server);
  }

  private isDirectMention(text: string): boolean {
    const lower = text.toLowerCase();
    const nameLower = this.displayName.toLowerCase();
    const terms = [nameLower, this.personaId, "profe"];

    for (const term of terms) {
      if (lower.includes(term)) return true;
      if (lower.startsWith(`@${term}`)) return true;
    }

    return false;
  }

  private hasQuestionMarker(text: string): boolean {
    return QUESTION_MARKERS.test(text);
  }
}
