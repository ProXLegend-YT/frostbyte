import { sql } from "@vercel/postgres";
import { TOOL_CATEGORIES_SERVER } from "./toolCatalog.js";

/**
 * Schema + migrations for Vercel Postgres. This replaces the previous
 * SQLite/better-sqlite3 setup entirely — Vercel's serverless functions have
 * no persistent local disk, so a file-based database can't survive between
 * invocations there. Vercel Postgres is a hosted, always-on database that
 * serverless functions can reach over the network instead.
 *
 * All queries elsewhere in the app are now async (`await sql\`...\``)
 * instead of the synchronous better-sqlite3 calls they used to be — this
 * function itself is called once per cold start to ensure tables exist.
 */
let initialized = false;

export async function ensureSchema() {
  if (initialized) return; // avoid re-running this on every invocation of a warm function
  initialized = true;

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      id TEXT,
      user_id TEXT NOT NULL REFERENCES users(id),
      user_agent TEXT,
      ip_address TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS api_keys (
      user_id TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      encrypted_key TEXT NOT NULL,
      account_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (user_id, provider_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS custom_providers (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      base_url TEXT NOT NULL,
      chat_path TEXT DEFAULT '/chat/completions',
      auth_header TEXT DEFAULT 'Authorization',
      auth_prefix TEXT DEFAULT 'Bearer ',
      style TEXT DEFAULT 'openai',
      models_json TEXT DEFAULT '[]',
      extra_headers_json TEXT DEFAULT '{}',
      request_template_json TEXT,
      response_text_path TEXT,
      response_input_tokens_path TEXT,
      response_output_tokens_path TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS tools (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT,
      kind TEXT DEFAULT 'prompt_tool',
      config_json TEXT DEFAULT '{}',
      enabled BOOLEAN DEFAULT TRUE,
      is_builtin BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS chains (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      members_json TEXT NOT NULL,
      is_fusion BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id),
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      provider_used TEXT,
      model_used TEXT,
      fallback_chain_json TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages (conversation_id, created_at)`;

  await sql`
    CREATE TABLE IF NOT EXISTS usage_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      model_id TEXT NOT NULL,
      mode TEXT NOT NULL,
      success BOOLEAN NOT NULL,
      input_tokens INTEGER,
      output_tokens INTEGER,
      latency_ms INTEGER,
      error TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_usage_logs_user_time ON usage_logs (user_id, created_at)`;

  await sql`
    CREATE TABLE IF NOT EXISTS model_rates (
      user_id TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      model_id TEXT NOT NULL,
      input_rate_per_million REAL,
      output_rate_per_million REAL,
      PRIMARY KEY (user_id, provider_id, model_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS project_files (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id),
      path TEXT NOT NULL,
      content TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      language TEXT,
      included BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_project_files_conversation ON project_files (conversation_id)`;

  // Seeds every built-in skill into the tools table (enabled by default) so
  // toggling state persists. ON CONFLICT DO NOTHING makes this safe to re-run
  // on every cold start — there's no separate "server boot" hook in
  // serverless the way the self-hosted Express app had, so this lives here
  // instead, folded into the same lazy once-per-cold-start initialization.
  for (const category of TOOL_CATEGORIES_SERVER) {
    for (const toolName of category.tools) {
      await sql`
        INSERT INTO tools (id, name, description, category, kind, config_json, enabled, is_builtin)
        VALUES (${`builtin:${toolName}`}, ${toolName}, '', ${category.name}, 'skill', '{}', TRUE, TRUE)
        ON CONFLICT (id) DO NOTHING
      `;
    }
  }
}

export { sql };
