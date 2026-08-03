import AdmZip from "adm-zip";
import { randomUUID } from "crypto";
import { sql } from "./db.js";

// Deliberately generous but bounded: this is meant for "a small project or a
// handful of source files", not "upload your entire monorepo". Both limits
// exist to keep the context actually usable — a model with 50MB of source
// dumped into its context window won't produce a better answer, just a
// slower and more expensive one.
const MAX_FILE_SIZE_BYTES = 512 * 1024; // 512KB per file
const MAX_TOTAL_SIZE_BYTES = 4 * 1024 * 1024; // 4MB per upload batch
const MAX_FILES_PER_UPLOAD = 200;

const LANGUAGE_BY_EXTENSION = {
  js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
  ts: "typescript", tsx: "typescript",
  py: "python", rb: "ruby", go: "go", rs: "rust",
  java: "java", kt: "kotlin", swift: "swift",
  c: "c", h: "c", cpp: "cpp", cc: "cpp", hpp: "cpp",
  cs: "csharp", php: "php",
  html: "html", css: "css", scss: "scss", less: "less",
  json: "json", yaml: "yaml", yml: "yaml", toml: "toml", xml: "xml",
  md: "markdown", sql: "sql", sh: "bash", bash: "bash",
  vue: "vue", svelte: "svelte", dockerfile: "docker"
};

// Extensions/paths that are almost never useful as coding context and are
// silently skipped during zip extraction, rather than erroring the whole
// upload out over one bad entry.
const SKIP_PATTERNS = [
  /(^|\/)node_modules\//, /(^|\/)\.git\//, /(^|\/)dist\//, /(^|\/)build\//,
  /(^|\/)\.next\//, /(^|\/)__pycache__\//, /(^|\/)\.venv\//, /(^|\/)venv\//,
  /\.(png|jpe?g|gif|webp|ico|svg|woff2?|ttf|eot|mp4|mov|zip|tar|gz|pdf|exe|dll|so|dylib|bin|lock)$/i,
  /(^|\/)package-lock\.json$/, /(^|\/)yarn\.lock$/, /(^|\/)pnpm-lock\.yaml$/
];

function shouldSkip(path) {
  return SKIP_PATTERNS.some((re) => re.test(path));
}

function guessLanguage(path) {
  const base = path.split("/").pop().toLowerCase();
  if (base === "dockerfile") return "docker";
  const ext = base.includes(".") ? base.split(".").pop() : "";
  return LANGUAGE_BY_EXTENSION[ext] || "text";
}

/** Best-effort check for whether a buffer looks like text (vs. binary) — a null byte in the first chunk is a strong binary signal. */
function looksLikeText(buffer) {
  const sample = buffer.subarray(0, Math.min(buffer.length, 8000));
  return !sample.includes(0);
}

/**
 * Extracts a zip buffer into { path, content, sizeBytes, language }[],
 * skipping build artifacts, binaries, and anything over the per-file size
 * limit. Returns { files, skipped } where skipped is a list of {path, reason}
 * so the UI can tell the person what got left out and why.
 */
export function extractZip(buffer) {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();
  const files = [];
  const skipped = [];
  let totalSize = 0;

  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const path = entry.entryName;

    if (shouldSkip(path)) {
      skipped.push({ path, reason: "excluded pattern (build artifact, binary, or lockfile)" });
      continue;
    }
    if (files.length >= MAX_FILES_PER_UPLOAD) {
      skipped.push({ path, reason: `over the ${MAX_FILES_PER_UPLOAD}-file limit` });
      continue;
    }

    const data = entry.getData();
    if (data.length > MAX_FILE_SIZE_BYTES) {
      skipped.push({ path, reason: `file too large (${Math.round(data.length / 1024)}KB, limit ${MAX_FILE_SIZE_BYTES / 1024}KB)` });
      continue;
    }
    if (!looksLikeText(data)) {
      skipped.push({ path, reason: "appears to be a binary file" });
      continue;
    }
    if (totalSize + data.length > MAX_TOTAL_SIZE_BYTES) {
      skipped.push({ path, reason: "over the total upload size limit for this batch" });
      continue;
    }

    totalSize += data.length;
    files.push({ path, content: data.toString("utf8"), sizeBytes: data.length, language: guessLanguage(path) });
  }

  return { files, skipped };
}

/** Validates a single non-zip file upload the same way, for the "drag in a few files" path. */
export function validateSingleFile(path, buffer) {
  if (shouldSkip(path)) return { ok: false, reason: "This file type isn't useful as coding context (binary, lockfile, or build artifact)." };
  if (buffer.length > MAX_FILE_SIZE_BYTES) return { ok: false, reason: `File too large (limit ${MAX_FILE_SIZE_BYTES / 1024}KB per file).` };
  if (!looksLikeText(buffer)) return { ok: false, reason: "This appears to be a binary file, not source/text." };
  return { ok: true, content: buffer.toString("utf8"), sizeBytes: buffer.length, language: guessLanguage(path) };
}

export async function addProjectFiles(conversationId, files) {
  for (const f of files) {
    await sql`
      INSERT INTO project_files (id, conversation_id, path, content, size_bytes, language, included)
      VALUES (${randomUUID()}, ${conversationId}, ${f.path}, ${f.content}, ${f.sizeBytes}, ${f.language}, TRUE)
    `;
  }
}

export async function listProjectFiles(conversationId) {
  const result = await sql`SELECT * FROM project_files WHERE conversation_id = ${conversationId} ORDER BY path ASC`;
  return result.rows;
}

export async function toggleProjectFile(fileId, included) {
  await sql`UPDATE project_files SET included = ${included} WHERE id = ${fileId}`;
}

export async function deleteProjectFile(fileId) {
  await sql`DELETE FROM project_files WHERE id = ${fileId}`;
}

export async function deleteAllProjectFiles(conversationId) {
  await sql`DELETE FROM project_files WHERE conversation_id = ${conversationId}`;
}

/**
 * Builds the context block to prepend to the system prompt: every currently
 * "included" file, wrapped in a fenced code block labeled with its path and
 * guessed language, so the model can reference files by name in its answer.
 */
export async function buildProjectContext(conversationId) {
  const allFiles = await listProjectFiles(conversationId);
  const files = allFiles.filter((f) => f.included);
  if (files.length === 0) return "";

  const fileBlocks = files.map((f) => `--- ${f.path} ---\n\`\`\`${f.language}\n${f.content}\n\`\`\``).join("\n\n");
  return (
    `\n\nThe user has attached ${files.length} project file(s) for context. Reference specific files by their path ` +
    `when relevant, and prefer editing/extending this existing code over inventing unrelated structure:\n\n${fileBlocks}`
  );
}

export const LIMITS = { MAX_FILE_SIZE_BYTES, MAX_TOTAL_SIZE_BYTES, MAX_FILES_PER_UPLOAD };
