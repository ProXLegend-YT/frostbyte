import { ensureSchema } from "./db.js";

/**
 * Wraps a Vercel serverless function handler with consistent error handling:
 * catches thrown errors (including the {statusCode} errors requireAuth
 * throws) and turns them into a proper JSON error response, and ensures the
 * database schema exists before the handler runs (cheap no-op after the
 * first cold-start call, see ensureSchema's internal guard).
 *
 * This replaces the Express error-handling middleware pattern the
 * self-hosted version used, adapted for the "one function per route" model
 * Vercel expects instead of one long-running app with mounted routers.
 */
export function withHandler(fn) {
  return async (req, res) => {
    try {
      await ensureSchema();
      await fn(req, res);
    } catch (err) {
      const status = err.statusCode || 500;
      if (!res.headersSent) {
        res.status(status).json({ error: err.message || "Internal server error" });
      }
    }
  };
}
