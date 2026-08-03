import { randomUUID } from "crypto";
import { sql } from "./db.js";

export async function logUsage({ userId, providerId, modelId, mode, success, usage, latencyMs, error }) {
  await sql`
    INSERT INTO usage_logs (id, user_id, provider_id, model_id, mode, success, input_tokens, output_tokens, latency_ms, error)
    VALUES (
      ${randomUUID()}, ${userId}, ${providerId}, ${modelId}, ${mode}, ${success},
      ${usage?.inputTokens ?? null}, ${usage?.outputTokens ?? null}, ${latencyMs ?? null}, ${error ?? null}
    )
  `;
}

export async function getUsageSummary(userId, days = 30) {
  const result = await sql`
    SELECT
      provider_id, model_id,
      COUNT(*) AS total_calls,
      SUM(CASE WHEN success THEN 1 ELSE 0 END) AS successful_calls,
      SUM(CASE WHEN success THEN 0 ELSE 1 END) AS failed_calls,
      SUM(COALESCE(input_tokens, 0)) AS total_input_tokens,
      SUM(COALESCE(output_tokens, 0)) AS total_output_tokens,
      AVG(latency_ms) AS avg_latency_ms
    FROM usage_logs
    WHERE user_id = ${userId} AND created_at >= NOW() - (${days} || ' days')::INTERVAL
    GROUP BY provider_id, model_id
    ORDER BY total_calls DESC
  `;

  const rateResult = await sql`SELECT provider_id, model_id, input_rate_per_million, output_rate_per_million FROM model_rates WHERE user_id = ${userId}`;
  const rateMap = Object.fromEntries(rateResult.rows.map((r) => [`${r.provider_id}:${r.model_id}`, r]));

  return result.rows.map((r) => {
    const rate = rateMap[`${r.provider_id}:${r.model_id}`];
    let estimatedCost = null;
    if (rate && (rate.input_rate_per_million || rate.output_rate_per_million)) {
      const inCost = (Number(r.total_input_tokens) / 1_000_000) * (rate.input_rate_per_million || 0);
      const outCost = (Number(r.total_output_tokens) / 1_000_000) * (rate.output_rate_per_million || 0);
      estimatedCost = inCost + outCost;
    }
    return {
      providerId: r.provider_id,
      modelId: r.model_id,
      totalCalls: Number(r.total_calls),
      successfulCalls: Number(r.successful_calls),
      failedCalls: Number(r.failed_calls),
      totalInputTokens: Number(r.total_input_tokens),
      totalOutputTokens: Number(r.total_output_tokens),
      avgLatencyMs: r.avg_latency_ms ? Math.round(r.avg_latency_ms) : null,
      hasRate: !!rate,
      estimatedCost
    };
  });
}

export async function getUsageTimeline(userId, days = 14) {
  const result = await sql`
    SELECT to_char(created_at, 'YYYY-MM-DD') AS day, COUNT(*) AS calls, SUM(CASE WHEN success THEN 1 ELSE 0 END) AS successes
    FROM usage_logs
    WHERE user_id = ${userId} AND created_at >= NOW() - (${days} || ' days')::INTERVAL
    GROUP BY day
    ORDER BY day ASC
  `;
  return result.rows.map((r) => ({ day: r.day, calls: Number(r.calls), successes: Number(r.successes) }));
}

export async function setModelRate(userId, providerId, modelId, { inputRatePerMillion, outputRatePerMillion }) {
  await sql`
    INSERT INTO model_rates (user_id, provider_id, model_id, input_rate_per_million, output_rate_per_million)
    VALUES (${userId}, ${providerId}, ${modelId}, ${inputRatePerMillion ?? null}, ${outputRatePerMillion ?? null})
    ON CONFLICT (user_id, provider_id, model_id) DO UPDATE SET
      input_rate_per_million = EXCLUDED.input_rate_per_million,
      output_rate_per_million = EXCLUDED.output_rate_per_million
  `;
}

export async function getModelRates(userId) {
  const result = await sql`SELECT provider_id, model_id, input_rate_per_million, output_rate_per_million FROM model_rates WHERE user_id = ${userId}`;
  return result.rows;
}

export async function deleteModelRate(userId, providerId, modelId) {
  await sql`DELETE FROM model_rates WHERE user_id = ${userId} AND provider_id = ${providerId} AND model_id = ${modelId}`;
}
