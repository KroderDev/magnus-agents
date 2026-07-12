import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { CooldownTracker } from "../src/runtime/cooldowns.js";

describe("CooldownTracker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("should allow first response", () => {
    const tracker = new CooldownTracker(20, 60);
    expect(tracker.canRespond("player-1")).toBe(true);
  });

  it("should block within global cooldown", () => {
    const tracker = new CooldownTracker(20, 60);

    tracker.recordResponse("player-1");
    expect(tracker.canRespond("player-2")).toBe(false);
  });

  it("should block same player within player cooldown", () => {
    const tracker = new CooldownTracker(20, 60);

    tracker.recordResponse("player-1");

    vi.advanceTimersByTime(30_000);

    expect(tracker.canRespond("player-1")).toBe(false);
  });

  it("should allow different player after global cooldown", () => {
    const tracker = new CooldownTracker(20, 60);

    tracker.recordResponse("player-1");

    vi.advanceTimersByTime(25_000);

    expect(tracker.canRespond("player-2")).toBe(true);
  });

  it("should allow same player after player cooldown", () => {
    const tracker = new CooldownTracker(20, 60);

    tracker.recordResponse("player-1");

    vi.advanceTimersByTime(65_000);

    expect(tracker.canRespond("player-1")).toBe(true);
  });
});
