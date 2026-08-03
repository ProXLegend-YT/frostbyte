import React from "react";
import { Copy, Check, Play, Loader2, Terminal, AlertTriangle } from "lucide-react";
import { api } from "../lib/api.js";

// Maps common markdown fence languages to the sandbox's language keys.
const RUNNABLE_LANGS = {
  python: "python",
  py: "python",
  javascript: "javascript",
  js: "javascript",
  typescript: "typescript",
  ts: "typescript",
  bash: "bash",
  sh: "bash",
  shell: "bash",
  go: "go",
  golang: "go",
  ruby: "ruby",
  rb: "ruby"
};

function CodeBlock({ lang, code }) {
  const [copied, setCopied] = React.useState(false);
  const [running, setRunning] = React.useState(false);
  const [result, setResult] = React.useState(null);
  const sandboxLang = RUNNABLE_LANGS[(lang || "").toLowerCase()];

  const run = async () => {
    setRunning(true);
    setResult(null);
    try {
      const res = await api.runCode(sandboxLang, code);
      setResult(res);
    } catch (err) {
      setResult({ ok: false, error: err.message });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="relative group my-2">
      <div className="flex items-center justify-between px-3 py-1.5 bg-ink-800 rounded-t-lg border border-b-0 border-ink-700">
        <span className="text-[11px] text-ink-400 font-mono">{lang || "code"}</span>
        <div className="flex items-center gap-3">
          {sandboxLang && (
            <button
              onClick={run}
              disabled={running}
              className="text-frost-400 hover:text-frost-300 transition flex items-center gap-1 text-[11px] disabled:opacity-60"
            >
              {running ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
              {running ? "Running…" : "Run"}
            </button>
          )}
          <button
            onClick={() => {
              navigator.clipboard.writeText(code);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="text-ink-400 hover:text-ink-100 transition flex items-center gap-1 text-[11px]"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
      <pre className="!mt-0 !rounded-t-none"><code>{code}</code></pre>

      {result && (
        <div className="border border-t-0 border-ink-700 rounded-b-lg bg-ink-950 px-3 py-2 text-[12px] font-mono">
          {result.ok === false && !result.stdout && !result.stderr ? (
            <div className="flex items-start gap-1.5 text-signal-amber">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              <span>{result.error}</span>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1.5 text-ink-500 mb-1">
                <Terminal size={11} />
                <span>
                  exit {result.exitCode} · {result.durationMs}ms
                  {result.timedOut && " · timed out"}
                </span>
              </div>
              {result.stdout && <pre className="whitespace-pre-wrap text-ink-200 !p-0 !border-0 !bg-transparent">{result.stdout}</pre>}
              {result.stderr && <pre className="whitespace-pre-wrap text-signal-red !p-0 !border-0 !bg-transparent">{result.stderr}</pre>}
              {!result.stdout && !result.stderr && <span className="text-ink-600 italic">(no output)</span>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Minimal, dependency-free markdown rendering: fenced code blocks, bold, inline code, line breaks. */
export default function MarkdownLite({ text }) {
  const parts = text.split(/```(\w*)\n([\s\S]*?)```/g);
  const nodes = [];
  for (let i = 0; i < parts.length; i += 3) {
    const plain = parts[i];
    const lang = parts[i + 1];
    const code = parts[i + 2];
    if (plain) {
      plain.split("\n\n").forEach((para, idx) => {
        if (!para.trim()) return;
        nodes.push(
          <p key={`p-${i}-${idx}`}>
            {para.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((seg, j) => {
              if (seg.startsWith("**") && seg.endsWith("**")) return <strong key={j}>{seg.slice(2, -2)}</strong>;
              if (seg.startsWith("`") && seg.endsWith("`")) return (
                <code key={j} className="px-1 py-0.5 rounded bg-ink-800 text-frost-300 font-mono text-[0.85em]">
                  {seg.slice(1, -1)}
                </code>
              );
              return seg;
            })}
          </p>
        );
      });
    }
    if (code !== undefined) {
      nodes.push(<CodeBlock key={`c-${i}`} lang={lang} code={code} />);
    }
  }
  return <div className="prose-code">{nodes}</div>;
}
