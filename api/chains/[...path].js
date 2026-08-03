import { randomUUID } from "crypto";
import { withHandler } from "../../lib/handler.js";
import { requireAuth } from "../../lib/auth.js";
import { sql } from "../../lib/db.js";

/**
 * Consolidated chains endpoint (saved fallback-chain presets). See
 * auth/[...path].js for why routes are folded together like this (Vercel's
 * 12-function cap on the Hobby plan).
 *
 * Routes handled here (all under /api/chains/...):
 *   GET    /       list saved chains
 *   POST   /       save a new chain
 *   DELETE /:id    delete a saved chain
 */
export default withHandler(async (req, res) => {
  const rawSegments = req.query.path ?? req.query['...path'] ?? [];
  const segments = Array.isArray(rawSegments) ? rawSegments : [rawSegments].filter(Boolean);
  const method = req.method;
  const user = await requireAuth(req);

  if (segments.length === 0) {
    if (method === "GET") {
      const result = await sql`SELECT * FROM chains WHERE user_id = ${user.id} ORDER BY created_at DESC`;
      return res.json({ chains: result.rows.map((r) => ({ ...r, members: JSON.parse(r.members_json), isFusion: !!r.is_fusion })) });
    }
    if (method === "POST") {
      const { name, members, isFusion } = req.body || {};
      if (!name || !Array.isArray(members) || !members.length) {
        return res.status(400).json({ error: "name and members[] are required" });
      }
      const id = randomUUID();
      await sql`INSERT INTO chains (id, user_id, name, members_json, is_fusion) VALUES (${id}, ${user.id}, ${name}, ${JSON.stringify(members)}, ${!!isFusion})`;
      return res.json({ ok: true, id });
    }
  }

  if (segments.length === 1 && method === "DELETE") {
    await sql`DELETE FROM chains WHERE id = ${segments[0]} AND user_id = ${user.id}`;
    return res.json({ ok: true });
  }

  res.status(404).json({ error: "Not found" });
});
