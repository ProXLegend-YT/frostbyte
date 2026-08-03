/**
 * Executes code via Piston (emkc.org/api/v2/piston) — a free, public,
 * no-API-key-required code execution service. This replaces the
 * Docker-based sandbox from the self-hosted version, since Vercel
 * serverless functions have no Docker daemon available to them at all.
 *
 * Piston runs each submission in its own isolated container on Piston's
 * infrastructure, not ours — FrostByte is just calling out to it over
 * HTTPS, the same way it calls any AI provider's API. It's rate-limited
 * (roughly a handful of requests per second) and best-effort: it's a
 * shared public service, not a guaranteed SLA, which is worth knowing if
 * execution occasionally fails under load — that's Piston's availability,
 * not a bug in FrostByte.
 */

const PISTON_URL = "https://emkc.org/api/v2/piston/execute";

// Piston needs an exact runtime version per language, not just a name.
// These map FrostByte's language keys to whatever Piston currently has
// installed; if Piston updates its runtime list, this may need a version
// bump — see https://emkc.org/api/v2/piston/runtimes for the live list.
const LANGUAGE_CONFIG = {
  python: { language: "python", version: "3.12.0", file: "main.py" },
  javascript: { language: "javascript", version: "18.15.0", file: "main.js" },
  typescript: { language: "typescript", version: "5.0.3", file: "main.ts" },
  bash: { language: "bash", version: "5.2.0", file: "main.sh" },
  go: { language: "go", version: "1.16.2", file: "main.go" },
  ruby: { language: "ruby", version: "3.0.1", file: "main.rb" }
};

const MAX_OUTPUT_CHARS = 20_000;
const REQUEST_TIMEOUT_MS = 15_000;

export function isLanguageSupported(lang) {
  return Object.prototype.hasOwnProperty.call(LANGUAGE_CONFIG, lang);
}

export function supportedLanguages() {
  return Object.keys(LANGUAGE_CONFIG);
}

/** Piston is a public service reachable over HTTPS — "available" here just means FrostByte can reach it, not a local dependency check. */
export async function dockerAvailable() {
  try {
    const res = await fetch("https://emkc.org/api/v2/piston/runtimes", { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Runs `code` for the given language via Piston.
 * Returns { ok, stdout, stderr, exitCode, timedOut, durationMs }
 */
export async function runInSandbox({ language, code, stdin = "" }) {
  const start = Date.now();
  const spec = LANGUAGE_CONFIG[language];
  if (!spec) {
    return { ok: false, error: `Unsupported language "${language}". Supported: ${supportedLanguages().join(", ")}` };
  }

  try {
    const res = await fetch(PISTON_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: spec.language,
        version: spec.version,
        files: [{ name: spec.file, content: code }],
        stdin,
        run_timeout: REQUEST_TIMEOUT_MS
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS + 5000)
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `Piston returned HTTP ${res.status}: ${text.slice(0, 200)}`, durationMs: Date.now() - start };
    }

    const data = await res.json();
    const run = data.run || {};
    const timedOut = run.signal === "SIGKILL" || run.code === null;

    return {
      ok: !timedOut,
      stdout: (run.stdout || "").slice(0, MAX_OUTPUT_CHARS),
      stderr: timedOut ? "Execution timed out." : (run.stderr || "").slice(0, MAX_OUTPUT_CHARS),
      exitCode: run.code,
      timedOut,
      durationMs: Date.now() - start
    };
  } catch (err) {
    return {
      ok: false,
      error: err.name === "TimeoutError" || err.name === "AbortError" ? "Request to the code execution service timed out." : err.message,
      durationMs: Date.now() - start
    };
  }
}
