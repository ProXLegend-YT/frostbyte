import { resolveApiKey } from "../providerStore.js";

export async function tavilySearch(userId, query, { maxResults = 5, searchDepth = "basic" } = {}) {
  const apiKey = await resolveApiKey(userId, "tavily");
  if (!apiKey) return { ok: false, error: "No Tavily API key configured" };

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey, query, max_results: maxResults, search_depth: searchDepth })
  });

  if (!res.ok) {
    return { ok: false, error: `Tavily error ${res.status}` };
  }
  const data = await res.json();
  return {
    ok: true,
    results: (data.results || []).map((r) => ({ title: r.title, url: r.url, content: r.content, score: r.score })),
    answer: data.answer || null
  };
}
