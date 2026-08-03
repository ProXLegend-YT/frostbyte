import { randomUUID } from "crypto";
import { withHandler } from "../lib/handler.js";
import { requireAuth } from "../lib/auth.js";
import { sql } from "../lib/db.js";
import { runWithFallback, runFusion } from "../lib/fallbackEngine.js";
import { FUSION_MODEL } from "../lib/providers.js";
import { buildSkillPrompt } from "../lib/skillInstructions.js";
import { buildProjectContext } from "../lib/projectFiles.js";

/** Injects the currently-enabled skills' instructions, plus any attached project files, into the system message. */
async function applyContext(messages, conversationId) {
  const enabledResult = await sql`SELECT name FROM tools WHERE enabled = TRUE`;
  const skillAddendum = buildSkillPrompt(enabledResult.rows.map((r) => r.name));
  const projectAddendum = conversationId ? await buildProjectContext(conversationId) : "";
  const addendum = skillAddendum + projectAddendum;
  if (!addendum) return messages;

  const copy = [...messages];
  const sysIdx = copy.findIndex((m) => m.role === "system");
  if (sysIdx >= 0) {
    copy[sysIdx] = { ...copy[sysIdx], content: copy[sysIdx].content + addendum };
  } else {
    copy.unshift({ role: "system", content: "You are FrostByte, an expert coding assistant." + addendum });
  }
  return copy;
}

/**
 * POST /api/chat
 * body: {
 *   conversationId?: string,
 *   messages: [{role, content}],
 *   mode: "single" | "fallback" | "fusion",
 *   chain: [{providerId, modelId}],
 *   fusionMembers?: [{providerId, modelId}],
 *   synthesizer?: {providerId, modelId},
 *   temperature?: number,
 *   maxTokens?: number
 * }
 *
 * Note: unlike the self-hosted version, this does not support Server-Sent
 * Events / token-by-token streaming. Vercel's standard Node serverless
 * functions buffer the full response rather than streaming it incrementally
 * the way a persistent Express server can, so the frontend gets the complete
 * answer in one response instead of watching it type out live. Everything
 * else — the fallback chain, fusion, routing-attempt info, project file
 * context, skill instructions — behaves identically.
 */
export default withHandler(async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = await requireAuth(req);
  const {
    conversationId,
    messages,
    mode = "fallback",
    chain = [],
    fusionMembers,
    synthesizer,
    temperature = 0.4,
    maxTokens = 4096
  } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages is required" });
  }

  // If a conversationId is supplied, make sure it actually belongs to this
  // user (or doesn't exist yet, in which case this request will create it) —
  // otherwise user A could append messages into user B's conversation by
  // guessing/reusing an id.
  if (conversationId) {
    const existingResult = await sql`SELECT user_id FROM conversations WHERE id = ${conversationId}`;
    const existing = existingResult.rows[0];
    if (existing && existing.user_id !== user.id) {
      return res.status(403).json({ error: "This conversation doesn't belong to you." });
    }
  }

  const effectiveMessages = await applyContext(messages, conversationId);
  const onAttempt = () => {}; // no SSE channel to report live progress to in this deployment; attempts are still returned in the final result

  let result;
  if (mode === "fusion") {
    const members = fusionMembers?.length
      ? fusionMembers
      : FUSION_MODEL.defaultMembers.map((m) => {
          const [providerId, modelId] = m.split(":");
          return { providerId, modelId };
        });
    const synth = synthesizer || members[0];
    result = await runFusion({ userId: user.id, members, synthesizerStep: synth, messages: effectiveMessages, temperature, maxTokens, onAttempt });
  } else {
    const effectiveChain = mode === "single" ? [chain[0]] : chain;
    if (!effectiveChain?.length) {
      return res.status(400).json({ error: "No model chain provided" });
    }
    result = await runWithFallback({ userId: user.id, chain: effectiveChain, messages: effectiveMessages, temperature, maxTokens, onAttempt });
  }

  // Persist conversation + message if a conversationId is given
  let persistedUserMessageId = null;
  let persistedAssistantMessageId = null;
  if (conversationId) {
    const firstUserMsg = messages.find((m) => m.role === "user");
    await sql`
      INSERT INTO conversations (id, user_id, title)
      VALUES (${conversationId}, ${user.id}, ${firstUserMsg?.content?.slice(0, 60) || "New chat"})
      ON CONFLICT (id) DO UPDATE SET updated_at = NOW()
    `;

    // The user and assistant rows for this turn get their OWN distinct,
    // strictly-increasing timestamps so that "truncate everything from
    // message X onward" (the primitive edit/regenerate rely on) can target
    // just the assistant reply without also catching the user message that
    // produced it.
    const lastUser = messages[messages.length - 1];
    const userTimestamp = new Date();
    persistedUserMessageId = randomUUID();
    await sql`
      INSERT INTO messages (id, conversation_id, role, content, created_at)
      VALUES (${persistedUserMessageId}, ${conversationId}, 'user', ${lastUser.content}, ${userTimestamp.toISOString()})
    `;

    if (result.ok) {
      persistedAssistantMessageId = randomUUID();
      const assistantTimestamp = new Date(userTimestamp.getTime() + 1).toISOString();
      await sql`
        INSERT INTO messages (id, conversation_id, role, content, provider_used, model_used, fallback_chain_json, created_at)
        VALUES (
          ${persistedAssistantMessageId}, ${conversationId}, 'assistant', ${result.text},
          ${result.usedProvider}, ${result.usedModel}, ${JSON.stringify(result.attempts)}, ${assistantTimestamp}
        )
      `;
    }
  }

  result.userMessageId = persistedUserMessageId;
  result.assistantMessageId = persistedAssistantMessageId;
  res.json(result);
});
