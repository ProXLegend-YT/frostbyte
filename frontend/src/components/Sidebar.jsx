import React, { useEffect, useState } from "react";
import { MessageSquarePlus, MessagesSquare, Settings, Wrench, X, Snowflake, Trash2, LogOut, UserCircle, BarChart3, Search, Loader2 } from "lucide-react";
import { api } from "../lib/api.js";

export default function Sidebar({
  open,
  onClose,
  view,
  setView,
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  user,
  onLogout,
  searchFocusRequest
}) {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null); // null = not searching, [] = no results
  const [searching, setSearching] = useState(false);
  const searchInputRef = React.useRef(null);

  // Focuses the search box whenever the parent bumps searchFocusRequest
  // (Cmd/Ctrl+/). Skips the initial mount (value starts at 0) so the search
  // box doesn't unexpectedly steal focus when the app first loads.
  useEffect(() => {
    if (searchFocusRequest > 0) searchInputRef.current?.focus();
  }, [searchFocusRequest]);

  // Debounced search: waits for a short pause in typing before hitting the
  // server, and cancels itself if the query changes again before it fires.
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const data = await api.searchConversations(trimmed);
        setSearchResults(data.results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const isSearching = query.trim().length > 0;
  return (
    <>
      {open && <div className="fixed inset-0 bg-black/60 z-30 md:hidden" onClick={onClose} />}

      <aside
        className={`fixed md:static z-40 top-0 left-0 h-full w-72 bg-ink-900 border-r border-ink-800 flex flex-col
          transition-transform duration-200 ease-out
          ${open ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
      >
        <div className="flex items-center justify-between px-4 h-16 shrink-0 border-b border-ink-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-frost-400 to-frost-600 flex items-center justify-center shadow-lg shadow-frost-600/20">
              <Snowflake size={16} className="text-ink-950" strokeWidth={2.5} />
            </div>
            <span className="font-display text-lg tracking-wide text-ink-100">FROSTBYTE</span>
          </div>
          <button className="md:hidden p-1 text-ink-400 hover:text-ink-100" onClick={onClose} aria-label="Close menu">
            <X size={20} />
          </button>
        </div>

        <div className="p-3 shrink-0">
          <button
            onClick={onNewConversation}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-frost-500/10 border border-frost-500/25 text-frost-400
              hover:bg-frost-500/15 active:scale-[0.98] transition text-sm font-medium"
          >
            <MessageSquarePlus size={16} />
            New session
          </button>
        </div>

        <nav className="px-3 flex flex-col gap-1 shrink-0">
          <NavButton icon={<MessagesSquare size={16} />} label="Chat" active={view === "chat"} onClick={() => setView("chat")} />
          <NavButton icon={<Wrench size={16} />} label="Tools & Skills" active={view === "tools"} onClick={() => setView("tools")} />
          <NavButton icon={<BarChart3 size={16} />} label="Usage & Cost" active={view === "usage"} onClick={() => setView("usage")} />
          <NavButton icon={<Settings size={16} />} label="Models & API keys" active={view === "settings"} onClick={() => setView("settings")} />
        </nav>

        <div className="px-3 pb-2 shrink-0">
          <div className="flex items-center gap-2 bg-ink-950 border border-ink-700 rounded-lg px-2.5 py-1.5 focus-within:border-frost-500/40 transition">
            {searching ? <Loader2 size={13} className="text-ink-500 animate-spin shrink-0" /> : <Search size={13} className="text-ink-500 shrink-0" />}
            <input
              ref={searchInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search conversations…"
              className="flex-1 bg-transparent outline-none text-xs placeholder:text-ink-600 min-w-0"
            />
            {query && (
              <button onClick={() => setQuery("")} className="text-ink-600 hover:text-ink-300 shrink-0" aria-label="Clear search">
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        <div className="mt-1 px-4 text-[11px] font-semibold tracking-wider text-ink-500 uppercase shrink-0">
          {isSearching ? "Search results" : "History"}
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
          {isSearching ? (
            <>
              {searchResults?.length === 0 && !searching && (
                <p className="text-ink-500 text-sm px-3 py-6 text-center">No conversations match "{query.trim()}".</p>
              )}
              {searchResults?.map((r) => (
                <div
                  key={r.id}
                  className={`group flex flex-col gap-0.5 px-3 py-2 rounded-lg cursor-pointer text-sm transition
                    ${activeConversationId === r.id ? "bg-ink-800 text-ink-100" : "text-ink-300 hover:bg-ink-800/60"}`}
                  onClick={() => {
                    setQuery("");
                    onSelectConversation(r.id);
                  }}
                >
                  <span className="truncate font-medium">{r.title || "New chat"}</span>
                  {r.snippet && <span className="text-[11px] text-ink-500 line-clamp-2">{r.snippet}</span>}
                </div>
              ))}
            </>
          ) : (
            <>
              {conversations.length === 0 && (
                <p className="text-ink-500 text-sm px-3 py-6 text-center">No sessions yet. Start one above.</p>
              )}
              {conversations.map((c) => (
                <div
                  key={c.id}
                  className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition
                    ${activeConversationId === c.id ? "bg-ink-800 text-ink-100" : "text-ink-300 hover:bg-ink-800/60"}`}
                  onClick={() => onSelectConversation(c.id)}
                >
                  <span className="truncate flex-1">{c.title || "New chat"}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteConversation(c.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-ink-500 hover:text-signal-red transition p-1"
                    aria-label="Delete session"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="p-3 border-t border-ink-800 shrink-0">
          <div className="flex items-center gap-2 px-2 py-2">
            <div className="w-7 h-7 rounded-full bg-ink-800 flex items-center justify-center text-ink-400 shrink-0">
              <UserCircle size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-ink-200 truncate">{user?.username}</p>
              <p className="text-[10px] text-ink-600 capitalize">{user?.role}</p>
            </div>
            <button
              onClick={onLogout}
              className="text-ink-500 hover:text-signal-red transition p-1.5 rounded-md hover:bg-ink-800"
              aria-label="Log out"
              title="Log out"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

function NavButton({ icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition
        ${active ? "bg-ink-800 text-frost-400" : "text-ink-300 hover:bg-ink-800/60 hover:text-ink-100"}`}
    >
      {icon}
      {label}
    </button>
  );
}
