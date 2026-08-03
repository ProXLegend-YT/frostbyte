import React, { useState } from "react";
import { ChevronDown, Layers, GitBranch, Sparkles, Plus, X, GripVertical } from "lucide-react";

const MODE_META = {
  single: { icon: <Layers size={13} />, label: "Single model" },
  fallback: { icon: <GitBranch size={13} />, label: "Smart fallback" },
  fusion: { icon: <Sparkles size={13} />, label: "Fusion" }
};

export default function ModelPicker({ providers, fusion, mode, setMode, chain, setChain }) {
  const [open, setOpen] = useState(false);
  const configured = providers.filter((p) => p.hasKey);
  const allModelOptions = configured.flatMap((p) => p.models.map((m) => ({ providerId: p.id, providerName: p.name, modelId: m.id, modelLabel: m.label })));

  const addStep = (opt) => setChain([...chain, { providerId: opt.providerId, modelId: opt.modelId }]);
  const removeStep = (idx) => setChain(chain.filter((_, i) => i !== idx));

  const label = (step) => {
    const p = providers.find((pr) => pr.id === step.providerId);
    const m = p?.models.find((mo) => mo.id === step.modelId);
    return `${p?.name || step.providerId} · ${m?.label || step.modelId}`;
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-ink-800 border border-ink-700 text-xs font-medium text-ink-200 hover:border-ink-600 transition"
      >
        {MODE_META[mode].icon}
        {MODE_META[mode].label}
        {mode !== "fusion" && chain.length > 0 && (
          <span className="text-ink-500 hidden sm:inline">
            ({chain.length} model{chain.length > 1 ? "s" : ""})
          </span>
        )}
        <ChevronDown size={13} className={`transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full mb-2 left-0 w-80 max-w-[90vw] bg-ink-900 border border-ink-700 rounded-xl shadow-2xl shadow-black/50 z-50 p-3 animate-slideUp">
            <div className="flex gap-1 mb-3 bg-ink-950 rounded-lg p-1">
              {Object.entries(MODE_META).map(([key, meta]) => (
                <button
                  key={key}
                  onClick={() => setMode(key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition
                    ${mode === key ? "bg-frost-500/15 text-frost-400" : "text-ink-400 hover:text-ink-200"}`}
                >
                  {meta.icon} {meta.label}
                </button>
              ))}
            </div>

            {mode === "fusion" ? (
              <div className="text-xs text-ink-400 space-y-2">
                <p>Fusion calls these models in parallel and merges the results:</p>
                <div className="flex flex-wrap gap-1.5">
                  {(fusion?.defaultMembers || []).map((m) => (
                    <span key={m} className="px-2 py-1 rounded-md bg-ink-800 border border-ink-700 font-mono text-[11px]">
                      {m}
                    </span>
                  ))}
                </div>
                <p className="text-ink-500">Only members with a saved API key will actually run.</p>
              </div>
            ) : (
              <>
                <p className="text-[11px] text-ink-500 mb-2">
                  {mode === "single" ? "Pick the one model to use:" : "Build the fallback order — if step 1 fails, step 2 runs, and so on."}
                </p>
                <div className="space-y-1 mb-2 max-h-40 overflow-y-auto">
                  {chain.map((step, i) => (
                    <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-ink-800 text-xs">
                      <GripVertical size={12} className="text-ink-600 shrink-0" />
                      <span className="text-ink-500 font-mono shrink-0">{i + 1}.</span>
                      <span className="truncate flex-1">{label(step)}</span>
                      <button onClick={() => removeStep(i)} className="text-ink-500 hover:text-signal-red shrink-0">
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  {chain.length === 0 && <p className="text-ink-600 text-xs italic px-2 py-3 text-center">No models yet — add one below.</p>}
                </div>

                {(mode === "fallback" || chain.length === 0) && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-frost-400 flex items-center gap-1 select-none">
                      <Plus size={12} /> Add model
                    </summary>
                    <div className="mt-1 max-h-40 overflow-y-auto space-y-0.5">
                      {allModelOptions.length === 0 && <p className="text-ink-600 px-2 py-2">No providers configured yet — add API keys in Settings.</p>}
                      {allModelOptions.map((opt) => (
                        <button
                          key={`${opt.providerId}:${opt.modelId}`}
                          onClick={() => addStep(opt)}
                          className="w-full text-left px-2 py-1.5 rounded-md hover:bg-ink-800 text-ink-300 truncate"
                        >
                          {opt.providerName} · {opt.modelLabel}
                        </button>
                      ))}
                    </div>
                  </details>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
