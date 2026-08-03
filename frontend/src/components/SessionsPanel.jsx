import React, { useEffect, useState } from "react";
import { Monitor, Smartphone, LogOut, ShieldCheck } from "lucide-react";
import { api } from "../lib/api.js";

/** Very rough UA sniff — good enough to pick an icon, not meant to be precise device detection. */
function isMobileUA(ua) {
  return /Mobile|Android|iPhone|iPad/i.test(ua || "");
}

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function describeUA(ua) {
  if (!ua) return "Unknown device";
  if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) return isMobileUA(ua) ? "Chrome (mobile)" : "Chrome";
  if (/Firefox/i.test(ua)) return isMobileUA(ua) ? "Firefox (mobile)" : "Firefox";
  if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) return isMobileUA(ua) ? "Safari (mobile)" : "Safari";
  if (/Edg/i.test(ua)) return "Edge";
  return isMobileUA(ua) ? "Mobile browser" : "Desktop browser";
}

export default function SessionsPanel() {
  const [sessions, setSessions] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [revokingOthers, setRevokingOthers] = useState(false);

  const load = async () => {
    const data = await api.getSessions();
    setSessions(data.sessions);
  };

  useEffect(() => {
    load();
  }, []);

  const revoke = async (id) => {
    setBusyId(id);
    try {
      await api.revokeSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } finally {
      setBusyId(null);
    }
  };

  const revokeOthers = async () => {
    setRevokingOthers(true);
    try {
      await api.revokeOtherSessions();
      await load();
    } finally {
      setRevokingOthers(false);
    }
  };

  if (!sessions) {
    return <p className="text-ink-500 text-sm">Loading sessions…</p>;
  }

  const otherCount = sessions.filter((s) => !s.isCurrent).length;

  return (
    <div className="space-y-2">
      {sessions.map((s) => (
        <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-ink-800 bg-ink-900 p-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${s.isCurrent ? "bg-signal-green/10 text-signal-green" : "bg-ink-800 text-ink-500"}`}>
              {isMobileUA(s.userAgent) ? <Smartphone size={14} /> : <Monitor size={14} />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm text-ink-200 truncate">{describeUA(s.userAgent)}</p>
                {s.isCurrent && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-signal-green/10 text-signal-green border border-signal-green/25 flex items-center gap-0.5 shrink-0">
                    <ShieldCheck size={9} /> this device
                  </span>
                )}
              </div>
              <p className="text-[11px] text-ink-500 truncate">
                {s.ipAddress ? `${s.ipAddress} · ` : ""}active {timeAgo(s.lastSeenAt)}
              </p>
            </div>
          </div>
          {!s.isCurrent && (
            <button
              onClick={() => revoke(s.id)}
              disabled={busyId === s.id}
              className="text-ink-500 hover:text-signal-red transition p-1.5 rounded-md hover:bg-ink-800 shrink-0"
              aria-label="Revoke this session"
              title="Log this device out"
            >
              <LogOut size={14} />
            </button>
          )}
        </div>
      ))}

      {otherCount > 0 && (
        <button
          onClick={revokeOthers}
          disabled={revokingOthers}
          className="w-full mt-1 text-xs text-signal-red/90 hover:text-signal-red border border-signal-red/20 hover:border-signal-red/40 rounded-lg py-2 transition"
        >
          {revokingOthers ? "Logging out other devices…" : `Log out ${otherCount} other device${otherCount > 1 ? "s" : ""}`}
        </button>
      )}
    </div>
  );
}
