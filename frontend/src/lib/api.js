const BASE = "/api";

async function j(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// All requests include credentials so the cf_session cookie is sent/stored.
const withCreds = (opts = {}) => ({ ...opts, credentials: "include" });

export const api = {
  // --- Auth ---
  getAuthStatus: () => fetch(`${BASE}/auth/status`, withCreds()).then(j),
  setup: (username, password) =>
    fetch(`${BASE}/auth/setup`, withCreds({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) })).then(j),
  login: (username, password) =>
    fetch(`${BASE}/auth/login`, withCreds({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) })).then(j),
  logout: () => fetch(`${BASE}/auth/logout`, withCreds({ method: "POST" })).then(j),
  getMe: () => fetch(`${BASE}/auth/me`, withCreds()).then(j),
  createUser: (username, password, role) =>
    fetch(`${BASE}/auth/users`, withCreds({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password, role }) })).then(j),
  getSessions: () => fetch(`${BASE}/auth/sessions`, withCreds()).then(j),
  revokeSession: (id) => fetch(`${BASE}/auth/sessions/${id}`, withCreds({ method: "DELETE" })).then(j),
  revokeOtherSessions: () => fetch(`${BASE}/auth/sessions/revoke-others`, withCreds({ method: "POST" })).then(j),

  getProviders: () => fetch(`${BASE}/providers`, withCreds()).then(j),
  saveKey: (providerId, apiKey, accountId) =>
    fetch(`${BASE}/providers/${providerId}/key`, withCreds({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey, accountId })
    })).then(j),
  deleteKey: (providerId) => fetch(`${BASE}/providers/${providerId}/key`, withCreds({ method: "DELETE" })).then(j),
  addCustomProvider: (payload) =>
    fetch(`${BASE}/providers/custom`, withCreds({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })).then(j),
  removeCustomProvider: (id) => fetch(`${BASE}/providers/custom/${id}`, withCreds({ method: "DELETE" })).then(j),
  updateCustomProvider: (id, payload) =>
    fetch(`${BASE}/providers/custom/${id}`, withCreds({
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })).then(j),
  testProviderConnection: (id, modelId) =>
    fetch(`${BASE}/providers/${id}/test`, withCreds({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelId })
    })).then(j),

  getChains: () => fetch(`${BASE}/chains`, withCreds()).then(j),
  saveChain: (payload) =>
    fetch(`${BASE}/chains`, withCreds({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })).then(j),
  deleteChain: (id) => fetch(`${BASE}/chains/${id}`, withCreds({ method: "DELETE" })).then(j),

  getToolRegistry: () => fetch(`${BASE}/tools/registry`, withCreds()).then(j),
  addTool: (payload) =>
    fetch(`${BASE}/tools/registry`, withCreds({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })).then(j),
  toggleTool: (id, enabled) =>
    fetch(`${BASE}/tools/registry/${id}`, withCreds({ method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled }) })).then(j),
  deleteTool: (id) => fetch(`${BASE}/tools/registry/${id}`, withCreds({ method: "DELETE" })).then(j),

  tavilySearch: (query) =>
    fetch(`${BASE}/tools/tavily/search`, withCreds({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query }) })).then(j),

  getConversations: () => fetch(`${BASE}/conversations`, withCreds()).then(j),
  searchConversations: (query) => fetch(`${BASE}/conversations/search?q=${encodeURIComponent(query)}`, withCreds()).then(j),
  createConversation: () => fetch(`${BASE}/conversations`, withCreds({ method: "POST" })).then(j),
  getMessages: (id) => fetch(`${BASE}/conversations/${id}/messages`, withCreds()).then(j),
  deleteConversation: (id) => fetch(`${BASE}/conversations/${id}`, withCreds({ method: "DELETE" })).then(j),
  /** Deletes a message and everything after it — the shared primitive behind editing a message and regenerating a response. */
  truncateFromMessage: (conversationId, messageId) =>
    fetch(`${BASE}/conversations/${conversationId}/messages/from/${messageId}`, withCreds({ method: "DELETE" })).then(j),

  /**
   * Downloads a conversation export (markdown or JSON) and triggers the
   * browser's normal save dialog, reusing the filename the server chose
   * (from the Content-Disposition header) rather than hardcoding one here.
   */
  async exportConversation(id, format = "markdown") {
    const res = await fetch(`${BASE}/conversations/${id}/export?format=${format}`, withCreds());
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Export failed");
    }
    const disposition = res.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename="([^"]+)"/);
    const filename = match ? match[1] : `conversation.${format === "json" ? "json" : "md"}`;

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  getExecuteStatus: () => fetch(`${BASE}/execute/status`, withCreds()).then(j),
  runCode: (language, code, stdin) =>
    fetch(`${BASE}/execute/run`, withCreds({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language, code, stdin })
    })).then(j),

  getProjectFiles: (conversationId) => fetch(`${BASE}/project-files/${conversationId}`, withCreds()).then(j),
  /**
   * Uploads either a single .zip or a FileList of individual files. For
   * folder drops, browsers attach `webkitRelativePath` to each File object —
   * that's forwarded as a same-named form field so the backend can preserve
   * the folder structure instead of flattening everything to bare filenames.
   */
  uploadProjectFiles: (conversationId, fileList) => {
    const formData = new FormData();
    for (const file of fileList) {
      formData.append("files", file);
      const relPath = file.webkitRelativePath || file.name;
      if (relPath !== file.name) formData.append(`relativePath_${file.name}`, relPath);
    }
    return fetch(`${BASE}/project-files/${conversationId}/upload`, withCreds({ method: "POST", body: formData })).then(j);
  },
  toggleProjectFile: (conversationId, fileId, included) =>
    fetch(`${BASE}/project-files/${conversationId}/${fileId}`, withCreds({
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ included })
    })).then(j),
  deleteProjectFile: (conversationId, fileId) => fetch(`${BASE}/project-files/${conversationId}/${fileId}`, withCreds({ method: "DELETE" })).then(j),
  clearProjectFiles: (conversationId) => fetch(`${BASE}/project-files/${conversationId}`, withCreds({ method: "DELETE" })).then(j),

  getUsageSummary: (days) => fetch(`${BASE}/usage/summary?days=${days || 30}`, withCreds()).then(j),
  getUsageTimeline: (days) => fetch(`${BASE}/usage/timeline?days=${days || 14}`, withCreds()).then(j),
  getModelRates: () => fetch(`${BASE}/usage/rates`, withCreds()).then(j),
  setModelRate: (providerId, modelId, inputRatePerMillion, outputRatePerMillion) =>
    fetch(`${BASE}/usage/rates`, withCreds({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ providerId, modelId, inputRatePerMillion, outputRatePerMillion })
    })).then(j),
  deleteModelRate: (providerId, modelId) =>
    fetch(`${BASE}/usage/rates`, withCreds({
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ providerId, modelId })
    })).then(j),

  /**
   * Sends a chat completion request and returns the final result once the
   * server responds.
   *
   * Note: unlike the self-hosted version, this Vercel deployment does not
   * stream tokens incrementally — Vercel's standard Node serverless
   * functions buffer the full response rather than sending it progressively
   * the way a persistent Express server can. The onAttempt/onToken
   * parameters are kept in the function signature so callers don't need
   * restructuring, but neither fires here: the routing trace still displays
   * correctly because it's built from the final result's `attempts` array
   * once the response arrives, just not animated live as each step happens.
   */
  async chatStream(payload, _onAttempt, _onToken) {
    const res = await fetch(`${BASE}/chat`, withCreds({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }));
    if (res.status === 401) {
      const err = new Error("Your session has expired — please log in again.");
      err.status = 401;
      throw err;
    }
    return j(res);
  }
};
