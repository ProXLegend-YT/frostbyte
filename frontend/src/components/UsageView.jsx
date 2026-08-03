import React, { useEffect, useState } from "react";
import { BarChart3, Coins, Zap, AlertTriangle, Info, Pencil, Trash2, Check, X } from "lucide-react";
import { api } from "../lib/api.js";

const RANGE_OPTIONS = [
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 }
];

export default function UsageView({ providers }) {
  const [days, setDays] = useState(30);
  const [summary, setSummary] = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [rates, setRates] = useState([]);
  const [editingRateFor, setEditingRateFor] = useState(null);

  const load = async (d) => {
    const [s, t, r] = await Promise.all([api.getUsageSummary(d), api.getUsageTimeline(Math.min(d, 30)), api.getModelRates()]);
    setSummary(s.summary);
    setTimeline(t.timeline);
    setRates(r.rates);
  };

  useEffect(() => {
    load(days);
  }, [days]);

  const rateFor = (providerId, modelId) => rates.find((r) => r.provider_id === providerId && r.model_id === modelId);

  const providerName = (id) => providers.find((p) => p.id === id)?.name || id;

  const totalCalls = summary?.reduce((sum, s) => sum + s.totalCalls, 0) || 0;
  const totalFailed = summary?.reduce((sum, s) => sum + s.failedCalls, 0) || 0;
  const totalCost = summary?.reduce((sum, s) => sum + (s.estimatedCost || 0), 0) || 0;
  const anyCostData = summary?.some((s) => s.hasRate) || false;
  const maxDayCalls = Math.max(1, ...(timeline || []).map((t) => t.calls));

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-8">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
          <h1 className="font-display text-2xl text-ink-100 tracking-wide">USAGE &amp; COST</h1>
          <div className="flex gap-1 bg-ink-900 border border-ink-700 rounded-lg p-1">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDays(opt.value)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                  days === opt.value ? "bg-frost-500/15 text-frost-400" : "text-ink-400 hover:text-ink-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-ink-400 text-sm mb-6">Your own calls only — every team member sees just their own usage and cost.</p>

        {/* Summary stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
          <StatCard icon={<Zap size={14} />} label="Total calls" value={totalCalls.toLocaleString()} />
          <StatCard
            icon={<AlertTriangle size={14} />}
            label="Failed calls"
            value={totalFailed.toLocaleString()}
            tone={totalFailed > 0 ? "amber" : "default"}
          />
          <StatCard
            icon={<Coins size={14} />}
            label="Estimated cost"
            value={anyCostData ? `$${totalCost.toFixed(2)}` : "—"}
            hint={!anyCostData ? "Add rates below to estimate cost" : null}
          />
        </div>

        {/* Timeline bar chart (CSS-based, no charting dep needed) */}
        {timeline && timeline.length > 0 && (
          <div className="rounded-xl border border-ink-800 bg-ink-900 p-4 mb-6">
            <h2 className="text-sm font-semibold text-ink-200 mb-3 flex items-center gap-2">
              <BarChart3 size={13} className="text-frost-400" /> Calls per day
            </h2>
            <div className="flex items-end gap-1 h-24">
              {timeline.map((t) => (
                <div key={t.day} className="flex-1 flex flex-col items-center justify-end gap-1 group relative">
                  <div
                    className="w-full bg-frost-500/70 hover:bg-frost-400 rounded-t transition-colors"
                    style={{ height: `${Math.max(4, (t.calls / maxDayCalls) * 100)}%` }}
                  />
                  <div className="absolute -top-8 opacity-0 group-hover:opacity-100 transition bg-ink-950 border border-ink-700 rounded px-2 py-1 text-[10px] whitespace-nowrap pointer-events-none z-10">
                    {t.day}: {t.calls} call{t.calls !== 1 ? "s" : ""}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Per-model breakdown */}
        <h2 className="text-sm font-semibold text-ink-200 mb-2">By model</h2>
        {(!summary || summary.length === 0) && (
          <p className="text-ink-500 text-sm px-1 py-6 text-center border border-dashed border-ink-800 rounded-xl">
            No usage yet in this window — send a chat message and it'll show up here.
          </p>
        )}
        <div className="space-y-2">
          {summary?.map((s) => {
            const rate = rateFor(s.providerId, s.modelId);
            const isEditing = editingRateFor === `${s.providerId}:${s.modelId}`;
            return (
              <div key={`${s.providerId}:${s.modelId}`} className="rounded-xl border border-ink-800 bg-ink-900 p-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-100 truncate">
                      {providerName(s.providerId)} <span className="text-ink-500">·</span> <span className="font-mono text-xs">{s.modelId}</span>
                    </p>
                    <p className="text-[11px] text-ink-500">
                      {s.totalCalls} call{s.totalCalls !== 1 ? "s" : ""}
                      {s.failedCalls > 0 && <span className="text-signal-amber"> · {s.failedCalls} failed</span>}
                      {s.avgLatencyMs && ` · ${s.avgLatencyMs}ms avg`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className="text-xs text-ink-400">
                        {(s.totalInputTokens || 0).toLocaleString()} in / {(s.totalOutputTokens || 0).toLocaleString()} out tok
                      </p>
                      <p className="text-xs font-medium text-ink-100">{s.hasRate ? `$${s.estimatedCost.toFixed(3)}` : "no rate set"}</p>
                    </div>
                    <button
                      onClick={() => setEditingRateFor(isEditing ? null : `${s.providerId}:${s.modelId}`)}
                      className="text-ink-500 hover:text-frost-400 p-1.5 rounded-md hover:bg-ink-800 transition"
                      title="Set $/million token rate"
                    >
                      <Pencil size={13} />
                    </button>
                  </div>
                </div>

                {isEditing && (
                  <RateEditor
                    initial={rate}
                    onCancel={() => setEditingRateFor(null)}
                    onSave={async (inRate, outRate) => {
                      await api.setModelRate(s.providerId, s.modelId, inRate, outRate);
                      setEditingRateFor(null);
                      await load(days);
                    }}
                    onClear={async () => {
                      await api.deleteModelRate(s.providerId, s.modelId);
                      setEditingRateFor(null);
                      await load(days);
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-start gap-2 text-[11px] text-ink-500 bg-ink-900 border border-ink-800 rounded-lg px-3 py-2.5 mt-6">
          <Info size={13} className="mt-0.5 shrink-0" />
          FrostByte doesn't ship built-in pricing data (rates change often and vary by provider/region), so cost is only estimated for
          models where you've entered a $/million-token rate yourself. Token counts come directly from each provider's API response when
          it reports them — a few providers don't report usage at all, in which case only the call count is available.
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, tone = "default", hint }) {
  const toneClasses = tone === "amber" ? "text-signal-amber" : "text-ink-100";
  return (
    <div className="rounded-xl border border-ink-800 bg-ink-900 p-3.5">
      <div className="flex items-center gap-1.5 text-ink-500 text-xs mb-1.5">
        {icon} {label}
      </div>
      <p className={`text-xl font-semibold ${toneClasses}`}>{value}</p>
      {hint && <p className="text-[10px] text-ink-600 mt-0.5">{hint}</p>}
    </div>
  );
}

function RateEditor({ initial, onSave, onCancel, onClear }) {
  const [inRate, setInRate] = useState(initial?.input_rate_per_million ?? "");
  const [outRate, setOutRate] = useState(initial?.output_rate_per_million ?? "");

  return (
    <div className="mt-3 pt-3 border-t border-ink-800 flex items-end gap-2 flex-wrap">
      <label className="block">
        <span className="text-[11px] text-ink-500 mb-1 block">$ / million input tokens</span>
        <input
          type="number"
          step="0.01"
          value={inRate}
          onChange={(e) => setInRate(e.target.value)}
          placeholder="e.g. 3.00"
          className="w-32 bg-ink-950 border border-ink-700 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-frost-500/50"
        />
      </label>
      <label className="block">
        <span className="text-[11px] text-ink-500 mb-1 block">$ / million output tokens</span>
        <input
          type="number"
          step="0.01"
          value={outRate}
          onChange={(e) => setOutRate(e.target.value)}
          placeholder="e.g. 15.00"
          className="w-32 bg-ink-950 border border-ink-700 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-frost-500/50"
        />
      </label>
      <button
        onClick={() => onSave(inRate === "" ? null : Number(inRate), outRate === "" ? null : Number(outRate))}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-frost-500 hover:bg-frost-400 text-ink-950 text-xs font-medium transition"
      >
        <Check size={12} /> Save
      </button>
      {initial && (
        <button onClick={onClear} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-signal-red/90 hover:text-signal-red text-xs transition">
          <Trash2 size={12} /> Clear
        </button>
      )}
      <button onClick={onCancel} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-ink-400 hover:text-ink-200 text-xs transition">
        <X size={12} /> Cancel
      </button>
    </div>
  );
}
