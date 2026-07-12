export class LoopGuard {
  private lastSentMessage: string | null = null;
  private repeatCount = 0;
  private readonly maxRepeats = 3;

  isLooping(message: string): boolean {
    const normalized = message.trim().toLowerCase();

    if (this.lastSentMessage === normalized) {
      this.repeatCount++;
      if (this.repeatCount >= this.maxRepeats) {
        return true;
      }
    } else {
      this.repeatCount = 1;
    }

    this.lastSentMessage = normalized;
    return false;
  }

  reset(): void {
    this.lastSentMessage = null;
    this.repeatCount = 0;
  }
}
