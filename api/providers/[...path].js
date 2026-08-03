import { withHandler } from "../../lib/handler.js";
import { requireAuth } from "../../lib/auth.js";
import {
  listProviders,
  saveApiKey,
  deleteApiKey,
  addCustomProvider,
  updateCustomProvider,
  removeCustomProvider,
  getProviderById,
  resolveApiKey
} from "../../lib/providerStore.js";
import { TOOL_PROVIDERS, FUSION_MODEL } from "../../lib/providers.js";
import { callModel } from "../../lib/callModel.js";
import { validateCustomProviderInput } from "../../lib/validateProvider.js";

/**
 * Consolidated providers endpoint. See auth/[...path].js for why routes are
 * folded together like this (Vercel's 12-function cap on the Hobby plan).
 *
 * Routes handled here (all under /api/providers/...):
 *   GET    /                     list providers
 *   POST   /:id/key              save an API key
 *   DELETE /:id/key              delete an API key
 *   POST   /:id/test             test a provider connection
 *   POST   /custom               create a custom provider
 *   PATCH  /custom/:id           update a custom provider
 *   DELETE /custom/:id           delete a custom provider
 */
export default withHandler(async (req, res) => {
  const rawSegments = req.query.path ?? req.query['...path'] ?? [];
  const segments = Array.isArray(rawSegments) ? rawSegments : [rawSegments].filter(Boolean);
  const method = req.method;
  const user = await requireAuth(req);

  // GET /api/providers -> list
  if (segments.length === 0 && method === "GET") {
    const toolProviders = await Promise.all(TOOL_PROVIDERS.map(async (t) => ({ ...t, hasKey: !!(await resolveApiKey(user.id, t.id)) })));
    return res.json({ providers: await listProviders(user.id), toolProviders, fusion: FUSION_MODEL });
  }

  // /api/providers/custom and /api/providers/custom/:id
  if (segments[0] === "custom") {
    if (segments.length === 1 && method === "POST") {
      const {
        id,
        name,
        baseUrl,
        chatPath,
        authHeader,
        authPrefix,
        style,
        models,
        extraHeaders,
        requestTemplate,
        responseTextPath,
        responseInputTokensPath,
        responseOutputTokensPath
      } = req.body || {};

      if (!id || !name || !baseUrl) return res.status(400).json({ error: "id, name, baseUrl are required" });
      if (!/^[a-z0-9-]+$/i.test(id)) return res.status(400).json({ error: "id can only contain letters, numbers, and hyphens" });

      const validationError = validateCustomProviderInput(req.body || {});
      if (validationError) return res.status(400).json({ error: validationError });

      const scopedId = await addCustomProvider(user.id, {
        id,
        name,
        baseUrl,
        chatPath,
        authHeader,
        authPrefix,
        style,
        models,
        extraHeaders,
        requestTemplate,
        responseTextPath,
        responseInputTokensPath,
        responseOutputTokensPath
      });
      return res.json({ ok: true, id: scopedId });
    }

    if (segments.length === 2 && method === "PATCH") {
      const validationError = validateCustomProviderInput(req.body || {});
      if (validationError) return res.status(400).json({ error: validationError });
      await updateCustomProvider(user.id, segments[1], req.body || {});
      return res.json({ ok: true });
    }

    if (segments.length === 2 && method === "DELETE") {
      await removeCustomProvider(user.id, segments[1]);
      return res.json({ ok: true });
    }
  }

  // /api/providers/:id/key
  if (segments.length === 2 && segments[1] === "key") {
    const providerId = segments[0];
    if (method === "POST") {
      const { apiKey, accountId } = req.body || {};
      if (!apiKey || typeof apiKey !== "string") return res.status(400).json({ error: "apiKey is required" });
      await saveApiKey(user.id, providerId, apiKey.trim(), accountId || null);
      return res.json({ ok: true });
    }
    if (method === "DELETE") {
      await deleteApiKey(user.id, providerId);
      return res.json({ ok: true });
    }
  }

  // /api/providers/:id/test
  if (segments.length === 2 && segments[1] === "test" && method === "POST") {
    const providerId = segments[0];
    const provider = await getProviderById(user.id, providerId);
    if (!provider) return res.status(404).json({ error: "Provider not found" });

    const modelId = req.body?.modelId || provider.models?.[0]?.id;
    if (!modelId) return res.status(400).json({ error: "No model to test with — add at least one model first" });

    const result = await callModel({
      userId: user.id,
      provider,
      modelId,
      messages: [{ role: "user", content: "Reply with exactly: OK" }],
      temperature: 0,
      maxTokens: 20
    });
    return res.json(result.ok ? { ok: true, sample: result.text, latencyMs: result.latencyMs } : { ok: false, error: result.error });
  }

  res.status(404).json({ error: "Not found" });
});
