/**
 * Builds exportable representations of a conversation. Kept as its own
 * module (rather than inlined in the route) so both the HTTP route and any
 * future use (e.g. a "email me this chat" feature) can share the same
 * formatting logic.
 */

function formatTimestamp(iso) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return iso;
  }
}

/** Renders a conversation as a clean, readable Markdown document. */
export function toMarkdown(conversation, messages) {
  const lines = [];
  lines.push(`# ${conversation.title || "FrostByte conversation"}`);
  lines.push("");
  lines.push(`_Exported ${formatTimestamp(new Date().toISOString())} · started ${formatTimestamp(conversation.created_at)}_`);
  lines.push("");
  lines.push("---");
  lines.push("");

  for (const msg of messages) {
    if (msg.role === "user") {
      lines.push("### 🧑 You");
      lines.push("");
      lines.push(msg.content);
      lines.push("");
    } else if (msg.role === "assistant") {
      const badge = msg.model_used ? ` _(${msg.provider_used}/${msg.model_used})_` : "";
      lines.push(`### 🤖 FrostByte${badge}`);
      lines.push("");
      lines.push(msg.content);
      lines.push("");
    }
    // system messages are intentionally omitted from the export — they're
    // internal scaffolding (skill instructions etc.), not part of the
    // human-readable conversation.
  }

  return lines.join("\n");
}

/** Renders a conversation as structured JSON, preserving routing metadata that markdown omits. */
export function toJSON(conversation, messages) {
  return JSON.stringify(
    {
      title: conversation.title,
      createdAt: conversation.created_at,
      exportedAt: new Date().toISOString(),
      messages: messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role,
          content: m.content,
          providerUsed: m.provider_used || undefined,
          modelUsed: m.model_used || undefined,
          fallbackChain: m.fallback_chain_json ? JSON.parse(m.fallback_chain_json) : undefined,
          createdAt: m.created_at
        }))
    },
    null,
    2
  );
}

/** Turns a conversation title into a safe filename fragment. */
export function slugForFilename(title) {
  return (title || "conversation")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || "conversation";
}
