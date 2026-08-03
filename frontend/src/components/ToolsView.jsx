import React, { useEffect, useState } from "react";
import { Search, Plus, Wrench, X, Check, Lock } from "lucide-react";
import { TOOL_CATEGORIES, TOTAL_TOOL_COUNT } from "../lib/toolLibrary.js";
import { api } from "../lib/api.js";

export default function ToolsView({ isAdmin }) {
  const [query, setQuery] = useState("");
  // Set of DISABLED builtin tool ids (builtin:<name>) — inverse tracking means
  // a fresh install with no registry rows yet still shows everything as "on".
  const [disabledIds, setDisabledIds] = useState(() => new Set());
  const [customTools, setCustomTools] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadRegistry = async () => {
    const data = await api.getToolRegistry();
    setCustomTools(data.tools.filter((t) => !t.isBuiltin));
    setDisabledIds(new Set(data.tools.filter((t) => t.isBuiltin && !t.enabled).map((t) => t.id)));
    setLoaded(true);
  };

  useEffect(() => {
    loadRegistry();
  }, []);

  const toggleBuiltin = async (toolName) => {
    if (!isAdmin) return;
    const id = `builtin:${toolName}`;
    const wasDisabled = disabledIds.has(id);
    // optimistic UI update
    setDisabledIds((prev) => {
      const s = new Set(prev);
      wasDisabled ? s.delete(id) : s.add(id);
      return s;
    });
    try {
      await api.toggleTool(id, wasDisabled); // wasDisabled -> we're re-enabling it
    } catch {
      // revert on failure
      setDisabledIds((prev) => {
        const s = new Set(prev);
        wasDisabled ? s.add(id) : s.delete(id);
        return s;
      });
    }
  };

  const filtered = TOOL_CATEGORIES.map((cat) => ({
    ...cat,
    tools: cat.tools.filter((t) => t.toLowerCase().includes(query.toLowerCase()))
  })).filter((cat) => cat.tools.length > 0 || query === "");

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-8">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
          <h1 className="font-display text-2xl text-ink-100 tracking-wide">TOOLS &amp; SKILLS</h1>
          <span className="text-xs px-2.5 py-1 rounded-full bg-frost-500/10 text-frost-400 border border-frost-500/25 font-medium">
            {TOTAL_TOOL_COUNT + customTools.length}+ available
          </span>
        </div>
        <p className="text-ink-400 text-sm mb-6">
          {isAdmin
            ? "Every skill here shapes how the agent approaches your request. Toggle any off, or add your own — changes apply for everyone on this instance."
            : "Every enabled skill here shapes how the agent approaches your request. Only an admin can toggle these for the whole team."}
        </p>

        <div className="flex gap-2 mb-6">
          <div className="flex-1 flex items-center gap-2 bg-ink-900 border border-ink-700 rounded-lg px-3 py-2">
            <Search size={14} className="text-ink-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tools…"
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-ink-500"
            />
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-frost-500/10 border border-frost-500/25 text-frost-400 text-sm font-medium hover:bg-frost-500/15 transition shrink-0"
            >
              <Plus size={14} /> <span className="hidden sm:inline">Add tool</span>
            </button>
          )}
        </div>

        {customTools.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-ink-200 mb-2">Custom tools</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {customTools.map((t) => (
                <ToolChip
                  key={t.id}
                  label={t.name}
                  on={t.enabled}
                  locked={!isAdmin}
                  onToggle={async () => {
                    if (!isAdmin) return;
                    await api.toggleTool(t.id, !t.enabled);
                    setCustomTools((prev) => prev.map((ct) => (ct.id === t.id ? { ...ct, enabled: !ct.enabled } : ct)));
                  }}
                />
              ))}
            </div>
          </div>
        )}

        <div className="space-y-7">
          {loaded &&
            filtered.map((cat) => (
              <div key={cat.name}>
                <h2 className="text-sm font-semibold text-ink-200 mb-2 flex items-center gap-2">
                  <Wrench size={13} className="text-frost-400" /> {cat.name}
                  <span className="text-ink-600 font-normal">({cat.tools.length})</span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {cat.tools.map((tool) => (
                    <ToolChip key={tool} label={tool} on={!disabledIds.has(`builtin:${tool}`)} locked={!isAdmin} onToggle={() => toggleBuiltin(tool)} />
                  ))}
                </div>
              </div>
            ))}
        </div>
      </div>

      {showAdd && isAdmin && (
        <AddToolModal
          onClose={() => setShowAdd(false)}
          onSaved={async () => {
            await loadRegistry();
            setShowAdd(false);
          }}
        />
      )}
    </div>
  );
}

function ToolChip({ label, on, onToggle, locked }) {
  return (
    <button
      onClick={onToggle}
      disabled={locked}
      className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-xs text-left transition
        ${on ? "bg-ink-900 border-ink-800 text-ink-300" : "bg-ink-900/40 border-ink-800/60 text-ink-600 line-through"}
        ${locked ? "cursor-default" : "cursor-pointer"}`}
    >
      <span className="truncate">{label}</span>
      {locked ? (
        <Lock size={10} className="text-ink-700 shrink-0" />
      ) : (
        <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 ${on ? "bg-signal-green/20 text-signal-green" : "bg-ink-800 text-ink-600"}`}>
          {on && <Check size={9} />}
        </span>
      )}
    </button>
  );
}

function AddToolModal({ onClose, onSaved }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("custom");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api.addTool({ name, description, category, kind: "prompt_tool" });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-ink-900 border border-ink-700 rounded-2xl p-5 animate-slideUp">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-ink-100">Add a custom tool / skill</h3>
          <button onClick={onClose} className="text-ink-500 hover:text-ink-200">
            <X size={16} />
          </button>
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="text-[11px] text-ink-500 mb-1 block">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. AWS Lambda specialist"
              className="w-full bg-ink-950 border border-ink-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-frost-500/50" />
          </label>
          <label className="block">
            <span className="text-[11px] text-ink-500 mb-1 block">What it does</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Describe the skill's behavior/instructions…"
              className="w-full bg-ink-950 border border-ink-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-frost-500/50 resize-none" />
          </label>
          <label className="block">
            <span className="text-[11px] text-ink-500 mb-1 block">Category</span>
            <input value={category} onChange={(e) => setCategory(e.target.value)} className="w-full bg-ink-950 border border-ink-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-frost-500/50" />
          </label>
        </div>
        <button onClick={submit} disabled={saving || !name.trim()} className="w-full mt-4 py-2 rounded-lg bg-frost-500 hover:bg-frost-400 disabled:opacity-50 text-ink-950 text-sm font-medium transition">
          {saving ? "Adding…" : "Add tool"}
        </button>
      </div>
    </div>
  );
}
