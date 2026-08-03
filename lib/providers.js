/**
 * FrostByte - Provider Registry
 * -------------------------------------------------
 * Central definition of every AI provider FrostByte knows how to talk to.
 * Every provider here follows (or is adapted to) the OpenAI-style
 * `/chat/completions` shape so the router can treat them uniformly.
 *
 * To add a brand-new provider from the UI, users don't need to touch this
 * file at all — "Custom Provider" entries created in Settings are stored in
 * the database and merged with this list at runtime (see providerStore.js).
 * This file only holds the well-known defaults we ship out of the box.
 */

export const BUILTIN_PROVIDERS = [
  {
    id: "anthropic",
    name: "Anthropic (Claude)",
    logo: "anthropic",
    authHeader: "x-api-key",
    authPrefix: "",
    extraHeaders: { "anthropic-version": "2023-06-01" },
    baseUrl: "https://api.anthropic.com/v1",
    chatPath: "/messages",
    style: "anthropic", // uses Messages API shape, not OpenAI shape
    keyEnv: "ANTHROPIC_API_KEY",
    docsUrl: "https://docs.claude.com",
    models: [
      { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", tags: ["coding", "reasoning", "flagship"] },
      { id: "claude-opus-4-8", label: "Claude Opus 4.8", tags: ["coding", "reasoning", "flagship"] },
      { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", tags: ["fast", "cheap"] }
    ]
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    logo: "openrouter",
    authHeader: "Authorization",
    authPrefix: "Bearer ",
    extraHeaders: { "HTTP-Referer": "https://frostbyte.local", "X-Title": "FrostByte" },
    baseUrl: "https://openrouter.ai/api/v1",
    chatPath: "/chat/completions",
    style: "openai",
    keyEnv: "OPENROUTER_API_KEY",
    docsUrl: "https://openrouter.ai/docs",
    // OpenRouter proxies hundreds of models; we seed a strong coding subset.
    // Any model slug from openrouter.ai/models can be added as a custom model.
    models: [
      { id: "anthropic/claude-sonnet-4.6", label: "Claude Sonnet 4.6 (via OR)", tags: ["coding"] },
      { id: "openai/gpt-5.2-codex", label: "GPT-5.2 Codex (via OR)", tags: ["coding"] },
      { id: "deepseek/deepseek-v4", label: "DeepSeek V4 (via OR)", tags: ["coding", "cheap"] },
      { id: "qwen/qwen3-coder-plus", label: "Qwen3 Coder Plus (via OR)", tags: ["coding"] },
      { id: "x-ai/grok-code-fast-1", label: "Grok Code Fast (via OR)", tags: ["coding", "fast"] },
      { id: "meta-llama/llama-4-maverick", label: "Llama 4 Maverick (via OR)", tags: ["general"] }
    ]
  },
  {
    id: "opencode-zen",
    name: "Opencode Zen",
    logo: "opencode",
    authHeader: "Authorization",
    authPrefix: "Bearer ",
    baseUrl: "https://opencode.ai/zen/v1",
    chatPath: "/chat/completions",
    style: "openai",
    keyEnv: "OPENCODE_ZEN_API_KEY",
    docsUrl: "https://opencode.ai/docs/zen",
    models: [
      { id: "zen-coder-large", label: "Zen Coder Large", tags: ["coding"] },
      { id: "zen-coder-fast", label: "Zen Coder Fast", tags: ["coding", "fast"] }
    ]
  },
  {
    id: "grok",
    name: "xAI (Grok)",
    logo: "xai",
    authHeader: "Authorization",
    authPrefix: "Bearer ",
    baseUrl: "https://api.x.ai/v1",
    chatPath: "/chat/completions",
    style: "openai",
    keyEnv: "XAI_API_KEY",
    docsUrl: "https://docs.x.ai",
    models: [
      { id: "grok-code-fast-1", label: "Grok Code Fast 1", tags: ["coding", "fast"] },
      { id: "grok-4", label: "Grok 4", tags: ["reasoning", "coding"] }
    ]
  },
  {
    id: "zai",
    name: "Z.ai (GLM)",
    logo: "zai",
    authHeader: "Authorization",
    authPrefix: "Bearer ",
    baseUrl: "https://api.z.ai/api/paas/v4",
    chatPath: "/chat/completions",
    style: "openai",
    keyEnv: "ZAI_API_KEY",
    docsUrl: "https://docs.z.ai",
    models: [
      { id: "glm-5.2", label: "GLM-5.2", tags: ["coding", "reasoning", "1M-ctx"] },
      { id: "glm-5.1", label: "GLM-5.1", tags: ["coding"] },
      { id: "glm-4.7", label: "GLM-4.7 (cheap)", tags: ["coding", "cheap"] }
    ]
  },
  {
    id: "cerebras",
    name: "Cerebras",
    logo: "cerebras",
    authHeader: "Authorization",
    authPrefix: "Bearer ",
    baseUrl: "https://api.cerebras.ai/v1",
    chatPath: "/chat/completions",
    style: "openai",
    keyEnv: "CEREBRAS_API_KEY",
    docsUrl: "https://inference-docs.cerebras.ai",
    models: [
      { id: "llama-3.3-70b", label: "Llama 3.3 70B (ultra-fast)", tags: ["fast"] },
      { id: "qwen-3-coder-480b", label: "Qwen3 Coder 480B", tags: ["coding", "fast"] },
      { id: "zai-glm-4.7", label: "GLM-4.7 (on Cerebras)", tags: ["coding", "fast"] }
    ]
  },
  {
    id: "huggingface",
    name: "Hugging Face",
    logo: "huggingface",
    authHeader: "Authorization",
    authPrefix: "Bearer ",
    baseUrl: "https://router.huggingface.co/v1",
    chatPath: "/chat/completions",
    style: "openai",
    keyEnv: "HF_API_KEY",
    docsUrl: "https://huggingface.co/docs/inference-providers",
    unreliable: true, // per-model availability varies; surfaced in UI as "may be unreliable"
    models: [
      { id: "deepseek-ai/DeepSeek-V4", label: "DeepSeek V4 (HF)", tags: ["coding"] },
      { id: "Qwen/Qwen3-Coder-480B-A35B-Instruct", label: "Qwen3 Coder 480B (HF)", tags: ["coding"] }
    ]
  },
  {
    id: "nvidia",
    name: "NVIDIA NIM",
    logo: "nvidia",
    authHeader: "Authorization",
    authPrefix: "Bearer ",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    chatPath: "/chat/completions",
    style: "openai",
    keyEnv: "NVIDIA_API_KEY",
    docsUrl: "https://build.nvidia.com",
    optional: true, // user said they don't have a key yet; disabled by default until key added
    models: [
      { id: "nvidia/llama-3.1-nemotron-70b-instruct", label: "Nemotron 70B", tags: ["reasoning"] },
      { id: "qwen/qwen3-coder-480b-a35b-instruct", label: "Qwen3 Coder 480B (NIM)", tags: ["coding"] }
    ]
  },
  {
    id: "cloudflare",
    name: "Cloudflare Workers AI",
    logo: "cloudflare",
    authHeader: "Authorization",
    authPrefix: "Bearer ",
    // Cloudflare's base URL is account-specific; {account_id} is substituted at call time
    baseUrl: "https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1",
    chatPath: "/chat/completions",
    style: "openai",
    keyEnv: "CLOUDFLARE_API_KEY",
    needsAccountId: true,
    docsUrl: "https://developers.cloudflare.com/workers-ai",
    models: [
      { id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", label: "Llama 3.3 70B (CF fast)", tags: ["fast"] },
      { id: "@cf/qwen/qwen2.5-coder-32b-instruct", label: "Qwen2.5 Coder 32B (CF)", tags: ["coding"] }
    ]
  },
  {
    id: "aisure",
    name: "AIsure",
    logo: "generic",
    authHeader: "Authorization",
    authPrefix: "Bearer ",
    baseUrl: "https://aisure.uk/api/v1",
    chatPath: "/chat/completions",
    style: "openai",
    keyEnv: "AISURE_API_KEY",
    docsUrl: "https://aisure.uk",
    unverified: true, // we could not verify this provider's API publicly; user-editable in Settings
    models: [
      { id: "default", label: "Default model (edit in Settings)", tags: [] }
    ]
  }
];

// Tavily is a search tool, not a chat model — registered separately as a "tool provider"
export const TOOL_PROVIDERS = [
  {
    id: "tavily",
    name: "Tavily Search",
    kind: "web_search",
    baseUrl: "https://api.tavily.com",
    keyEnv: "TAVILY_API_KEY",
    docsUrl: "https://docs.tavily.com"
  },
  {
    id: "github",
    name: "GitHub",
    kind: "repo_access",
    baseUrl: "https://api.github.com",
    keyEnv: "GITHUB_API_KEY",
    docsUrl: "https://docs.github.com/rest"
  }
];

/** The "Fusion Model" combines outputs of several strong models into one answer. */
export const FUSION_MODEL = {
  id: "frostbyte-fusion",
  name: "FrostByte Fusion",
  description:
    "Sends your prompt to several top coding models in parallel, then uses a synthesizer pass to merge their answers into one best-of-all response.",
  defaultMembers: ["anthropic:claude-sonnet-4-6", "zai:glm-5.2", "grok:grok-code-fast-1", "cerebras:qwen-3-coder-480b"]
};
