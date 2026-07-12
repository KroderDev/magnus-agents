export class CooldownTracker {
  private readonly globalCooldownMs: number;
  private readonly playerCooldownMs: number;

  private lastGlobal: number = 0;
  private readonly lastPerPlayer = new Map<string, number>();

  constructor(globalCooldownMs: number, playerCooldownMs: number) {
    this.globalCooldownMs = globalCooldownMs * 1000;
    this.playerCooldownMs = playerCooldownMs * 1000;
  }

  canRespond(playerUuid: string): boolean {
    const now = Date.now();

    if (now - this.lastGlobal < this.globalCooldownMs) {
      return false;
    }

    const lastPlayer = this.lastPerPlayer.get(playerUuid);
    if (lastPlayer && now - lastPlayer < this.playerCooldownMs) {
      return false;
    }

    return true;
  }

  recordResponse(playerUuid: string): void {
    const now = Date.now();
    this.lastGlobal = now;
    this.lastPerPlayer.set(playerUuid, now);
  }

  getState(): { global: number; players: Record<string, number> } {
    return {
      global: this.lastGlobal,
      players: Object.fromEntries(this.lastPerPlayer),
    };
  }
}
