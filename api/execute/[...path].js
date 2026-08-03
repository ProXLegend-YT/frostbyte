import { withHandler } from "../../lib/handler.js";
import { requireAuth } from "../../lib/auth.js";
import { dockerAvailable, supportedLanguages, runInSandbox } from "../../lib/sandbox.js";

/**
 * Consolidated execute endpoint. See auth/[...path].js for why routes are
 * folded together like this (Vercel's 12-function cap on the Hobby plan).
 *
 * Routes handled here (all under /api/execute/...):
 *   GET  /status   is the execution service reachable, which languages
 *   POST /run       run a code snippet
 */
export default withHandler(async (req, res) => {
  const rawSegments = req.query.path ?? req.query['...path'] ?? [];
  const segments = Array.isArray(rawSegments) ? rawSegments : [rawSegments].filter(Boolean);
  const method = req.method;
  await requireAuth(req);

  if (segments[0] === "status" && method === "GET") {
    const available = await dockerAvailable();
    return res.json({ available, languages: supportedLanguages() });
  }

  if (segments[0] === "run" && method === "POST") {
    const { language, code, stdin } = req.body || {};
    if (!language || typeof code !== "string") return res.status(400).json({ error: "language and code are required" });
    if (code.length > 100_000) return res.status(400).json({ error: "Code is too large to execute (100KB limit)" });
    const result = await runInSandbox({ language, code, stdin });
    return res.json(result);
  }

  res.status(404).json({ error: "Not found" });
});
