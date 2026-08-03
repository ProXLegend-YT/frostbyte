import { isValidPathSyntax } from "./jsonPath.js";

/** Shared validation for both create and update custom-provider endpoints. */
export function validateCustomProviderInput(body) {
  const { baseUrl, style, responseTextPath, responseInputTokensPath, responseOutputTokensPath, requestTemplate } = body;

  if (baseUrl) {
    try {
      const parsed = new URL(baseUrl.replace("{account_id}", "placeholder"));
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return "Base URL must start with http:// or https://";
      }
    } catch {
      return "Base URL doesn't look like a valid URL";
    }
  }

  if (style === "custom") {
    if (responseTextPath && !isValidPathSyntax(responseTextPath)) {
      return "Response text path can only contain letters, numbers, dots, underscores, and [n] array indices (e.g. choices[0].message.content)";
    }
    if (responseInputTokensPath && !isValidPathSyntax(responseInputTokensPath)) {
      return "Input tokens path has invalid syntax";
    }
    if (responseOutputTokensPath && !isValidPathSyntax(responseOutputTokensPath)) {
      return "Output tokens path has invalid syntax";
    }
    if (requestTemplate && typeof requestTemplate !== "object") {
      return "Request template must be a JSON object";
    }
  }

  return null;
}
