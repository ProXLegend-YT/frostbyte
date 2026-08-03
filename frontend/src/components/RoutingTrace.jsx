import React from "react";
import { Check, X, Loader2, SkipForward, Sparkles } from "lucide-react";

const STATUS_STYLES = {
  trying: { icon: <Loader2 size={12} className="animate-spin" />, color: "text-signal-blue", bg: "bg-signal-blue/10", border: "border-signal-blue/30" },
  success: { icon: <Check size={12} />, color: "text-signal-green", bg: "bg-signal-green/10", border: "border-signal-green/30" },
  failed: { icon: <X size={12} />, color: "text-signal-red", bg: "bg-signal-red/10", border: "border-signal-red/30" },
  skipped: { icon: <SkipForward size={12} />, color: "text-ink-500", bg: "bg-ink-800", border: "border-ink-700" }
};

/**
 * Shows the live/finished routing chain as a horizontal chain of nodes
 * connected by animated flow-lines — this is FrostByte's signature visual:
 * you can literally watch a request hop from a failed model to the one
 * that rescues it, or watch fusion members light up in parallel.
 */
export default function RoutingTrace({ attempts, fused, mode }) {
  if (!attempts || attempts.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 py-2 px-1 animate-slideUp">
      {mode === "fusion" && (
        <span className="flex items-center gap-1 text-[11px] text-frost-400 mr-1 font-medium">
          <Sparkles size={11} /> fusion
        </span>
      )}
      {attempts.map((a, i) => {
        const style = STATUS_STYLES[a.status || (a.ok ? "success" : a.skipped ? "skipped" : "failed")];
        return (
          <React.Fragment key={i}>
            <div
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] font-mono ${style.bg} ${style.border} ${style.color}`}
              title={a.error || ""}
            >
              {style.icon}
              <span>{a.providerId || a.provider}</span>
              <span className="text-ink-500">/</span>
              <span className="opacity-80">{a.modelId || a.model}</span>
              {a.latencyMs != null && <span className="text-ink-500">· {a.latencyMs}ms</span>}
            </div>
            {i < attempts.length - 1 && mode !== "fusion" && (
              <svg width="16" height="8" className="text-ink-600 shrink-0">
                <line x1="0" y1="4" x2="16" y2="4" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
              </svg>
            )}
          </React.Fragment>
        );
      })}
      {fused && (
        <span className="ml-1 text-[11px] text-frost-400 font-medium flex items-center gap-1">
          → merged into one answer
        </span>
      )}
    </div>
  );
}
