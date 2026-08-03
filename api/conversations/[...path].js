import { randomUUID } from "crypto";
import { withHandler } from "../../lib/handler.js";
import { requireAuth } from "../../lib/auth.js";
import { sql } from "../../lib/db.js";
import { toMarkdown, toJSON, slugForFilename } from "../../lib/exportConversation.js";

/**
 * Consolidated conversations endpoint. See auth/[...path].js for why routes
 * are folded together like this (Vercel's 12-function cap on the Hobby plan).
 *
 * Routes handled here (all under /api/conversations/...):
 *   GET    /                              list conversations
 *   POST   /                              create a conversation
 *   GET    /search?q=...                  search titles + message content
 *   GET    /:id/messages                  get messages for a conversation
 *   DELETE /:id/messages/from/:messageId  truncate from a message onward
 *   GET    /:id/export?format=...         export as markdown/json
 *   DELETE /:id                           delete a conversation
 */
export default withHandler(async (req, res) => {
  const rawSegments = req.query.path ?? req.query['...path'] ?? [];
  const segments = Array.isArray(rawSegments) ? rawSegments : [rawSegments].filter(Boolean);
  const method = req.method;
  const user = await requireAuth(req);

  // GET/POST /api/conversations
  if (segments.length === 0) {
    if (method === "GET") {
      const result = await sql`SELECT * FROM conversations WHERE user_id = ${user.id} ORDER BY updated_at DESC LIMIT 100`;
      return res.json({ conversations: result.rows });
    }
    if (method === "POST") {
      const id = randomUUID();
      await sql`INSERT INTO conversations (id, user_id, title) VALUES (${id}, ${user.id}, 'New chat')`;
      return res.json({ id });
    }
  }

  // GET /api/conversations/search
  if (segments[0] === "search" && method === "GET") {
    const q = (req.query.q || "").trim();
    if (!q) return res.json({ results: [] });
    if (q.length > 200) return res.status(400).json({ error: "Search query too long" });

    const like = `%${q}%`;
    const titleMatches = await sql`
      SELECT id, title, updated_at FROM conversations
      WHERE user_id = ${user.id} AND title ILIKE ${like}
      ORDER BY updated_at DESC LIMIT 20
    `;
    const contentMatches = await sql`
      SELECT c.id, c.title, c.updated_at, m.content AS matched_content
      FROM messages m JOIN conversations c ON c.id = m.conversation_id
      WHERE c.user_id = ${user.id} AND m.content ILIKE ${like}
      ORDER BY m.created_at DESC
    `;

    const seen = new Map();
    for (const row of titleMatches.rows) {
      seen.set(row.id, { id: row.id, title: row.title, updatedAt: row.updated_at, snippet: null, matchedIn: "title" });
    }
    for (const row of contentMatches.rows) {
      if (seen.has(row.id)) continue;
      const idx = row.matched_content.toLowerCase().indexOf(q.toLowerCase());
      const start = Math.max(0, idx - 40);
      const snippet = (start > 0 ? "…" : "") + row.matched_content.slice(start, idx + q.length + 60).trim() + "…";
      seen.set(row.id, { id: row.id, title: row.title, updatedAt: row.updated_at, snippet, matchedIn: "message" });
    }
    const results = [...seen.values()].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 25);
    return res.json({ results });
  }

  // Everything below operates on a specific conversation id — verify ownership once, up front.
  const conversationId = segments[0];
  const convoResult = await sql`SELECT * FROM conversations WHERE id = ${conversationId}`;
  const convo = convoResult.rows[0];
  if (!convo || convo.user_id !== user.id) return res.status(404).json({ error: "Conversation not found" });

  // GET /api/conversations/:id/messages
  if (segments[1] === "messages" && segments.length === 2 && method === "GET") {
    const result = await sql`SELECT * FROM messages WHERE conversation_id = ${conversationId} ORDER BY created_at ASC`;
    return res.json({
      messages: result.rows.map((r) => ({ ...r, fallbackChain: r.fallback_chain_json ? JSON.parse(r.fallback_chain_json) : null }))
    });
  }

  // DELETE /api/conversations/:id/messages/from/:messageId
  if (segments[1] === "messages" && segments[2] === "from" && segments.length === 4 && method === "DELETE") {
    const messageId = segments[3];
    const targetResult = await sql`SELECT created_at FROM messages WHERE id = ${messageId} AND conversation_id = ${conversationId}`;
    const target = targetResult.rows[0];
    if (!target) return res.status(404).json({ error: "Message not found in this conversation" });
    const result = await sql`DELETE FROM messages WHERE conversation_id = ${conversationId} AND created_at >= ${target.created_at}`;
    return res.json({ ok: true, deleted: result.rowCount });
  }

  // GET /api/conversations/:id/export
  if (segments[1] === "export" && segments.length === 2 && method === "GET") {
    const format = (req.query.format || "markdown").toLowerCase();
    if (!["markdown", "json"].includes(format)) return res.status(400).json({ error: "format must be 'markdown' or 'json'" });

    const messagesResult = await sql`SELECT * FROM messages WHERE conversation_id = ${conversationId} ORDER BY created_at ASC`;
    const filenameBase = slugForFilename(convo.title);

    if (format === "json") {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="${filenameBase}.json"`);
      return res.send(toJSON(convo, messagesResult.rows));
    }
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filenameBase}.md"`);
    return res.send(toMarkdown(convo, messagesResult.rows));
  }

  // DELETE /api/conversations/:id
  if (segments.length === 1 && method === "DELETE") {
    await sql`DELETE FROM messages WHERE conversation_id = ${conversationId}`;
    await sql`DELETE FROM conversations WHERE id = ${conversationId}`;
    return res.json({ ok: true });
  }

  res.status(404).json({ error: "Not found" });
});
