import crypto from "crypto";
import { sql, ensureSchema } from "./db.js";

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const SCRYPT_KEYLEN = 64;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
  return { hash, salt };
}

export function verifyPassword(password, hash, salt) {
  const candidate = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
  const stored = Buffer.from(hash, "hex");
  if (candidate.length !== stored.length) return false;
  return crypto.timingSafeEqual(candidate, stored);
}

export async function createUser({ username, password, role = "user" }) {
  await ensureSchema();
  const existing = await sql`SELECT id FROM users WHERE username = ${username}`;
  if (existing.rows.length > 0) throw new Error("That username is already taken.");
  const { hash, salt } = hashPassword(password);
  const id = crypto.randomUUID();
  await sql`INSERT INTO users (id, username, password_hash, password_salt, role) VALUES (${id}, ${username}, ${hash}, ${salt}, ${role})`;
  return { id, username, role };
}

export async function authenticate(username, password) {
  await ensureSchema();
  const result = await sql`SELECT * FROM users WHERE username = ${username}`;
  const user = result.rows[0];
  if (!user) return null;
  if (!verifyPassword(password, user.password_hash, user.password_salt)) return null;
  return { id: user.id, username: user.username, role: user.role };
}

export async function createSession(userId, { userAgent = null, ipAddress = null } = {}) {
  const token = crypto.randomBytes(32).toString("hex");
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
  await sql`
    INSERT INTO sessions (token, id, user_id, user_agent, ip_address, expires_at)
    VALUES (${token}, ${id}, ${userId}, ${userAgent}, ${ipAddress}, ${expiresAt})
  `;
  return { token, id, expiresAt };
}

export async function destroySession(token) {
  await sql`DELETE FROM sessions WHERE token = ${token}`;
}

export async function destroyOtherSessions(userId, keepToken) {
  await sql`DELETE FROM sessions WHERE user_id = ${userId} AND token != ${keepToken || ""}`;
}

export async function getUserFromSession(token) {
  if (!token) return null;
  const result = await sql`
    SELECT users.id, users.username, users.role, sessions.expires_at
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token = ${token}
  `;
  const row = result.rows[0];
  if (!row) return null;
  if (new Date(row.expires_at) < new Date()) {
    await destroySession(token);
    return null;
  }
  // Throttled last-seen bump, same reasoning as the SQLite version: keeps
  // "active sessions" meaningful without writing on literally every request.
  await sql`
    UPDATE sessions SET last_seen_at = NOW()
    WHERE token = ${token} AND (last_seen_at IS NULL OR last_seen_at < NOW() - INTERVAL '2 minutes')
  `;
  return { id: row.id, username: row.username, role: row.role };
}

export async function listSessions(userId) {
  const result = await sql`
    SELECT id, token, user_agent, ip_address, created_at, last_seen_at, expires_at
    FROM sessions
    WHERE user_id = ${userId} AND expires_at > NOW()
    ORDER BY last_seen_at DESC
  `;
  return result.rows;
}

export async function destroySessionById(userId, sessionId) {
  const result = await sql`DELETE FROM sessions WHERE id = ${sessionId} AND user_id = ${userId}`;
  return result.rowCount > 0;
}

export async function anyUsersExist() {
  await ensureSchema();
  const result = await sql`SELECT COUNT(*) AS n FROM users WHERE id != 'legacy-user'`;
  return Number(result.rows[0].n) > 0;
}

/** For serverless handlers: reads the session cookie, resolves the user, or throws a 401-shaped error. */
export async function requireAuth(req) {
  const token = parseCookie(req.headers.cookie, "cf_session");
  const user = await getUserFromSession(token);
  if (!user) {
    const err = new Error("Not authenticated");
    err.statusCode = 401;
    throw err;
  }
  return user;
}

export function requireAdmin(user) {
  if (user?.role !== "admin") {
    const err = new Error("Admin access required");
    err.statusCode = 403;
    throw err;
  }
}

/** Minimal cookie parser — Vercel functions don't include cookie-parser by default. */
export function parseCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  const match = cookieHeader.split(";").map((c) => c.trim()).find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

export function setCookieHeader(res, token, maxAgeMs) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `cf_session=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${Math.floor(maxAgeMs / 1000)}${secure}`
  );
}

export function clearCookieHeader(res) {
  res.setHeader("Set-Cookie", `cf_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
}
