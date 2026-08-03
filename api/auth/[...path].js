import { withHandler } from "../../lib/handler.js";
import {
  createUser,
  authenticate,
  createSession,
  destroySession,
  destroyOtherSessions,
  destroySessionById,
  listSessions,
  anyUsersExist,
  requireAuth,
  requireAdmin,
  parseCookie,
  setCookieHeader,
  clearCookieHeader
} from "../../lib/auth.js";

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Consolidated auth endpoint. Vercel's Hobby plan caps a deployment at 12
 * serverless functions, and FrostByte originally had one file per route
 * (56+ functions total) — this file and its siblings (providers.js,
 * conversations.js, tools.js, usage.js, project-files.js, execute.js,
 * chains.js) fold many routes into few actual functions using a catch-all
 * dynamic segment ([...path].js), so the whole API fits in 9 functions
 * instead of 56+. Nothing about the routes' behavior changes — only how
 * many separate deployable functions they're packaged into.
 *
 * Routes handled here (all under /api/auth/...):
 *   GET    /status
 *   POST   /setup
 *   POST   /login
 *   POST   /logout
 *   GET    /me
 *   POST   /users
 *   GET    /sessions
 *   DELETE /sessions/:id
 *   POST   /sessions/revoke-others
 */
export default withHandler(async (req, res) => {
  const rawSegments = req.query.path ?? req.query['...path'] ?? [];
  const segments = Array.isArray(rawSegments) ? rawSegments : [rawSegments].filter(Boolean);
  const route = segments.join("/");
  const method = req.method;

  if (route === "status" && method === "GET") {
    return res.json({ needsSetup: !(await anyUsersExist()) });
  }

  if (route === "setup" && method === "POST") {
    if (await anyUsersExist()) return res.status(403).json({ error: "Setup has already been completed. Use login instead." });
    const { username, password } = req.body || {};
    if (!username || !password || password.length < 8) {
      return res.status(400).json({ error: "Username and an 8+ character password are required." });
    }
    const user = await createUser({ username, password, role: "admin" });
    const { token } = await createSession(user.id, {
      userAgent: req.headers["user-agent"],
      ipAddress: req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || null
    });
    setCookieHeader(res, token, SESSION_DURATION_MS);
    return res.json({ ok: true, user: { username: user.username, role: user.role } });
  }

  if (route === "login" && method === "POST") {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: "Username and password are required." });
    const user = await authenticate(username, password);
    if (!user) return res.status(401).json({ error: "Incorrect username or password." });
    const { token } = await createSession(user.id, {
      userAgent: req.headers["user-agent"],
      ipAddress: req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || null
    });
    setCookieHeader(res, token, SESSION_DURATION_MS);
    return res.json({ ok: true, user: { username: user.username, role: user.role } });
  }

  if (route === "logout" && method === "POST") {
    const token = parseCookie(req.headers.cookie, "cf_session");
    if (token) await destroySession(token);
    clearCookieHeader(res);
    return res.json({ ok: true });
  }

  if (route === "me" && method === "GET") {
    const user = await requireAuth(req);
    return res.json({ user: { username: user.username, role: user.role } });
  }

  if (route === "users" && method === "POST") {
    const user = await requireAuth(req);
    requireAdmin(user);
    const { username, password, role } = req.body || {};
    if (!username || !password || password.length < 8) {
      return res.status(400).json({ error: "Username and an 8+ character password are required." });
    }
    const newUser = await createUser({ username, password, role: role === "admin" ? "admin" : "user" });
    return res.json({ ok: true, user: { username: newUser.username, role: newUser.role } });
  }

  if (route === "sessions" && method === "GET") {
    const user = await requireAuth(req);
    const currentToken = parseCookie(req.headers.cookie, "cf_session");
    const sessions = (await listSessions(user.id)).map((s) => ({
      id: s.id,
      isCurrent: s.token === currentToken,
      userAgent: s.user_agent,
      ipAddress: s.ip_address,
      createdAt: s.created_at,
      lastSeenAt: s.last_seen_at,
      expiresAt: s.expires_at
    }));
    return res.json({ sessions });
  }

  if (route.startsWith("sessions/") && route !== "sessions/revoke-others" && method === "DELETE") {
    const user = await requireAuth(req);
    const sessionId = segments[1];
    const removed = await destroySessionById(user.id, sessionId);
    if (!removed) return res.status(404).json({ error: "Session not found" });
    return res.json({ ok: true });
  }

  if (route === "sessions/revoke-others" && method === "POST") {
    const user = await requireAuth(req);
    const currentToken = parseCookie(req.headers.cookie, "cf_session");
    await destroyOtherSessions(user.id, currentToken);
    return res.json({ ok: true });
  }

  res.status(404).json({ error: "Not found" });
});
