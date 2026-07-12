import { describe, it, expect } from "vitest";
import { MessageSigner } from "../src/integrations/magnus/signer.js";

describe("MessageSigner", () => {
  const secret = "test-secret-key-for-hmac-32b";
  const signer = new MessageSigner(secret);

  it("should sign and verify a message", () => {
    const payload = JSON.stringify({
      serverName: "survival",
      playerUuid: "test-uuid",
      playerName: "TestPlayer",
      rawMessage: "Hello world!",
    });

    const signed = signer.sign(payload);
    const verified = signer.verify(signed);
    expect(verified).toBe(payload);
  });

  it("should reject expired messages", async () => {
    const payload = "test-payload";
    const signed = signer.sign(payload);

    await new Promise((r) => setTimeout(r, 10));

    const verified = signer.verify(signed, 0);
    expect(verified).toBeNull();
  });

  it("should reject messages with wrong secret", () => {
    const otherSigner = new MessageSigner("different-secret-key");
    const payload = "test-payload";
    const signed = otherSigner.sign(payload);
    const verified = signer.verify(signed);
    expect(verified).toBeNull();
  });

  it("should reject malformed messages", () => {
    expect(signer.verify("garbage")).toBeNull();
    expect(signer.verify("a|b")).toBeNull();
    expect(signer.verify("a|b|c|d")).toBeNull();
  });

  it("should be compatible with Magnus Kotlin format", () => {
    const payload = JSON.stringify({ serverName: "survival", message: "hello" });
    const signed = signer.sign(payload);

    const parts = signed.split("|");
    expect(parts).toHaveLength(3);

    const timestamp = Number(parts[1]);
    expect(Number.isFinite(timestamp)).toBe(true);
    expect(Date.now() - timestamp).toBeLessThan(5_000);
  });
});
