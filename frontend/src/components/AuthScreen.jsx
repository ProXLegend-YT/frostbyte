import React, { useState } from "react";
import { Snowflake, Loader2, AlertCircle } from "lucide-react";
import { api } from "../lib/api.js";

export default function AuthScreen({ needsSetup, onAuthed }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    if (needsSetup && password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (needsSetup && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      const result = needsSetup ? await api.setup(username, password) : await api.login(username, password);
      onAuthed(result.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-ink-950 px-4">
      <div className="w-full max-w-sm animate-slideUp">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-frost-400 to-frost-600 flex items-center justify-center shadow-xl shadow-frost-600/20 mb-4">
            <Snowflake size={26} className="text-ink-950" strokeWidth={2.5} />
          </div>
          <h1 className="font-display text-2xl text-ink-100 tracking-wide">FROSTBYTE</h1>
          <p className="text-ink-500 text-sm mt-1">{needsSetup ? "Create the admin account to get started" : "Sign in to continue"}</p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {error && (
            <div className="flex items-center gap-2 text-xs text-signal-red bg-signal-red/10 border border-signal-red/25 rounded-lg px-3 py-2">
              <AlertCircle size={13} className="shrink-0" /> {error}
            </div>
          )}

          <label className="block">
            <span className="text-[11px] text-ink-500 mb-1 block">Username</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
              className="w-full bg-ink-900 border border-ink-700 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-frost-500/50 transition"
            />
          </label>

          <label className="block">
            <span className="text-[11px] text-ink-500 mb-1 block">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={needsSetup ? "new-password" : "current-password"}
              className="w-full bg-ink-900 border border-ink-700 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-frost-500/50 transition"
            />
          </label>

          {needsSetup && (
            <label className="block">
              <span className="text-[11px] text-ink-500 mb-1 block">Confirm password</span>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                className="w-full bg-ink-900 border border-ink-700 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-frost-500/50 transition"
              />
            </label>
          )}

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full py-2.5 rounded-lg bg-frost-500 hover:bg-frost-400 disabled:bg-ink-700 disabled:text-ink-500 text-ink-950 text-sm font-semibold transition flex items-center justify-center gap-2 mt-2"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {needsSetup ? "Create admin account" : "Sign in"}
          </button>
        </form>

        {needsSetup && (
          <p className="text-[11px] text-ink-600 text-center mt-4">
            This is a fresh FrostByte install — whoever creates this first account becomes the admin and can invite others from Settings.
          </p>
        )}
      </div>
    </div>
  );
}
