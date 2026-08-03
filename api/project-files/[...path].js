import { withHandler } from "../../lib/handler.js";
import { requireAuth } from "../../lib/auth.js";
import { sql } from "../../lib/db.js";
import { parseMultipartForm } from "../../lib/multipart.js";
import {
  extractZip,
  validateSingleFile,
  addProjectFiles,
  listProjectFiles,
  toggleProjectFile,
  deleteProjectFile,
  deleteAllProjectFiles,
  LIMITS
} from "../../lib/projectFiles.js";

// This whole function has Vercel's automatic JSON body parsing turned off
// (needed for the upload route, which reads a raw multipart stream itself)
// — so the non-upload routes below parse a JSON body manually when needed.
export const config = {
  api: {
    bodyParser: false
  }
};

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function ownedConversationOr404(conversationId, user, res) {
  const result = await sql`SELECT user_id FROM conversations WHERE id = ${conversationId}`;
  const convo = result.rows[0];
  if (!convo || convo.user_id !== user.id) {
    res.status(404).json({ error: "Conversation not found" });
    return null;
  }
  return convo;
}

/**
 * Consolidated project-files endpoint. See auth/[...path].js for why routes
 * are folded together like this (Vercel's 12-function cap on the Hobby plan).
 *
 * Routes handled here (all under /api/project-files/...):
 *   GET    /:conversationId                    list files
 *   DELETE /:conversationId                    delete all files
 *   POST   /:conversationId/upload             upload files (multipart)
 *   PATCH  /:conversationId/:fileId            toggle a file's inclusion
 *   DELETE /:conversationId/:fileId            delete a single file
 */
export default withHandler(async (req, res) => {
  const rawSegments = req.query.path ?? req.query['...path'] ?? [];
  const segments = Array.isArray(rawSegments) ? rawSegments : [rawSegments].filter(Boolean);
  const method = req.method;
  const user = await requireAuth(req);
  const conversationId = segments[0];

  if (!conversationId) return res.status(404).json({ error: "Not found" });
  if (!(await ownedConversationOr404(conversationId, user, res))) return;

  // POST /:conversationId/upload
  if (segments[1] === "upload" && segments.length === 2 && method === "POST") {
    let fields, files;
    try {
      ({ fields, files } = await parseMultipartForm(req, { maxFileSize: LIMITS.MAX_TOTAL_SIZE_BYTES, maxFiles: LIMITS.MAX_FILES_PER_UPLOAD }));
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    const uploaded = files.filter((f) => f.fieldname === "files");
    if (uploaded.length === 0) return res.status(400).json({ error: "No files were uploaded" });

    const isSingleZip = uploaded.length === 1 && uploaded[0].originalname.toLowerCase().endsWith(".zip");

    try {
      if (isSingleZip) {
        const { files: extracted, skipped } = extractZip(uploaded[0].buffer);
        if (extracted.length === 0) {
          return res.status(400).json({ error: "No usable text files found in that zip (everything was filtered as binary, too large, or a build artifact)." });
        }
        await addProjectFiles(conversationId, extracted);
        return res.json({ ok: true, added: extracted.length, skipped });
      }

      const accepted = [];
      const skipped = [];
      let totalSize = 0;

      for (const file of uploaded) {
        const relPath = fields[`relativePath_${file.originalname}`] || file.originalname;
        const result = validateSingleFile(relPath, file.buffer);
        if (!result.ok) {
          skipped.push({ path: relPath, reason: result.reason });
          continue;
        }
        if (totalSize + result.sizeBytes > LIMITS.MAX_TOTAL_SIZE_BYTES) {
          skipped.push({ path: relPath, reason: "over the total upload size limit for this batch" });
          continue;
        }
        totalSize += result.sizeBytes;
        accepted.push({ path: relPath, content: result.content, sizeBytes: result.sizeBytes, language: result.language });
      }

      if (accepted.length === 0) {
        return res.status(400).json({ error: "None of the uploaded files could be used — check the skipped reasons.", skipped });
      }

      await addProjectFiles(conversationId, accepted);
      return res.json({ ok: true, added: accepted.length, skipped });
    } catch (err) {
      return res.status(400).json({ error: `Couldn't process upload: ${err.message}` });
    }
  }

  // GET/DELETE /:conversationId (list or delete-all)
  if (segments.length === 1) {
    if (method === "GET") {
      const files = (await listProjectFiles(conversationId)).map((f) => ({
        id: f.id,
        path: f.path,
        sizeBytes: f.size_bytes,
        language: f.language,
        included: !!f.included
      }));
      return res.json({ files });
    }
    if (method === "DELETE") {
      await deleteAllProjectFiles(conversationId);
      return res.json({ ok: true });
    }
  }

  // PATCH/DELETE /:conversationId/:fileId
  if (segments.length === 2) {
    const fileId = segments[1];
    if (method === "PATCH") {
      const body = await readJsonBody(req);
      await toggleProjectFile(fileId, body.included);
      return res.json({ ok: true });
    }
    if (method === "DELETE") {
      await deleteProjectFile(fileId);
      return res.json({ ok: true });
    }
  }

  res.status(404).json({ error: "Not found" });
});
