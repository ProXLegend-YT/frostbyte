/**
 * Tiny JSON-path getter supporting the subset actually needed for extracting
 * text/usage fields from arbitrary API responses: dot-separated keys and
 * numeric array indices in brackets, e.g. "choices.0.message.content" or
 * "output[0].content[0].text". No wildcards, no filters — deliberately
 * minimal, since this only needs to reach into a known response shape a
 * person has already looked at, not query arbitrary JSON generically.
 *
 * Returns undefined (not throwing) for any path segment that doesn't exist,
 * so a wrong/mistyped path degrades to "field missing" rather than crashing
 * the request.
 */
export function getByPath(obj, path) {
  if (!path || typeof path !== "string") return undefined;

  // Normalize "a[0].b" into "a.0.b" so the whole path can be split on "."
  const normalized = path.replace(/\[(\d+)\]/g, ".$1");
  const segments = normalized.split(".").filter(Boolean);

  let current = obj;
  for (const segment of segments) {
    if (current == null) return undefined;
    current = current[segment];
  }
  return current;
}

/** Validates that a path string only contains the characters getByPath understands, for early feedback in the UI. */
export function isValidPathSyntax(path) {
  return /^[a-zA-Z0-9_.\[\]]+$/.test(path);
}
