import { callModel } from "./callModel.js";
import { getProviderById } from "./providerStore.js";
import { logUsage } from "./usageLog.js";

const DEFAULT_TIMEOUT_MS = 45_000;

/**
 * Runs a chain of provider:model steps in order. On failure (network error,
 * non-2xx, empty output, or timeout) it moves to the next step. Returns the
 * first success plus a full attempt log so the UI can show exactly what
 * happened ("Grok failed (rate limited) -> fell back to GLM-5.2 -> succeeded").
 *
 * Note: this Vercel port does not include the streaming variant from the
 * self-hosted version — Vercel's standard Node serverless functions buffer
 * responses rather than streaming them token-by-token, so answers arrive
 * complete rather than typed out live. Everything else about fallback
 * behavior is unchanged.
 *
 * chain: array of { providerId, modelId }
 */
export async function runWithFallback({ userId, chain, messages, temperature, maxTokens, onAttempt }) {
  const attempts = [];

  for (const step of chain) {
    const provider = await getProviderById(userId, step.providerId);
    if (!provider) {
      attempts.push({ providerId: step.providerId, modelId: step.modelId, ok: false, error: "Unknown provider" });
      continue;
    }
    if (!provider.hasKey && !provider.noKeyRequired) {
      attempts.push({ providerId: step.providerId, modelId: step.modelId, ok: false, error: "No API key set", skipped: true });
      continue;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    onAttempt?.({ providerId: step.providerId, modelId: step.modelId, status: "trying" });

    const result = await callModel({ userId, provider, modelId: step.modelId, messages, temperature, maxTokens, signal: controller.signal });
    clearTimeout(timer);

    await logUsage({
      userId,
      providerId: step.providerId,
      modelId: step.modelId,
      mode: "fallback",
      success: result.ok,
      usage: result.usage,
      latencyMs: result.latencyMs,
      error: result.ok ? null : result.error
    });

    attempts.push({ providerId: step.providerId, modelId: step.modelId, ok: result.ok, error: result.error, latencyMs: result.latencyMs });
    onAttempt?.({ providerId: step.providerId, modelId: step.modelId, status: result.ok ? "success" : "failed", error: result.error });

    if (result.ok) {
      return { ok: true, text: result.text, usedProvider: step.providerId, usedModel: step.modelId, attempts };
    }
  }

  return { ok: false, text: null, error: "All models in the fallback chain failed.", attempts };
}

/**
 * Fusion mode: calls several models in parallel, then asks a "synthesizer"
 * model to merge the best parts of each into a single answer.
 */
export async function runFusion({ userId, members, synthesizerStep, messages, temperature, maxTokens, onAttempt }) {
  const settled = await Promise.all(
    members.map(async (step) => {
      const provider = await getProviderById(userId, step.providerId);
      if (!provider || (!provider.hasKey && !provider.noKeyRequired)) {
        onAttempt?.({ providerId: step.providerId, modelId: step.modelId, status: "skipped" });
        return { ...step, ok: false, error: "No API key set" };
      }
      onAttempt?.({ providerId: step.providerId, modelId: step.modelId, status: "trying" });
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
      const result = await callModel({ userId, provider, modelId: step.modelId, messages, temperature, maxTokens, signal: controller.signal });
      clearTimeout(timer);

      await logUsage({
        userId,
        providerId: step.providerId,
        modelId: step.modelId,
        mode: "fusion",
        success: result.ok,
        usage: result.usage,
        latencyMs: result.latencyMs,
        error: result.ok ? null : result.error
      });

      onAttempt?.({ providerId: step.providerId, modelId: step.modelId, status: result.ok ? "success" : "failed", error: result.error });
      return { ...step, ...result };
    })
  );

  const successes = settled.filter((s) => s.ok);

  if (successes.length === 0) {
    return { ok: false, error: "All fusion members failed.", attempts: settled };
  }
  if (successes.length === 1) {
    return { ok: true, text: successes[0].text, usedProvider: successes[0].provider, usedModel: successes[0].model, attempts: settled, fused: false };
  }

  const synthesisPrompt = [
    {
      role: "system",
      content:
        "You are a synthesis engine. You will be given multiple AI-generated answers to the same coding question, from different models. " +
        "Merge them into a single best answer: keep the most correct and complete code, resolve contradictions in favor of the more rigorous/correct approach, " +
        "and remove redundancy. Output only the final merged answer, with no meta-commentary about the merging process."
    },
    {
      role: "user",
      content:
        `Original question:\n${messages[messages.length - 1]?.content}\n\n` +
        successes.map((s, i) => `--- Answer ${i + 1} (from ${s.provider}/${s.model}) ---\n${s.text}`).join("\n\n")
    }
  ];

  const synthProvider = await getProviderById(userId, synthesizerStep.providerId);
  const synthResult =
    synthProvider && synthProvider.hasKey
      ? await callModel({ userId, provider: synthProvider, modelId: synthesizerStep.modelId, messages: synthesisPrompt, temperature: 0.2, maxTokens })
      : { ok: false };

  if (synthProvider && synthProvider.hasKey) {
    await logUsage({
      userId,
      providerId: synthesizerStep.providerId,
      modelId: synthesizerStep.modelId,
      mode: "fusion-synthesis",
      success: synthResult.ok,
      usage: synthResult.usage,
      latencyMs: synthResult.latencyMs,
      error: synthResult.ok ? null : synthResult.error
    });
  }

  if (synthResult.ok) {
    return { ok: true, text: synthResult.text, usedProvider: "fusion", usedModel: "frostbyte-fusion", attempts: settled, fused: true, members: successes.map((s) => s.provider) };
  }

  const best = successes.sort((a, b) => b.text.length - a.text.length)[0];
  return { ok: true, text: best.text, usedProvider: best.provider, usedModel: best.model, attempts: settled, fused: false, note: "Synthesizer unavailable; returned best single answer." };
}
