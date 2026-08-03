import { resolveApiKey } from "./providerStore.js";
import { getByPath } from "./jsonPath.js";

/**
 * Calls a single provider/model and returns a normalized result:
 *   { ok: true, text, raw, provider, model, latencyMs, usage }
 *   { ok: false, error, provider, model, latencyMs, status }
 *
 * This is the ONLY place that needs to know about each provider's quirks.
 * Everything above this layer (router, fallback engine, fusion) just deals
 * with the normalized shape.
 *
 * Uses the Node runtime's built-in fetch (available on Vercel's Node 18+
 * functions) rather than the node-fetch package, since it's no longer
 * needed once running on a platform that ships fetch natively.
 *
 * Three request/response "styles" are supported:
 *   - "openai": the de-facto standard /chat/completions shape (OpenRouter,
 *     Cerebras, Z.ai, Grok, HF, NVIDIA, Cloudflare, and most others)
 *   - "anthropic": the Messages API shape (system prompt separated from
 *     messages[], response text under content[].text)
 *   - "custom": for anything that doesn't match either — the request body
 *     is built from a user-supplied JSON template with {{messages}},
 *     {{model}}, {{temperature}}, {{max_tokens}} placeholders, and the
 *     response text/usage are pulled out via user-supplied JSON paths
 *     (see jsonPath.js). This is what makes "add literally any API" work
 *     without FrostByte needing to special-case every provider that isn't
 *     OpenAI- or Anthropic-shaped.
 */
export async function callModel({ userId, provider, modelId, messages, temperature = 0.4, maxTokens = 4096, signal }) {
  const start = Date.now();
  const apiKey = await resolveApiKey(userId, provider.id);

  if (!apiKey && !provider.noKeyRequired) {
    return {
      ok: false,
      error: `No API key configured for ${provider.name}`,
      provider: provider.id,
      model: modelId,
      latencyMs: Date.now() - start,
      status: 401
    };
  }

  try {
    let url = provider.baseUrl.replace("{account_id}", provider.accountId || "");
    url += provider.chatPath || "/chat/completions";

    const headers = { "Content-Type": "application/json", ...(provider.extraHeaders || {}) };
    if (apiKey) headers[provider.authHeader] = `${provider.authPrefix || ""}${apiKey}`;

    let body;
    if (provider.style === "anthropic") {
      // Anthropic Messages API shape: system prompt is separate, no "system" role in messages[]
      const systemMsg = messages.find((m) => m.role === "system");
      const rest = messages.filter((m) => m.role !== "system");
      body = {
        model: modelId,
        max_tokens: maxTokens,
        temperature,
        messages: rest,
        ...(systemMsg ? { system: systemMsg.content } : {})
      };
    } else if (provider.style === "custom" && provider.requestTemplate) {
      body = buildFromTemplate(provider.requestTemplate, { messages, model: modelId, temperature, max_tokens: maxTokens });
    } else {
      // OpenAI-compatible shape (OpenRouter, Cerebras, Z.ai, Grok, HF, NVIDIA, Cloudflare, custom without a template...)
      body = { model: modelId, messages, temperature, max_tokens: maxTokens, stream: false };
    }

    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal });
    const latencyMs = Date.now() - start;

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return { ok: false, error: `HTTP ${res.status}: ${errText.slice(0, 300)}`, provider: provider.id, model: modelId, latencyMs, status: res.status };
    }

    const data = await res.json();
    let text;
    let usage = null;

    if (provider.style === "anthropic") {
      text = (data.content || []).map((b) => b.text || "").join("\n");
      if (data.usage) {
        usage = { inputTokens: data.usage.input_tokens ?? null, outputTokens: data.usage.output_tokens ?? null };
      }
    } else if (provider.style === "custom" && provider.responseTextPath) {
      const extracted = getByPath(data, provider.responseTextPath);
      text = typeof extracted === "string" ? extracted : Array.isArray(extracted) ? extracted.join("\n") : extracted != null ? String(extracted) : "";
      if (provider.responseInputTokensPath || provider.responseOutputTokensPath) {
        usage = {
          inputTokens: provider.responseInputTokensPath ? getByPath(data, provider.responseInputTokensPath) ?? null : null,
          outputTokens: provider.responseOutputTokensPath ? getByPath(data, provider.responseOutputTokensPath) ?? null : null
        };
      }
    } else {
      text = data.choices?.[0]?.message?.content ?? "";
      if (data.usage) {
        // Most OpenAI-compatible providers report prompt_tokens/completion_tokens;
        // a few (rare) use input_tokens/output_tokens directly — check both.
        usage = {
          inputTokens: data.usage.prompt_tokens ?? data.usage.input_tokens ?? null,
          outputTokens: data.usage.completion_tokens ?? data.usage.output_tokens ?? null
        };
      }
    }

    if (!text || !text.trim()) {
      const hint =
        provider.style === "custom"
          ? ` (check the response text path "${provider.responseTextPath || "(not set)"}" matches this provider's actual response shape)`
          : "";
      return { ok: false, error: `Empty response from model${hint}`, provider: provider.id, model: modelId, latencyMs, status: 502 };
    }

    return { ok: true, text, raw: data, provider: provider.id, model: modelId, latencyMs, usage };
  } catch (err) {
    return {
      ok: false,
      error: err.name === "AbortError" ? "Request timed out" : err.message,
      provider: provider.id,
      model: modelId,
      latencyMs: Date.now() - start,
      status: err.name === "AbortError" ? 408 : 500
    };
  }
}

/**
 * Fills a user-supplied JSON request template with the actual call values.
 * Placeholders are matched as whole-string template values (not
 * string-interpolated), so {{max_tokens}} used as a raw JSON number value
 * comes out as a real number, not the string "1024" — important since many
 * APIs are strict about type for fields like max_tokens.
 */
function buildFromTemplate(template, values) {
  const placeholderMap = {
    "{{messages}}": values.messages,
    "{{model}}": values.model,
    "{{temperature}}": values.temperature,
    "{{max_tokens}}": values.max_tokens
  };

  function fill(node) {
    if (typeof node === "string" && Object.prototype.hasOwnProperty.call(placeholderMap, node)) {
      return placeholderMap[node];
    }
    if (Array.isArray(node)) return node.map(fill);
    if (node && typeof node === "object") {
      const out = {};
      for (const [k, v] of Object.entries(node)) out[k] = fill(v);
      return out;
    }
    return node;
  }

  return fill(template);
}
