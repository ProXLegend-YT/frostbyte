import { withHandler } from "../../lib/handler.js";
import { requireAuth } from "../../lib/auth.js";
import { getUsageSummary, getUsageTimeline, getModelRates, setModelRate, deleteModelRate } from "../../lib/usageLog.js";

/**
 * Consolidated usage endpoint. See auth/[...path].js for why routes are
 * folded together like this (Vercel's 12-function cap on the Hobby plan).
 *
 * Routes handled here (all under /api/usage/...):
 *   GET    /summary?days=...   per-model usage summary
 *   GET    /timeline?days=...  calls-per-day timeline
 *   GET    /rates              list model cost rates
 *   POST   /rates               set a model's cost rate
 *   DELETE /rates                delete a model's cost rate
 */
export default withHandler(async (req, res) => {
  const rawSegments = req.query.path ?? req.query['...path'] ?? [];
  const segments = Array.isArray(rawSegments) ? rawSegments : [rawSegments].filter(Boolean);
  const method = req.method;
  const user = await requireAuth(req);

  if (segments[0] === "summary" && method === "GET") {
    const days = Math.min(parseInt(req.query.days, 10) || 30, 365);
    return res.json({ summary: await getUsageSummary(user.id, days), days });
  }

  if (segments[0] === "timeline" && method === "GET") {
    const days = Math.min(parseInt(req.query.days, 10) || 14, 90);
    return res.json({ timeline: await getUsageTimeline(user.id, days), days });
  }

  if (segments[0] === "rates") {
    if (method === "GET") {
      return res.json({ rates: await getModelRates(user.id) });
    }
    if (method === "POST") {
      const { providerId, modelId, inputRatePerMillion, outputRatePerMillion } = req.body || {};
      if (!providerId || !modelId) return res.status(400).json({ error: "providerId and modelId are required" });
      await setModelRate(user.id, providerId, modelId, {
        inputRatePerMillion: inputRatePerMillion != null ? Number(inputRatePerMillion) : null,
        outputRatePerMillion: outputRatePerMillion != null ? Number(outputRatePerMillion) : null
      });
      return res.json({ ok: true });
    }
    if (method === "DELETE") {
      const { providerId, modelId } = req.body || {};
      if (!providerId || !modelId) return res.status(400).json({ error: "providerId and modelId are required" });
      await deleteModelRate(user.id, providerId, modelId);
      return res.json({ ok: true });
    }
  }

  res.status(404).json({ error: "Not found" });
});
