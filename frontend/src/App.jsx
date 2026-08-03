import React, { useEffect, useState, useCallback } from "react";
import Sidebar from "./components/Sidebar.jsx";
import ChatView from "./components/ChatView.jsx";
import SettingsView from "./components/SettingsView.jsx";
import ToolsView from "./components/ToolsView.jsx";
import UsageView from "./components/UsageView.jsx";
import AuthScreen from "./components/AuthScreen.jsx";
import { api } from "./lib/api.js";
import { useKeyboardShortcuts } from "./lib/useKeyboardShortcuts.js";
import { Menu } from "lucide-react";

export default function App() {
  // authStatus: null = still checking, "needsSetup" | "needsLogin" | user object once authed
  const [authStatus, setAuthStatus] = useState(null);
  const [user, setUser] = useState(null);

  const [view, setView] = useState("chat");
  const [providers, setProviders] = useState([]);
  const [toolProviders, setToolProviders] = useState([]);
  const [fusion, setFusion] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  // Bumped whenever Cmd/Ctrl+/ fires; Sidebar watches this value and focuses
  // its search input in response. A counter (rather than a boolean) so
  // pressing the shortcut again while search is already focused still
  // triggers the effect (a boolean toggling true->true wouldn't).
  const [searchFocusRequest, setSearchFocusRequest] = useState(0);

  // On mount, figure out whether this is a fresh install (show setup screen),
  // an existing install where we're not logged in (show login screen), or
  // an existing valid session (skip straight to the app).
  useEffect(() => {
    (async () => {
      try {
        const me = await api.getMe();
        setUser(me.user);
        setAuthStatus("authed");
      } catch {
        const status = await api.getAuthStatus();
        setAuthStatus(status.needsSetup ? "needsSetup" : "needsLogin");
      }
    })();
  }, []);

  const refreshProviders = useCallback(async () => {
    const data = await api.getProviders();
    setProviders(data.providers);
    setToolProviders(data.toolProviders);
    setFusion(data.fusion);
  }, []);

  const refreshConversations = useCallback(async () => {
    const data = await api.getConversations();
    setConversations(data.conversations);
  }, []);

  useEffect(() => {
    if (authStatus !== "authed") return;
    (async () => {
      try {
        await Promise.all([refreshProviders(), refreshConversations()]);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [authStatus, refreshProviders, refreshConversations]);

  const startNewConversation = async () => {
    const { id } = await api.createConversation();
    await refreshConversations();
    setActiveConversationId(id);
    setView("chat");
    setSidebarOpen(false);
  };

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
    setAuthStatus("needsLogin");
    setProviders([]);
    setConversations([]);
    setActiveConversationId(null);
    setLoading(true);
  };

  useKeyboardShortcuts({
    onNewChat: () => {
      if (authStatus === "authed") startNewConversation();
    },
    onFocusSearch: () => {
      if (authStatus === "authed") {
        setSidebarOpen(true); // on mobile, opening the sidebar is required before its search box is even visible
        setSearchFocusRequest((n) => n + 1);
      }
    },
    onEscape: () => {
      if (sidebarOpen) setSidebarOpen(false);
    }
  });

  if (authStatus === null) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-ink-950">
        <div className="flex items-center gap-2 text-ink-400">
          <span className="w-2 h-2 rounded-full bg-frost-500 animate-pulseDot" />
          <span className="w-2 h-2 rounded-full bg-frost-500 animate-pulseDot [animation-delay:0.15s]" />
          <span className="w-2 h-2 rounded-full bg-frost-500 animate-pulseDot [animation-delay:0.3s]" />
        </div>
      </div>
    );
  }

  if (authStatus !== "authed") {
    return (
      <AuthScreen
        needsSetup={authStatus === "needsSetup"}
        onAuthed={(u) => {
          setUser(u);
          setAuthStatus("authed");
        }}
      />
    );
  }

  return (
    <div className="h-screen w-screen flex bg-ink-950 text-ink-100 overflow-hidden">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        view={view}
        setView={(v) => {
          setView(v);
          setSidebarOpen(false);
        }}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={(id) => {
          setActiveConversationId(id);
          setView("chat");
          setSidebarOpen(false);
        }}
        onNewConversation={startNewConversation}
        onDeleteConversation={async (id) => {
          await api.deleteConversation(id);
          await refreshConversations();
          if (activeConversationId === id) setActiveConversationId(null);
        }}
        user={user}
        onLogout={handleLogout}
        searchFocusRequest={searchFocusRequest}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 px-4 h-14 border-b border-ink-800 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 rounded-lg text-ink-300 hover:text-ink-100 hover:bg-ink-800 active:scale-95 transition"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <span className="font-display tracking-wide text-frost-400 text-sm">FROSTBYTE</span>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center gap-2 text-ink-400">
              <span className="w-2 h-2 rounded-full bg-frost-500 animate-pulseDot" />
              <span className="w-2 h-2 rounded-full bg-frost-500 animate-pulseDot [animation-delay:0.15s]" />
              <span className="w-2 h-2 rounded-full bg-frost-500 animate-pulseDot [animation-delay:0.3s]" />
            </div>
          </div>
        ) : view === "chat" ? (
          <ChatView
            providers={providers}
            fusion={fusion}
            conversationId={activeConversationId}
            onConversationCreated={async (id) => {
              setActiveConversationId(id);
              await refreshConversations();
            }}
          />
        ) : view === "settings" ? (
          <SettingsView providers={providers} toolProviders={toolProviders} onChange={refreshProviders} user={user} />
        ) : view === "usage" ? (
          <UsageView providers={providers} />
        ) : (
          <ToolsView isAdmin={user?.role === "admin"} />
        )}
      </div>
    </div>
  );
}
