import type { ChatMessage } from "../domain/types.js";
import type { PersonaConfig } from "../config/persona.js";

export interface TriggerResult {
  shouldRespond: boolean;
  reason: string;
  targetUuid: string;
  targetServer: string;
}

const QUESTION_MARKERS = /[?¿]/;

const INTERROGATIVE_PATTERNS = [
  /\balguien\s+sabe\b/i,
  /^\s*(como|cómo|donde|dónde|cuando|cuándo|cual|cuál|quien|quién|por\s+que|por\s+qué)\b/i,
  /\b(se\s+puede|me\s+pueden|me\s+podri[ae]n|saben\s+si)\b/i,
];

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

    const isMention = this.triggers.mention.enabled && this.isDirectMention(msg.rawMessage);

    if (isMention) {
      return {
        shouldRespond: true,
        reason: "mention",
        targetUuid: msg.playerUuid,
        targetServer: msg.serverName,
      };
    }

    const matchedHelpSignal = this.matchHelpSignal(msg.rawMessage);
    const isHelpRequest = Boolean(matchedHelpSignal);
    const isQuestion = this.looksLikeQuestion(msg.rawMessage);

    if (!this.triggers.question.enabled || (!isQuestion && !isHelpRequest)) {
      return null;
    }

    if (this.triggers.question.requireMention && !isMention) {
      return null;
    }

    if (isHelpRequest) {
      return {
        shouldRespond: true,
        reason: isMention ? "help-to-persona" : "help-request",
        targetUuid: msg.playerUuid,
        targetServer: msg.serverName,
      };
    }

    if (isMention || !this.triggers.question.useSemanticRelevance) {
      return {
        shouldRespond: true,
        reason: isMention ? "question-to-persona" : "question",
        targetUuid: msg.playerUuid,
        targetServer: msg.serverName,
      };
    }

    return {
      shouldRespond: true,
      reason: "question-candidate",
      targetUuid: msg.playerUuid,
      targetServer: msg.serverName,
    };
  }

  private isServerAllowed(server: string): boolean {
    if (this.allowedServers.includes("*")) return true;
    return this.allowedServers.includes(server);
  }

  private isDirectMention(text: string): boolean {
    const lower = text.toLowerCase();
    const nameLower = this.displayName.toLowerCase();
    const terms = [nameLower, this.personaId, ...this.triggers.mention.aliases.map((alias) => alias.toLowerCase())];

    for (const term of terms) {
      if (!term) {
        continue;
      }

      if (lower.includes(term)) return true;
      if (lower.startsWith(`@${term}`)) return true;
    }

    return false;
  }

  private looksLikeQuestion(text: string): boolean {
    if (QUESTION_MARKERS.test(text)) {
      return true;
    }

    return INTERROGATIVE_PATTERNS.some((pattern) => pattern.test(text));
  }

  private matchHelpSignal(text: string): { pattern: string; match: "includes" | "regex"; priority: number } | null {
    const lower = text.toLowerCase();
    let bestMatch: { pattern: string; match: "includes" | "regex"; priority: number } | null = null;

    for (const signal of this.triggers.question.helpSignals) {
      const isMatch = signal.match === "regex"
        ? this.matchesRegex(signal.pattern, text)
        : lower.includes(signal.pattern.toLowerCase());

      if (!isMatch) {
        continue;
      }

      if (!bestMatch || signal.priority > bestMatch.priority) {
        bestMatch = signal;
      }
    }

    return bestMatch;
  }

  private matchesRegex(pattern: string, text: string): boolean {
    try {
      return new RegExp(pattern, "i").test(text);
    } catch {
      return false;
    }
  }
}
