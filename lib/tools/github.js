import { resolveApiKey } from "../providerStore.js";

async function headers(userId) {
  const key = await resolveApiKey(userId, "github");
  return {
    Accept: "application/vnd.github+json",
    ...(key ? { Authorization: `Bearer ${key}` } : {})
  };
}

export async function githubSearchRepos(userId, query) {
  const res = await fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&per_page=8`, { headers: await headers(userId) });
  if (!res.ok) return { ok: false, error: `GitHub error ${res.status}` };
  const data = await res.json();
  return { ok: true, items: (data.items || []).map((r) => ({ name: r.full_name, url: r.html_url, description: r.description, stars: r.stargazers_count })) };
}

export async function githubGetFile(userId, owner, repo, path, ref = "HEAD") {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${ref}`, { headers: await headers(userId) });
  if (!res.ok) return { ok: false, error: `GitHub error ${res.status}` };
  const data = await res.json();
  if (data.encoding === "base64") {
    return { ok: true, content: Buffer.from(data.content, "base64").toString("utf8"), sha: data.sha };
  }
  return { ok: true, content: data.content, sha: data.sha };
}

export async function githubListIssues(userId, owner, repo) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues?per_page=10`, { headers: await headers(userId) });
  if (!res.ok) return { ok: false, error: `GitHub error ${res.status}` };
  const data = await res.json();
  return { ok: true, items: data.map((i) => ({ number: i.number, title: i.title, state: i.state, url: i.html_url })) };
}
