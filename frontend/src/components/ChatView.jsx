import React, { useEffect, useRef, useState } from "react";
import { ArrowUp, Snowflake, Search, Loader2, Download, ChevronDown, Pencil, RefreshCw } from "lucide-react";
import ModelPicker from "./ModelPicker.jsx";
import RoutingTrace from "./RoutingTrace.jsx";
import MarkdownLite from "./MarkdownLite.jsx";
import ProjectFilesPanel from "./ProjectFilesPanel.jsx";
import { api } from "../lib/api.js";

const STARTER_PROMPTS = [
  "Write a rate limiter middleware for Express",
  "Explain why this React effect re-runs infinitely",
  "Convert this callback-based function to async/await",
  "Design a database schema for a task tracker"
];

export default function ChatView({ providers, fusion, conversationId, onConversationCreated }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [mode, setMode] = useState("fallback");
  const [chain, setChain] = useState([]);
  const [webSearch, setWebSearch] = useState(false);
  const scrollRef = useRef(null);

  const hasConfigured = providers.some((p) => p.hasKey);

  // Seed a sensible default fallback chain once providers load
  useEffect(() => {
    if (chain.length > 0) return;
    const configured = providers.filter((p) => p.hasKey);
    const preferredOrder = ["anthropic", "zai", "grok", "cerebras", "opencode-zen", "openrouter"];
    const ordered = preferredOrder
      .map((id) => configured.find((p) => p.id === id))
      .filter(Boolean)
      .concat(configured.filter((p) => !preferredOrder.includes(p.id)));
    const seeded = ordered.slice(0, 3).map((p) => ({ providerId: p.id, modelId: p.models[0]?.id }));
    if (seeded.length) setChain(seeded);
  }, [providers]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    api.getMessages(conversationId).then((data) => {
      setMessages(
        data.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          attempts: m.fallbackChain,
          providerUsed: m.provider_used,
          modelUsed: m.model_used
        }))
      );
    });
  }, [conversationId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  /**
   * Sends a message. Normally this appends to the current `messages` state,
   * but `historyOverride` lets edit/regenerate reuse this exact same
   * streaming + fallback + persistence logic against a *truncated* history
   * instead — e.g. "everything up to and including the edited user message,
   * with a fresh assistant reply appended" — rather than duplicating all of
   * this logic in three places.
   */
  const send = async (text, historyOverride) => {
    const content = (text ?? input).trim();
    if (!content || sending) return;
    if (mode !== "fusion" && chain.length === 0) return;

    setInput("");
    let convId = conversationId;
    if (!convId) {
      const created = await api.createConversation();
      convId = created.id;
      onConversationCreated?.(convId);
    }

    let userContent = content;
    if (webSearch) {
      try {
        const results = await api.tavilySearch(content);
        if (results.ok) {
          const ctx = results.results
            .slice(0, 4)
            .map((r) => `- ${r.title}: ${r.content.slice(0, 200)} (${r.url})`)
            .join("\n");
          userContent = `${content}\n\n[Live web search context]\n${ctx}`;
        }
      } catch {
        /* search is best-effort; continue without it */
      }
    }

    const baseHistory = historyOverride ?? messages;
    const nextMessages = [...baseHistory, { role: "user", content }];
    setMessages([...nextMessages, { role: "assistant", content: "", pending: true, attempts: [] }]);
    setSending(true);

    try {
      const apiMessages = [
        { role: "system", content: "You are FrostByte, an expert coding assistant. Be precise, show working code, and explain trade-offs briefly." },
        ...nextMessages.slice(0, -1).map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: userContent }
      ];

      const result = await api.chatStream({
        conversationId: convId,
        messages: apiMessages,
        mode,
        chain,
        fusionMembers: mode === "fusion" ? fusion?.defaultMembers.map((m) => { const [providerId, modelId] = m.split(":"); return { providerId, modelId }; }) : undefined
      });

      setMessages((prev) => {
        const copy = [...prev];
        const finalContent = result.ok
          ? result.text
          : `**Every model in the chain failed.**\n\n${result.attempts?.map((a) => `- ${a.providerId}/${a.modelId}: ${a.error}`).join("\n") || result.error}`;

        copy[copy.length - 1] = {
          id: result.assistantMessageId,
          role: "assistant",
          content: finalContent,
          attempts: result.attempts,
          fused: result.fused,
          providerUsed: result.usedProvider,
          modelUsed: result.usedModel,
          pending: false
        };
        // The user message just sent is the second-to-last entry at this
        // point — tag it with its real database id too, so it can be edited
        // again later without needing a page reload first.
        if (result.userMessageId && copy.length >= 2) {
          copy[copy.length - 2] = { ...copy[copy.length - 2], id: result.userMessageId };
        }
        return copy;
      });
    } catch (err) {
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: "assistant", content: `**Request failed:** ${err.message}`, pending: false, attempts: [] };
        return copy;
      });
    } finally {
      setSending(false);
    }
  };

  /**
   * Edits a previously-sent user message: truncates the conversation (both
   * locally and on the server) back to just before that message, then
   * re-sends the edited text as a brand-new turn, getting a fresh answer.
   * The original message and everything after it — including whatever the
   * model said in response — is genuinely deleted, not just hidden, so
   * exports and search reflect the edited version, not a stale duplicate.
   */
  const editMessage = async (messageIndex, newContent) => {
    if (sending || !newContent.trim()) return;
    const target = messages[messageIndex];
    const historyBefore = messages.slice(0, messageIndex);

    if (conversationId && target?.id) {
      try {
        await api.truncateFromMessage(conversationId, target.id);
      } catch {
        /* if truncation fails server-side, still proceed locally — worst
           case the old turn's rows linger in the DB rather than blocking
           the person from continuing their conversation */
      }
    }

    setMessages(historyBefore);
    await send(newContent.trim(), historyBefore);
  };

  /**
   * Regenerates an assistant response: truncates just that response (keeping
   * the user question that prompted it), then resends the same question as
   * a fresh turn. Reuses editMessage's exact truncate-then-resend mechanics
   * by treating "the question below this answer" as what's being resent.
   */
  const regenerate = async (assistantIndex) => {
    if (sending || assistantIndex === 0) return;
    const userMessage = messages[assistantIndex - 1];
    if (!userMessage || userMessage.role !== "user") return;
    await editMessage(assistantIndex - 1, userMessage.content);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {conversationId && <ProjectFilesPanel conversationId={conversationId} />}
      {conversationId && messages.length > 0 && (
        <div className="hidden md:flex items-center justify-end px-4 md:px-6 h-11 border-b border-ink-800 shrink-0">
          <ExportMenu conversationId={conversationId} />
        </div>
      )}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 md:py-10">
          {messages.length === 0 ? (
            <EmptyState hasConfigured={hasConfigured} onPick={send} />
          ) : (
            <div className="space-y-6">
              {conversationId && (
                <div className="flex md:hidden justify-end -mt-2 mb-2">
                  <ExportMenu conversationId={conversationId} />
                </div>
              )}
              {messages.map((m, i) => (
                <MessageBubble
                  key={m.id || i}
                  message={m}
                  onEdit={m.role === "user" && !sending ? (newContent) => editMessage(i, newContent) : null}
                  onRegenerate={m.role === "assistant" && !m.pending && !sending ? () => regenerate(i) : null}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-ink-800 bg-ink-950/95 backdrop-blur shrink-0">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-3 md:py-4">
          <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
            <ModelPicker providers={providers} fusion={fusion} mode={mode} setMode={setMode} chain={chain} setChain={setChain} />
            <button
              onClick={() => setWebSearch(!webSearch)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition
                ${webSearch ? "bg-signal-blue/10 border-signal-blue/30 text-signal-blue" : "bg-ink-800 border-ink-700 text-ink-400 hover:text-ink-200"}`}
            >
              <Search size={12} /> Web search
            </button>
          </div>

          <div className="flex items-end gap-2 bg-ink-900 border border-ink-700 rounded-2xl px-3 py-2 focus-within:border-frost-500/50 transition">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={hasConfigured ? "Ask FrostByte anything about your code…" : "Add an API key in Settings to start chatting…"}
              rows={1}
              className="flex-1 bg-transparent resize-none outline-none text-sm py-2 max-h-40 placeholder:text-ink-500"
              style={{ minHeight: "2.25rem" }}
            />
            <button
              onClick={() => send()}
              disabled={sending || !input.trim()}
              className="shrink-0 w-9 h-9 rounded-xl bg-frost-500 hover:bg-frost-400 disabled:bg-ink-700 disabled:text-ink-500 text-ink-950 flex items-center justify-center transition active:scale-95"
              aria-label="Send"
            >
              {sending ? <Loader2 size={16} className="animate-spin" /> : <ArrowUp size={16} />}
            </button>
          </div>
          <p className="text-[11px] text-ink-600 mt-2 text-center">FrostByte can make mistakes. Check important code before running it.</p>
        </div>
      </div>
    </div>
  );
}

function ExportMenu({ conversationId }) {
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const download = async (format) => {
    setOpen(false);
    setDownloading(true);
    try {
      await api.exportConversation(conversationId, format);
    } catch (err) {
      console.error("Export failed:", err.message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={downloading}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-ink-400 hover:text-ink-200 hover:bg-ink-800 transition disabled:opacity-50"
      >
        {downloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
        Export
        <ChevronDown size={12} className={`transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full mt-1 right-0 w-40 bg-ink-900 border border-ink-700 rounded-lg shadow-xl shadow-black/40 z-50 py-1 animate-slideUp">
            <button onClick={() => download("markdown")} className="w-full text-left px-3 py-2 text-xs text-ink-300 hover:bg-ink-800 transition">
              Markdown (.md)
            </button>
            <button onClick={() => download("json")} className="w-full text-left px-3 py-2 text-xs text-ink-300 hover:bg-ink-800 transition">
              JSON (.json)
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function EmptyState({ hasConfigured, onPick }) {
  return (
    <div className="flex flex-col items-center text-center pt-10 md:pt-20 animate-slideUp">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-frost-400 to-frost-600 flex items-center justify-center shadow-xl shadow-frost-600/20 mb-5">
        <Snowflake size={26} className="text-ink-950" strokeWidth={2.5} />
      </div>
      <h1 className="font-display text-2xl md:text-3xl text-ink-100 tracking-wide mb-2">FROSTBYTE</h1>
      <p className="text-ink-400 text-sm max-w-md mb-8">
        {hasConfigured
          ? "150+ tools, every model you've connected, one smart router. Ask away."
          : "Add at least one provider's API key in Settings to start chatting."}
      </p>
      {hasConfigured && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
          {STARTER_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => onPick(p)}
              className="text-left px-4 py-3 rounded-xl bg-ink-900 border border-ink-800 hover:border-ink-700 hover:bg-ink-850 text-sm text-ink-300 transition"
            >
              {p}
            </button>
          ))}
        </div>
      )}
      {hasConfigured && (
        <p className="text-[11px] text-ink-600 mt-8 flex items-center gap-3">
          <span>
            <Kbd>{modKey()}K</Kbd> new chat
          </span>
          <span>
            <Kbd>{modKey()}/</Kbd> search
          </span>
        </p>
      )}
    </div>
  );
}

/** Mac shows ⌘, everything else shows Ctrl — matches what the actual key does on that platform. */
function modKey() {
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || "");
  return isMac ? "⌘" : "Ctrl+";
}

function Kbd({ children }) {
  return <kbd className="px-1.5 py-0.5 rounded border border-ink-700 bg-ink-900 font-mono text-[10px] text-ink-400 mr-1">{children}</kbd>;
}

function MessageBubble({ message, onEdit, onRegenerate }) {
  const isUser = message.role === "user";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (editing) {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(draft.length, draft.length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const startEditing = () => {
    setDraft(message.content);
    setEditing(true);
  };

  const confirmEdit = () => {
    if (!draft.trim() || draft === message.content) {
      setEditing(false);
      return;
    }
    setEditing(false);
    onEdit?.(draft);
  };

  return (
    <div className={`group flex ${isUser ? "justify-end" : "justify-start"} animate-slideUp`}>
      <div className={`max-w-[88%] md:max-w-[80%] ${isUser ? "" : "w-full"}`}>
        {!isUser && message.attempts?.length > 0 && (
          <RoutingTrace attempts={message.attempts} fused={message.fused} mode={message.fused ? "fusion" : undefined} />
        )}

        {editing ? (
          <div className="rounded-2xl border border-frost-500/40 bg-ink-900 p-2">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  confirmEdit();
                }
                if (e.key === "Escape") setEditing(false);
              }}
              rows={Math.min(10, draft.split("\n").length + 1)}
              className="w-full bg-transparent outline-none text-sm resize-none px-2 py-1"
            />
            <div className="flex justify-end gap-2 px-1 pt-1">
              <button onClick={() => setEditing(false)} className="text-xs text-ink-400 hover:text-ink-200 px-2 py-1 transition">
                Cancel
              </button>
              <button
                onClick={confirmEdit}
                className="text-xs bg-frost-500 hover:bg-frost-400 text-ink-950 font-medium px-3 py-1 rounded-lg transition"
              >
                Save &amp; resend
              </button>
            </div>
          </div>
        ) : (
          <div
            className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              isUser ? "bg-frost-500/15 border border-frost-500/25 text-ink-100" : "bg-ink-900 border border-ink-800 text-ink-200"
            }`}
          >
            {message.pending && !message.content ? (
              <div className="flex items-center gap-2 text-ink-400">
                <Loader2 size={14} className="animate-spin" /> Routing to the best model…
              </div>
            ) : isUser ? (
              <p className="whitespace-pre-wrap">{message.content}</p>
            ) : (
              <MarkdownLite text={message.content} />
            )}
          </div>
        )}

        <div className="flex items-center gap-3 mt-1 px-1">
          {!isUser && message.modelUsed && !message.pending && (
            <p className="text-[11px] text-ink-600">
              Answered by <span className="text-ink-500 font-mono">{message.providerUsed}/{message.modelUsed}</span>
            </p>
          )}
          {!editing && (onEdit || onRegenerate) && (
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition">
              {isUser && onEdit && (
                <button onClick={startEditing} className="flex items-center gap-1 text-[11px] text-ink-500 hover:text-frost-400 transition">
                  <Pencil size={11} /> Edit
                </button>
              )}
              {!isUser && onRegenerate && (
                <button onClick={onRegenerate} className="flex items-center gap-1 text-[11px] text-ink-500 hover:text-frost-400 transition">
                  <RefreshCw size={11} /> Regenerate
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
