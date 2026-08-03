import React, { useState } from "react";
import { X, Plus, Trash2, ShieldAlert, Info, PlayCircle, CheckCircle2, Loader2 } from "lucide-react";
import { api } from "../lib/api.js";

const STYLE_OPTIONS = [
  { value: "openai", label: "OpenAI-compatible", hint: "Most providers — /chat/completions with choices[0].message.content" },
  { value: "anthropic", label: "Anthropic Messages API", hint: "system prompt separated, response under content[].text" },
  { value: "custom", label: "Fully custom", hint: "Any JSON API — you define the request shape and where the answer lives in the response" }
];

const DEFAULT_CUSTOM_TEMPLATE = `{
  "model": "{{model}}",
  "input": "{{messages}}",
  "temperature": "{{temperature}}",
  "max_output_tokens": "{{max_tokens}}"
}`;

function emptyModel() {
  return { id: "", label: "" };
}

/**
 * Handles both creating a brand-new custom provider and editing an existing
 * one (pass `existing` to edit). Supports the three request/response styles
 * FrostByte's backend understands, an arbitrary number of models, arbitrary
 * extra static headers, and — for the "custom" style — a raw JSON request
 * template plus JSON-path fields for pulling the answer text and token
 * counts out of whatever shape the response comes back in.
 */
export default function CustomProviderForm({ existing, onClose, onSaved }) {
  const isEditing = !!existing;

  const [form, setForm] = useState(() => ({
    id: existing?.id?.split(":").slice(1).join(":") || "",
    name: existing?.name || "",
    baseUrl: existing?.baseUrl || "",
    chatPath: existing?.chatPath || "/chat/completions",
    authHeader: existing?.authHeader || "Authorization",
    authPrefix: existing?.authPrefix ?? "Bearer ",
    style: existing?.style || "openai",
    apiKey: "",
    requestTemplateText: existing?.requestTemplate ? JSON.stringify(existing.requestTemplate, null, 2) : DEFAULT_CUSTOM_TEMPLATE,
    responseTextPath: existing?.responseTextPath || "",
    responseInputTokensPath: existing?.responseInputTokensPath || "",
    responseOutputTokensPath: existing?.responseOutputTokensPath || ""
  }));
  const [models, setModels] = useState(() => (existing?.models?.length ? existing.models.map((m) => ({ id: m.id, label: m.label })) : [emptyModel()]));
  const [extraHeaders, setExtraHeaders] = useState(() => {
    const eh = existing?.extraHeaders || {};
    const rows = Object.entries(eh).map(([key, value]) => ({ key, value }));
    return rows.length ? rows : [{ key: "", value: "" }];
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [testState, setTestState] = useState(null); // null | "testing" | { ok, sample/error }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const updateModel = (idx, field, value) => {
    setModels((prev) => prev.map((m, i) => (i === idx ? { ...m, [field]: value } : m)));
  };
  const addModelRow = () => setModels((prev) => [...prev, emptyModel()]);
  const removeModelRow = (idx) => setModels((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));

  const updateHeaderRow = (idx, field, value) => {
    setExtraHeaders((prev) => prev.map((h, i) => (i === idx ? { ...h, [field]: value } : h)));
  };
  const addHeaderRow = () => setExtraHeaders((prev) => [...prev, { key: "", value: "" }]);
  const removeHeaderRow = (idx) => setExtraHeaders((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));

  const buildPayload = () => {
    const cleanModels = models.filter((m) => m.id.trim()).map((m) => ({ id: m.id.trim(), label: m.label.trim() || m.id.trim(), tags: [] }));
    const cleanHeaders = Object.fromEntries(extraHeaders.filter((h) => h.key.trim()).map((h) => [h.key.trim(), h.value]));

    let requestTemplate = null;
    if (form.style === "custom" && form.requestTemplateText.trim()) {
      requestTemplate = JSON.parse(form.requestTemplateText); // caller wraps in try/catch
    }

    return {
      id: form.id.trim().toLowerCase().replace(/\s+/g, "-"),
      name: form.name.trim(),
      baseUrl: form.baseUrl.trim(),
      chatPath: form.chatPath.trim(),
      authHeader: form.authHeader.trim(),
      authPrefix: form.authPrefix,
      style: form.style,
      models: cleanModels,
      extraHeaders: cleanHeaders,
      requestTemplate,
      responseTextPath: form.style === "custom" ? form.responseTextPath.trim() : undefined,
      responseInputTokensPath: form.style === "custom" ? form.responseInputTokensPath.trim() || undefined : undefined,
      responseOutputTokensPath: form.style === "custom" ? form.responseOutputTokensPath.trim() || undefined : undefined
    };
  };

  const submit = async () => {
    setError("");
    if (!form.id || !form.name || !form.baseUrl) {
      setError("Provider ID, name, and base URL are required.");
      return;
    }
    if (!models.some((m) => m.id.trim())) {
      setError("Add at least one model.");
      return;
    }
    if (form.style === "custom" && !form.responseTextPath.trim()) {
      setError('For a fully custom API, tell FrostByte where the answer text lives in the response (e.g. "choices[0].message.content").');
      return;
    }

    let payload;
    try {
      payload = buildPayload();
    } catch {
      setError("Request template isn't valid JSON — check for a missing comma or bracket.");
      return;
    }

    setSaving(true);
    try {
      if (isEditing) {
        await api.updateCustomProvider(existing.id, payload);
      } else {
        await api.addCustomProvider(payload);
        if (form.apiKey) await api.saveKey(payload.id, form.apiKey);
      }
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTestState("testing");
    setError("");
    try {
      let payload;
      try {
        payload = buildPayload();
      } catch {
        setTestState({ ok: false, error: "Request template isn't valid JSON." });
        return;
      }
      // For a brand-new (unsaved) provider, save it first so there's
      // something on the server to actually test against, then run the test.
      if (!isEditing) {
        await api.addCustomProvider(payload);
        if (form.apiKey) await api.saveKey(payload.id, form.apiKey);
      } else {
        await api.updateCustomProvider(existing.id, payload);
      }
      const providerId = isEditing ? existing.id : payload.id;
      const result = await api.testProviderConnection(providerId, models[0]?.id);
      setTestState(result);
    } catch (e) {
      setTestState({ ok: false, error: e.message });
    }
  };

  return (
    <div className="rounded-xl border border-ink-700 bg-ink-900 p-4 space-y-4 animate-slideUp">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink-100">{isEditing ? "Edit custom provider" : "New custom provider"}</p>
        <button onClick={onClose} className="text-ink-500 hover:text-ink-200">
          <X size={16} />
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-signal-red bg-signal-red/10 border border-signal-red/25 rounded-lg px-3 py-2">
          <ShieldAlert size={13} className="shrink-0" /> {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Field label="Provider ID" placeholder="my-provider" value={form.id} onChange={set("id")} disabled={isEditing} mono />
        <Field label="Display name" placeholder="My Provider" value={form.name} onChange={set("name")} />
      </div>
      <Field label="Base URL" placeholder="https://api.example.com/v1" value={form.baseUrl} onChange={set("baseUrl")} mono />

      <div>
        <span className="text-[11px] text-ink-500 mb-1.5 block">API style</span>
        <div className="space-y-1.5">
          {STYLE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition ${
                form.style === opt.value ? "border-frost-500/50 bg-frost-500/5" : "border-ink-700 hover:border-ink-600"
              }`}
            >
              <input type="radio" name="style" checked={form.style === opt.value} onChange={() => setForm({ ...form, style: opt.value })} className="mt-0.5 accent-frost-500" />
              <div>
                <p className="text-xs font-medium text-ink-200">{opt.label}</p>
                <p className="text-[11px] text-ink-500">{opt.hint}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Chat endpoint path" placeholder="/chat/completions" value={form.chatPath} onChange={set("chatPath")} mono />
        <Field label="Auth header name" placeholder="Authorization" value={form.authHeader} onChange={set("authHeader")} mono />
      </div>
      <Field
        label="Auth prefix (goes before the key in the header)"
        placeholder="Bearer  (with trailing space)"
        value={form.authPrefix}
        onChange={set("authPrefix")}
        mono
      />

      <div>
        <span className="text-[11px] text-ink-500 mb-1.5 block">Extra headers (optional — e.g. an org ID or API version header)</span>
        <div className="space-y-1.5">
          {extraHeaders.map((h, i) => (
            <div key={i} className="flex gap-1.5">
              <input
                value={h.key}
                onChange={(e) => updateHeaderRow(i, "key", e.target.value)}
                placeholder="Header-Name"
                className="w-1/2 bg-ink-950 border border-ink-700 rounded-lg px-2.5 py-1.5 text-xs font-mono outline-none focus:border-frost-500/50"
              />
              <input
                value={h.value}
                onChange={(e) => updateHeaderRow(i, "value", e.target.value)}
                placeholder="value"
                className="flex-1 bg-ink-950 border border-ink-700 rounded-lg px-2.5 py-1.5 text-xs font-mono outline-none focus:border-frost-500/50"
              />
              <button onClick={() => removeHeaderRow(i)} className="text-ink-600 hover:text-signal-red px-1">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          <button onClick={addHeaderRow} className="text-[11px] text-frost-400 hover:text-frost-300 flex items-center gap-1">
            <Plus size={11} /> Add header
          </button>
        </div>
      </div>

      <div>
        <span className="text-[11px] text-ink-500 mb-1.5 block">Models</span>
        <div className="space-y-1.5">
          {models.map((m, i) => (
            <div key={i} className="flex gap-1.5">
              <input
                value={m.id}
                onChange={(e) => updateModel(i, "id", e.target.value)}
                placeholder="model-id-as-the-api-expects-it"
                className="flex-1 bg-ink-950 border border-ink-700 rounded-lg px-2.5 py-1.5 text-xs font-mono outline-none focus:border-frost-500/50"
              />
              <input
                value={m.label}
                onChange={(e) => updateModel(i, "label", e.target.value)}
                placeholder="Friendly label"
                className="flex-1 bg-ink-950 border border-ink-700 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-frost-500/50"
              />
              <button onClick={() => removeModelRow(i)} className="text-ink-600 hover:text-signal-red px-1">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          <button onClick={addModelRow} className="text-[11px] text-frost-400 hover:text-frost-300 flex items-center gap-1">
            <Plus size={11} /> Add another model
          </button>
        </div>
      </div>

      {form.style === "custom" && (
        <div className="space-y-3 border-t border-ink-800 pt-3">
          <div>
            <span className="text-[11px] text-ink-500 mb-1 block">
              Request body template (JSON) — use <code className="text-frost-400">{"{{messages}}"}</code>, <code className="text-frost-400">{"{{model}}"}</code>,{" "}
              <code className="text-frost-400">{"{{temperature}}"}</code>, <code className="text-frost-400">{"{{max_tokens}}"}</code> as placeholders
            </span>
            <textarea
              value={form.requestTemplateText}
              onChange={(e) => setForm({ ...form, requestTemplateText: e.target.value })}
              rows={6}
              className="w-full bg-ink-950 border border-ink-700 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-frost-500/50 resize-y"
              spellCheck={false}
            />
          </div>
          <Field
            label="Response text path — where the answer lives in the JSON response"
            placeholder="e.g. choices[0].message.content or output.text"
            value={form.responseTextPath}
            onChange={set("responseTextPath")}
            mono
          />
          <div className="grid grid-cols-2 gap-2">
            <Field label="Input tokens path (optional)" placeholder="e.g. usage.input_tokens" value={form.responseInputTokensPath} onChange={set("responseInputTokensPath")} mono />
            <Field label="Output tokens path (optional)" placeholder="e.g. usage.output_tokens" value={form.responseOutputTokensPath} onChange={set("responseOutputTokensPath")} mono />
          </div>
        </div>
      )}

      {!isEditing && <Field label="API key (optional now — add later in this list)" placeholder="paste key" value={form.apiKey} onChange={set("apiKey")} type="password" mono />}

      <div className="flex items-start gap-2 text-[11px] text-ink-500 bg-ink-950 rounded-lg px-3 py-2">
        <Info size={13} className="mt-0.5 shrink-0" />
        {form.style === "custom"
          ? "FrostByte sends your template as-is (with placeholders filled in) and pulls the answer out using the path you specify — this works with virtually any JSON-based chat/completion API."
          : "This covers the request/response shape automatically — you shouldn't need the custom option unless this provider does something nonstandard."}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={testConnection}
          disabled={testState === "testing" || saving}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-ink-700 text-ink-300 hover:border-ink-600 text-xs font-medium transition disabled:opacity-50"
        >
          {testState === "testing" ? <Loader2 size={13} className="animate-spin" /> : <PlayCircle size={13} />}
          Test connection
        </button>
        <button
          onClick={submit}
          disabled={saving}
          className="flex-1 py-2 rounded-lg bg-frost-500 hover:bg-frost-400 disabled:opacity-60 text-ink-950 text-sm font-medium transition"
        >
          {saving ? "Saving…" : isEditing ? "Save changes" : "Add provider"}
        </button>
      </div>

      {testState && testState !== "testing" && (
        <div
          className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2 ${
            testState.ok ? "text-signal-green bg-signal-green/10 border border-signal-green/25" : "text-signal-red bg-signal-red/10 border border-signal-red/25"
          }`}
        >
          {testState.ok ? <CheckCircle2 size={13} className="mt-0.5 shrink-0" /> : <ShieldAlert size={13} className="mt-0.5 shrink-0" />}
          <div>
            {testState.ok ? (
              <>
                Connected — got a response in {testState.latencyMs}ms. Sample: <span className="font-mono">{testState.sample?.slice(0, 80)}</span>
              </>
            ) : (
              <>Test failed: {testState.error}</>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, mono, ...props }) {
  return (
    <label className="block">
      <span className="text-[11px] text-ink-500 mb-1 block">{label}</span>
      <input
        {...props}
        className={`w-full bg-ink-950 border border-ink-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-frost-500/50 disabled:opacity-50 ${mono ? "font-mono" : ""}`}
      />
    </label>
  );
}
