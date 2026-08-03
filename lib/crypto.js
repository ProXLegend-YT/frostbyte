import crypto from "crypto";

// Same AES-256-GCM scheme as the original SQLite version — this logic didn't
// need to change for the Postgres migration, only where the encrypted
// strings get stored.
const SECRET = process.env.ENCRYPTION_SECRET || "dev-only-change-me-in-.env-file!";
const ALGO = "aes-256-gcm";
const key = crypto.createHash("sha256").update(SECRET).digest();

export function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decrypt(payload) {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
