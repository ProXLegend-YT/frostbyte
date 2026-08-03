# FrostByte

A multi-model AI coding agent platform. Connect as many AI providers as you have keys for, chat through a single dark interface, and let FrostByte automatically fall back to the next model if one fails — or fuse several models' answers into one. Deploys entirely on **GitHub + Vercel**, no separate server to manage.

## What's included

- **Smart fallback routing**: define an ordered chain of models. If model 1 errors out, times out, or returns nothing, FrostByte automatically retries with model 2, then model 3, and so on. You see the whole chain in the routing trace under each answer.
- **Fusion mode**: call several strong coding models in parallel and merge their answers into one synthesized response.
- **Add literally any AI API**: any base URL, any auth style, any request/response shape — not just OpenAI-compatible ones. Three modes: OpenAI-compatible, Anthropic Messages API, or fully custom (your own JSON request template + a response-field path). Multiple models per provider, arbitrary extra headers, and a live "test connection" check.
- **Pre-wired providers**: Anthropic (Claude), OpenRouter, Opencode Zen, xAI (Grok), Z.ai (GLM), Cerebras, Hugging Face, NVIDIA NIM, Cloudflare Workers AI, and a generic slot for anything else.
- **Project files — real multi-file coding context**: attach a folder, a `.zip`, or a handful of files to any conversation, and the model sees your actual code, referencing files by path and grounding suggestions in what's really there.
- **Code execution**: any Python/JS/TypeScript/Bash/Go/Ruby code block gets a **Run** button, executed via Piston's free public execution API.
- **125-skill library**: a categorized catalog of coding skills (code gen, review, debugging, testing, DevOps, docs, language specialists, data/ML, research, GitHub, planning) — every skill maps to a real behavioral instruction, not just a label. Toggle any on/off, or add your own.
- **Tools**: Tavily web search (auto-injects live search results when toggled on) and GitHub (repo search, file fetch, issue listing).
- **Multi-user accounts**: password-protected login, each person gets their own API keys, conversations, and usage history; admins can invite others and manage the shared skill library.
- **Session management**: see every device you're logged in on and revoke any of them.
- **Usage & cost tracking**: per-user call counts, token usage, and optional cost estimates (using rates you enter yourself).
- **Edit or regenerate any message** — genuinely truncates and redoes that part of the conversation.
- **Export any conversation** as clean Markdown or structured JSON.
- **Search across all your conversation history**, plus keyboard shortcuts (Cmd/Ctrl+K new chat, Cmd/Ctrl+/ search).
- **Fully responsive dark UI**, works on mobile, tablet, and desktop.

## Architecture

FrostByte is a single Vercel project with two parts:

- **frontend/** — a Vite + React app, built to static files and served by Vercel's CDN.
- **api/** — one JavaScript file per endpoint, each deployed as its own Vercel serverless function (Vercel's standard convention — no Express server, no single long-running process).

Data lives in Vercel Postgres — a hosted, always-on database — since serverless functions have no persistent local disk between invocations.

### What's different from a self-hosted deployment

Two real trade-offs come with serverless, worth knowing upfront:

- **No token-by-token streaming.** Vercel's standard Node serverless functions buffer the full response before sending it, rather than streaming it progressively the way a persistent server can. Answers arrive complete rather than typed out live. Everything else — fallback, fusion, routing info, project file context — behaves identically.
- **Code execution runs on Piston**, a free public execution service, instead of a local Docker sandbox (Vercel functions have no Docker daemon). It's a shared service with light rate limits — reliable for normal use, but not a guaranteed SLA.

## Setup

### 1. Push this to GitHub

```
git init
git add .
git commit -m "Initial commit"
```

Create an empty repo on github.com (no README/gitignore — you already have those), then:

```
git remote add origin https://github.com/YOUR_USERNAME/frostbyte.git
git branch -M main
git push -u origin main
```

### 2. Import into Vercel

Go to vercel.com -> Add New -> Project -> import your frostbyte repo. Vercel detects vercel.json at the root and uses it automatically.

### 3. Add Vercel Postgres

In your Vercel project: Storage tab -> Create Database -> Postgres. Vercel automatically injects the connection environment variables into your project — @vercel/postgres picks these up with zero extra config.

### 4. Set environment variables

In Settings -> Environment Variables, add:

- `ENCRYPTION_SECRET` (required) — a long random string, used to encrypt stored API keys at rest. Generate one with `openssl rand -hex 32`.
- `NODE_ENV` (required) — set to `production`.

You do not need to set any AI provider keys here — add those later from inside the app (Settings -> Models & API keys), where they're encrypted per-user in the database.

### 5. Deploy

Trigger a deploy (Vercel does this automatically on push). Once live, open the URL — the first person to visit creates the admin account.

### 6. (Optional) Upgrade for longer requests

vercel.json sets a 60-second max duration for API functions, since a multi-step fallback chain can take longer than a single call. This requires Vercel's Pro plan — the free Hobby plan caps function duration at 10 seconds regardless of this setting. If you're on Hobby and hit timeouts, either upgrade, or keep fallback chains short (1-2 models).

## Accounts & authentication

The first person to open the app creates the admin account — everyone after that needs a username/password. Each user has their own API keys, conversations, and usage history; the skill library is shared instance-wide but only admins can toggle or add skills. Admins can invite more accounts from Settings -> Team. Passwords are hashed with scrypt + a random per-user salt; sessions are server-side tokens (30-day expiry), so revoking one is just deleting its row, which you can do from Settings -> "Where you're logged in."

## Adding your own AI model — any API key, any model, any base URL

Go to Models & API keys -> Custom providers -> Add custom provider. Three request/response styles are supported:

- OpenAI-compatible — the default, covers most providers.
- Anthropic Messages API — for anything that clones Anthropic's request shape.
- Fully custom — write the exact JSON request body as a template with {{messages}}, {{model}}, {{temperature}}, {{max_tokens}} placeholders, and tell FrostByte where the answer lives in the response using a path like choices[0].message.content. This is what makes "add literally any API" true — if it's a JSON API that takes a prompt and returns text, it works.

Every custom provider supports any number of models, arbitrary extra headers, and a live "Test connection" button that fires a real request through your exact config before you rely on it.

## Project files — real multi-file coding context

Attach a folder, .zip, or a handful of files to any conversation from the "Project files" bar above the chat. The model sees your actual code and references files by path. Build artifacts, node_modules, .git, binaries, and lockfiles are filtered out automatically. Limits: 512KB per file, 4MB per upload batch, 200 files max — sized for a focused set of source files, not an entire monorepo. Attached files are re-sent as context on every message in that conversation, which uses more input tokens per message than a conversation without files — worth knowing if you're watching cost closely.

## How the Tools & Skills toggles actually work

Each of the 125 built-in skills maps to a concrete instruction fragment (see api/lib/skillInstructions.js) — e.g. "when reviewing for security, explicitly check for injection risks." Whichever skills are enabled get concatenated into the system prompt on every request, so toggling a skill genuinely changes model behavior, not just a cosmetic switch.

## Editing and regenerating messages

Hover any of your own messages to Edit it — this deletes that message and everything the model said after it, then resends your edited text as a fresh turn. Hover any assistant response to Regenerate it — same mechanism, keeping your original question. Both are real deletions in the database, so exports and search reflect the edited version, not a stale duplicate.

## Exporting and searching conversations

Click Export above any conversation for Markdown or JSON. The sidebar search box (or Cmd/Ctrl+/) searches both conversation titles and message content across your history.

## Local development

```
cd frontend
npm install
npm run dev
```

For local API development, use the Vercel CLI (`npm i -g vercel`, then `vercel dev` from the project root) — it runs the api/ functions locally against your real Vercel Postgres database.

## Project structure

```
frostbyte/
  vercel.json                   build config, function settings
  package.json                  dependencies for api/ functions
  api/
    lib/
      db.js                     Postgres schema + connection + skill seeding
      auth.js                   password hashing, sessions, cookie helpers
      crypto.js                 API key encryption at rest
      callModel.js              normalizes every provider's API shape
      fallbackEngine.js         fallback + fusion routing logic
      providerStore.js          provider + API key persistence (per-user)
      projectFiles.js           zip extraction + multi-file context
      usageLog.js                usage/cost logging + aggregation
      sandbox.js                code execution via Piston
      multipart.js              busboy-based file upload parsing
      jsonPath.js               JSON-path getter for custom providers
      skillInstructions.js      the 125 real skill behaviors
      toolCatalog.js            the skill catalog (server-side mirror)
      providers.js              built-in provider registry
      exportConversation.js     markdown/JSON conversation export
      validateProvider.js       custom provider input validation
      handler.js                shared error-handling wrapper
      tools/                    Tavily, GitHub wrappers
    auth/                       login, setup, sessions, users
    providers/                  provider CRUD, key management, test
    conversations/               list, search, messages, export, truncate
    tools/                      skill registry, Tavily, GitHub
    usage/                      summary, timeline, rates
    project-files/               upload, list, toggle, delete
    execute/                    code execution via Piston
    chains/                     saved fallback-chain presets
    chat.js                     the core chat endpoint
  frontend/
    src/
      components/                Chat, Sidebar, Settings, Tools, Usage, Auth, etc.
      lib/                       API client, tool catalog, keyboard shortcuts
      App.jsx
```
