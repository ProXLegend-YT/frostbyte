import React, { useState } from "react";
import { Check, KeyRound, ExternalLink, Trash2, Plus, ShieldAlert, X, Info, UserPlus, Pencil, Sparkles } from "lucide-react";
import { api } from "../lib/api.js";
import SessionsPanel from "./SessionsPanel.jsx";
import CustomProviderForm from "./CustomProviderForm.jsx";

export default function SettingsView({ providers, toolProviders, onChange, user }) {
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [editingCustomId, setEditingCustomId] = useState(null);

  const customProviders = providers.filter((p) => p.isCustom);
  const builtinProviders = providers.filter((p) => !p.isCustom);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-8">
        <h1 className="font-display text-2xl text-ink-100 tracking-wide mb-1">MODELS &amp; API KEYS</h1>
        <p className="text-ink-400 text-sm mb-8">
          Keys are encrypted and stored only on your own server, scoped to your account — never sent anywhere except the provider you're calling.
        </p>

        <Section title="AI model providers" subtitle="Add a key to unlock that provider's models everywhere in the app.">
          <div className="space-y-2">
            {builtinProviders.map((p) => (
              <ProviderRow key={p.id} provider={p} onChange={onChange} />
            ))}
          </div>
        </Section>

        <Section title="Tool providers" subtitle="Power web search and GitHub integration.">
          <div className="space-y-2">
            {toolProviders.map((t) => (
              <ToolProviderRow key={t.id} tool={t} onChange={onChange} />
            ))}
          </div>
        </Section>

        <Section
          title="Custom providers"
          subtitle="Add literally any AI API — any base URL, any auth style, any request/response shape. Not just OpenAI-compatible ones."
        >
          {customProviders.length > 0 && (
            <div className="space-y-2 mb-3">
              {customProviders.map((p) =>
                editingCustomId === p.id ? (
                  <CustomProviderForm
                    key={p.id}
                    existing={p}
                    onClose={() => setEditingCustomId(null)}
                    onSaved={async () => {
                      setEditingCustomId(null);
                      await onChange();
                    }}
                  />
                ) : (
                  <div key={p.id} className="rounded-xl border border-ink-800 bg-ink-900 p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${p.hasKey ? "bg-signal-green/10 text-signal-green" : "bg-ink-800 text-ink-500"}`}>
                        <Sparkles size={14} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink-100 truncate">{p.name}</p>
                        <p className="text-[11px] text-ink-500">
                          {p.style} · {p.models?.length || 0} model{p.models?.length !== 1 ? "s" : ""}
                          {p.hasKey && " · connected"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => setEditingCustomId(p.id)} className="text-ink-500 hover:text-frost-400 p-1.5 rounded-md hover:bg-ink-800 transition" title="Edit">
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={async () => {
                          await api.removeCustomProvider(p.id);
                          await onChange();
                        }}
                        className="text-ink-500 hover:text-signal-red p-1.5 rounded-md hover:bg-ink-800 transition"
                        title="Remove"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
          )}

          {!showAddCustom ? (
            <button
              onClick={() => setShowAddCustom(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-ink-700 text-ink-400 hover:text-frost-400 hover:border-frost-500/40 text-sm transition w-full justify-center"
            >
              <Plus size={14} /> Add custom provider / model
            </button>
          ) : (
            <CustomProviderForm
              onClose={() => setShowAddCustom(false)}
              onSaved={async () => {
                setShowAddCustom(false);
                await onChange();
              }}
            />
          )}
        </Section>

        <Section title="Where you're logged in" subtitle="Devices currently signed in to your account.">
          <SessionsPanel />
        </Section>

        {user?.role === "admin" && (
          <Section title="Team" subtitle="Invite others to this FrostByte instance. Each person gets their own API keys and chat history.">
            <AddUserForm />
          </Section>
        )}
      </div>
    </div>
  );
}

function AddUserForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const submit = async () => {
    setMessage(null);
    if (!username || password.length < 8) {
      setMessage({ type: "error", text: "Username and an 8+ character password are required." });
      return;
    }
    setSaving(true);
    try {
      await api.createUser(username, password, role);
      setMessage({ type: "success", text: `Account "${username}" created. Share the password with them directly.` });
      setUsername("");
      setPassword("");
      setRole("user");
    } catch (e) {
      setMessage({ type: "error", text: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-ink-800 bg-ink-900 p-4 space-y-3">
      {message && (
        <div
          className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${
            message.type === "error" ? "text-signal-red bg-signal-red/10 border border-signal-red/25" : "text-signal-green bg-signal-green/10 border border-signal-green/25"
          }`}
        >
          {message.type === "error" ? <ShieldAlert size={13} className="shrink-0" /> : <Check size={13} className="shrink-0" />}
          {message.text}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Field label="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
        <Field label="Temporary password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <label className="flex items-center gap-2 text-xs text-ink-400">
        <input type="checkbox" checked={role === "admin"} onChange={(e) => setRole(e.target.checked ? "admin" : "user")} className="accent-frost-500" />
        Grant admin (can invite others and manage the shared skill library)
      </label>
      <button
        onClick={submit}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-frost-500 hover:bg-frost-400 disabled:opacity-60 text-ink-950 text-sm font-medium transition"
      >
        <UserPlus size={14} /> {saving ? "Creating…" : "Create account"}
      </button>
    </div>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <div className="mb-8">
      <h2 className="text-sm font-semibold text-ink-200 mb-0.5">{title}</h2>
      <p className="text-xs text-ink-500 mb-3">{subtitle}</p>
      {children}
    </div>
  );
}

function ProviderRow({ provider, onChange }) {
  const [editing, setEditing] = useState(false);
  const [key, setKey] = useState("");
  const [accountId, setAccountId] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!key.trim()) return;
    setSaving(true);
    try {
      await api.saveKey(provider.id, key.trim(), provider.needsAccountId ? accountId.trim() : undefined);
      setKey("");
      setAccountId("");
      setEditing(false);
      await onChange();
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    await api.deleteKey(provider.id);
    await onChange();
  };

  return (
    <div className="rounded-xl border border-ink-800 bg-ink-900 p-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              provider.hasKey ? "bg-signal-green/10 text-signal-green" : "bg-ink-800 text-ink-500"
            }`}
          >
            <KeyRound size={14} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium text-ink-100 truncate">{provider.name}</p>
              {provider.optional && <Badge>optional</Badge>}
              {provider.unreliable && <Badge tone="amber">may be unreliable</Badge>}
              {provider.unverified && <Badge tone="amber">unverified endpoint</Badge>}
            </div>
            <p className="text-[11px] text-ink-500">{provider.models?.length || 0} models available</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {provider.hasKey && !editing && (
            <span className="flex items-center gap-1 text-xs text-signal-green">
              <Check size={13} /> Connected
            </span>
          )}
          <a href={provider.docsUrl} target="_blank" rel="noreferrer" className="text-ink-500 hover:text-ink-300 p-1">
            <ExternalLink size={13} />
          </a>
          {provider.hasKey && !editing && (
            <button onClick={remove} className="text-ink-500 hover:text-signal-red p-1">
              <Trash2 size={13} />
            </button>
          )}
          <button
            onClick={() => setEditing(!editing)}
            className="text-xs px-2.5 py-1 rounded-md bg-ink-800 hover:bg-ink-700 text-ink-200 transition"
          >
            {provider.hasKey ? "Update" : "Add key"}
          </button>
        </div>
      </div>

      {editing && (
        <div className="mt-3 pt-3 border-t border-ink-800 space-y-2">
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={`${provider.name} API key`}
            className="w-full bg-ink-950 border border-ink-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-frost-500/50 font-mono"
          />
          {provider.needsAccountId && (
            <input
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              placeholder="Account ID"
              className="w-full bg-ink-950 border border-ink-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-frost-500/50 font-mono"
            />
          )}
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving || !key.trim()}
              className="px-3 py-1.5 rounded-lg bg-frost-500 hover:bg-frost-400 disabled:bg-ink-700 disabled:text-ink-500 text-ink-950 text-xs font-medium transition"
            >
              {saving ? "Saving…" : "Save key"}
            </button>
            <button onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-lg text-ink-400 hover:text-ink-200 text-xs transition">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ToolProviderRow({ tool, onChange }) {
  const [editing, setEditing] = useState(false);
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!key.trim()) return;
    setSaving(true);
    try {
      await api.saveKey(tool.id, key.trim());
      setKey("");
      setEditing(false);
      await onChange();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-ink-800 bg-ink-900 p-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-medium text-ink-100">{tool.name}</p>
          <p className="text-[11px] text-ink-500 capitalize">{tool.kind.replace("_", " ")}</p>
        </div>
        <div className="flex items-center gap-2">
          <a href={tool.docsUrl} target="_blank" rel="noreferrer" className="text-ink-500 hover:text-ink-300 p-1">
            <ExternalLink size={13} />
          </a>
          <button onClick={() => setEditing(!editing)} className="text-xs px-2.5 py-1 rounded-md bg-ink-800 hover:bg-ink-700 text-ink-200 transition">
            Add / update key
          </button>
        </div>
      </div>
      {editing && (
        <div className="mt-3 pt-3 border-t border-ink-800 flex gap-2">
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={`${tool.name} API key`}
            className="flex-1 bg-ink-950 border border-ink-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-frost-500/50 font-mono"
          />
          <button
            onClick={save}
            disabled={saving || !key.trim()}
            className="px-3 py-1.5 rounded-lg bg-frost-500 hover:bg-frost-400 disabled:bg-ink-700 disabled:text-ink-500 text-ink-950 text-xs font-medium transition"
          >
            Save
          </button>
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
        className={`w-full bg-ink-950 border border-ink-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-frost-500/50 ${mono ? "font-mono" : ""}`}
      />
    </label>
  );
}

function Badge({ children, tone = "ink" }) {
  const tones = {
    ink: "bg-ink-800 text-ink-400 border-ink-700",
    amber: "bg-signal-amber/10 text-signal-amber border-signal-amber/25"
  };
  return <span className={`text-[10px] px-1.5 py-0.5 rounded border ${tones[tone]}`}>{children}</span>;
}
