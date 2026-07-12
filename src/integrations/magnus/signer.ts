import { createHmac, timingSafeEqual } from "node:crypto";

const HMAC_ALGORITHM = "sha256";
const SIGNED_MESSAGE_PARTS = 3;
const MAX_FUTURE_SKEW_MS = 5_000;

export class MessageSigner {
  constructor(
    private readonly secret: string,
    private readonly now: () => number = () => Date.now(),
  ) {}

  sign(payload: string): string {
    const timestamp = this.now();
    const dataToSign = `${timestamp}|${payload}`;
    const signature = this.computeHmac(dataToSign);
    return `${signature}|${dataToSign}`;
  }

  verify(signedMessage: string, maxAgeMs: number = 30_000): string | null {
    const parts = signedMessage.split("|", SIGNED_MESSAGE_PARTS);
    if (parts.length !== SIGNED_MESSAGE_PARTS) return null;

    const [signature, timestampStr, payload] = parts;
    const timestamp = Number(timestampStr);
    if (!Number.isFinite(timestamp)) return null;

    const age = this.now() - timestamp;
    if (age < -MAX_FUTURE_SKEW_MS || age > maxAgeMs) return null;

    const expected = this.computeHmac(`${timestampStr}|${payload}`);
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

    return payload;
  }

  private computeHmac(data: string): string {
    return createHmac(HMAC_ALGORITHM, this.secret)
      .update(data)
      .digest("base64");
  }
}
