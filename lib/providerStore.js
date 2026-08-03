import { sql } from "./db.js";
import { encrypt, decrypt } from "./crypto.js";
import { BUILTIN_PROVIDERS } from "./providers.js";

export async function listProviders(userId) {
  const customResult = await sql`SELECT * FROM custom_providers WHERE user_id = ${userId}`;
  const custom = customResult.rows.map((r) => ({
    id: r.id,
    name: r.name,
    baseUrl: r.base_url,
    chatPath: r.chat_path,
    authHeader: r.auth_header,
    authPrefix: r.auth_prefix,
    style: r.style,
    models: JSON.parse(r.models_json || "[]"),
    extraHeaders: JSON.parse(r.extra_headers_json || "{}"),
    requestTemplate: r.request_template_json ? JSON.parse(r.request_template_json) : null,
    responseTextPath: r.response_text_path || null,
    responseInputTokensPath: r.response_input_tokens_path || null,
    responseOutputTokensPath: r.response_output_tokens_path || null,
    isCustom: true
  }));

  const all = [...BUILTIN_PROVIDERS, ...custom];
  const keyResult = await sql`SELECT provider_id, account_id FROM api_keys WHERE user_id = ${userId}`;
  const keyed = new Set(keyResult.rows.map((k) => k.provider_id));
  const accountIds = Object.fromEntries(keyResult.rows.map((k) => [k.provider_id, k.account_id]));

  return all.map((p) => ({ ...p, hasKey: keyed.has(p.id), accountId: accountIds[p.id] || null }));
}

export async function getProviderById(userId, id) {
  const all = await listProviders(userId);
  return all.find((p) => p.id === id);
}

export async function saveApiKey(userId, providerId, apiKey, accountId = null) {
  const enc = encrypt(apiKey);
  await sql`
    INSERT INTO api_keys (user_id, provider_id, encrypted_key, account_id)
    VALUES (${userId}, ${providerId}, ${enc}, ${accountId})
    ON CONFLICT (user_id, provider_id) DO UPDATE SET encrypted_key = EXCLUDED.encrypted_key, account_id = EXCLUDED.account_id
  `;
}

export async function deleteApiKey(userId, providerId) {
  await sql`DELETE FROM api_keys WHERE user_id = ${userId} AND provider_id = ${providerId}`;
}

export async function resolveApiKey(userId, providerId) {
  const result = await sql`SELECT encrypted_key FROM api_keys WHERE user_id = ${userId} AND provider_id = ${providerId}`;
  const row = result.rows[0];
  if (!row) return null;
  return decrypt(row.encrypted_key);
}

export async function addCustomProvider(
  userId,
  { id, name, baseUrl, chatPath, authHeader, authPrefix, style, models, extraHeaders, requestTemplate, responseTextPath, responseInputTokensPath, responseOutputTokensPath }
) {
  const scopedId = `${userId}:${id}`;
  await sql`
    INSERT INTO custom_providers (
      id, user_id, name, base_url, chat_path, auth_header, auth_prefix, style, models_json,
      extra_headers_json, request_template_json, response_text_path, response_input_tokens_path, response_output_tokens_path
    ) VALUES (
      ${scopedId}, ${userId}, ${name}, ${baseUrl}, ${chatPath || "/chat/completions"}, ${authHeader || "Authorization"},
      ${authPrefix ?? "Bearer "}, ${style || "openai"}, ${JSON.stringify(models || [])},
      ${JSON.stringify(extraHeaders || {})}, ${requestTemplate ? JSON.stringify(requestTemplate) : null},
      ${responseTextPath || null}, ${responseInputTokensPath || null}, ${responseOutputTokensPath || null}
    )
  `;
  return scopedId;
}

export async function updateCustomProvider(userId, id, updates) {
  const existingResult = await sql`SELECT * FROM custom_providers WHERE id = ${id} AND user_id = ${userId}`;
  const existing = existingResult.rows[0];
  if (!existing) throw new Error("Custom provider not found");

  const merged = {
    name: updates.name ?? existing.name,
    baseUrl: updates.baseUrl ?? existing.base_url,
    chatPath: updates.chatPath ?? existing.chat_path,
    authHeader: updates.authHeader ?? existing.auth_header,
    authPrefix: updates.authPrefix ?? existing.auth_prefix,
    style: updates.style ?? existing.style,
    models: updates.models ?? JSON.parse(existing.models_json || "[]"),
    extraHeaders: updates.extraHeaders ?? JSON.parse(existing.extra_headers_json || "{}"),
    requestTemplate: updates.requestTemplate !== undefined ? updates.requestTemplate : existing.request_template_json ? JSON.parse(existing.request_template_json) : null,
    responseTextPath: updates.responseTextPath !== undefined ? updates.responseTextPath : existing.response_text_path,
    responseInputTokensPath: updates.responseInputTokensPath !== undefined ? updates.responseInputTokensPath : existing.response_input_tokens_path,
    responseOutputTokensPath: updates.responseOutputTokensPath !== undefined ? updates.responseOutputTokensPath : existing.response_output_tokens_path
  };

  await sql`
    UPDATE custom_providers SET
      name = ${merged.name}, base_url = ${merged.baseUrl}, chat_path = ${merged.chatPath}, auth_header = ${merged.authHeader},
      auth_prefix = ${merged.authPrefix}, style = ${merged.style}, models_json = ${JSON.stringify(merged.models)},
      extra_headers_json = ${JSON.stringify(merged.extraHeaders)},
      request_template_json = ${merged.requestTemplate ? JSON.stringify(merged.requestTemplate) : null},
      response_text_path = ${merged.responseTextPath || null},
      response_input_tokens_path = ${merged.responseInputTokensPath || null},
      response_output_tokens_path = ${merged.responseOutputTokensPath || null}
    WHERE id = ${id} AND user_id = ${userId}
  `;
}

export async function removeCustomProvider(userId, id) {
  await sql`DELETE FROM custom_providers WHERE id = ${id} AND user_id = ${userId}`;
  await sql`DELETE FROM api_keys WHERE provider_id = ${id} AND user_id = ${userId}`;
}
