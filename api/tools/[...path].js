import { randomUUID } from "crypto";
import { withHandler } from "../../lib/handler.js";
import { requireAuth, requireAdmin } from "../../lib/auth.js";
import { sql } from "../../lib/db.js";
import { tavilySearch } from "../../lib/tools/tavily.js";
import { githubSearchRepos, githubGetFile, githubListIssues } from "../../lib/tools/github.js";

/**
 * Consolidated tools endpoint. See auth/[...path].js for why routes are
 * folded together like this (Vercel's 12-function cap on the Hobby plan).
 *
 * Routes handled here (all under /api/tools/...):
 *   GET    /registry              list skill registry
 *   POST   /registry              add a custom tool (admin only)
 *   PATCH  /registry/:id          toggle a tool (admin only)
 *   DELETE /registry/:id          delete a custom tool (admin only)
 *   POST   /tavily/search         web search
 *   POST   /github/search-repos   GitHub repo search
 *   GET    /github/file           fetch a file from GitHub
 *   GET    /github/issues         list issues on a GitHub repo
 */
export default withHandler(async (req, res) => {
  const rawSegments = req.query.path ?? req.query['...path'] ?? [];
  const segments = Array.isArray(rawSegments) ? rawSegments : [rawSegments].filter(Boolean);
  const method = req.method;
  const user = await requireAuth(req);

  if (segments[0] === "registry") {
    if (segments.length === 1 && method === "GET") {
      const result = await sql`SELECT * FROM tools ORDER BY is_builtin DESC, name ASC`;
      return res.json({
        tools: result.rows.map((r) => ({ ...r, config: JSON.parse(r.config_json || "{}"), enabled: !!r.enabled, isBuiltin: !!r.is_builtin }))
      });
    }
    if (segments.length === 1 && method === "POST") {
      requireAdmin(user);
      const { name, description, category, kind, config } = req.body || {};
      if (!name) return res.status(400).json({ error: "name is required" });
      const id = randomUUID();
      await sql`
        INSERT INTO tools (id, name, description, category, kind, config_json, enabled, is_builtin)
        VALUES (${id}, ${name}, ${description || ""}, ${category || "custom"}, ${kind || "prompt_tool"}, ${JSON.stringify(config || {})}, TRUE, FALSE)
      `;
      return res.json({ ok: true, id });
    }
    if (segments.length === 2 && method === "PATCH") {
      requireAdmin(user);
      await sql`UPDATE tools SET enabled = ${!!req.body?.enabled} WHERE id = ${segments[1]}`;
      return res.json({ ok: true });
    }
    if (segments.length === 2 && method === "DELETE") {
      requireAdmin(user);
      await sql`DELETE FROM tools WHERE id = ${segments[1]} AND is_builtin = FALSE`;
      return res.json({ ok: true });
    }
  }

  if (segments[0] === "tavily" && segments[1] === "search" && method === "POST") {
    const { query, maxResults, searchDepth } = req.body || {};
    if (!query) return res.status(400).json({ error: "query is required" });
    const result = await tavilySearch(user.id, query, { maxResults, searchDepth });
    return res.json(result);
  }

  if (segments[0] === "github" && segments[1] === "search-repos" && method === "POST") {
    const result = await githubSearchRepos(user.id, req.body?.query);
    return res.json(result);
  }

  if (segments[0] === "github" && segments[1] === "file" && method === "GET") {
    const { owner, repo, path: filePath, ref } = req.query;
    const result = await githubGetFile(user.id, owner, repo, filePath, ref);
    return res.json(result);
  }

  if (segments[0] === "github" && segments[1] === "issues" && method === "GET") {
    const { owner, repo } = req.query;
    const result = await githubListIssues(user.id, owner, repo);
    return res.json(result);
  }

  res.status(404).json({ error: "Not found" });
});
