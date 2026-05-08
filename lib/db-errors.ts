/**
 * Translate Supabase / Postgres error responses into user-facing messages.
 *
 * Without this we either:
 *   - leak raw `duplicate key value violates unique constraint
 *     "jobs_slug_key"` strings into the URL bar, which look broken and tell
 *     a determined attacker exactly which constraint failed, or
 *   - swallow the error entirely with a generic "something went wrong",
 *     which makes legitimate user fixes impossible.
 *
 * Map known codes to short, actionable copy. Anything we don't recognize
 * falls back to a generic message — never the raw `message`.
 *
 * This module is server-only because it's only ever consumed by server
 * actions; importing it from a client module is harmless but pointless.
 */

import "server-only";

export type DbErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
} | null;

type Context = {
  /** The slug the user tried to save, used in the message when relevant. */
  slug?: string;
  /** Domain of the action: "job", "organization", "profile", etc. */
  context?: "job" | "organization" | "profile" | "application" | "report";
};

/**
 * Detect "unique constraint violated, on the slug column" without depending
 * on Postgres returning a specific constraint name. We look for both the
 * `23505` SQLSTATE code and a `slug` mention so that we don't accidentally
 * reframe an unrelated unique violation (e.g. a future composite unique).
 */
function isSlugUniqueViolation(err: DbErrorLike): boolean {
  if (!err) return false;
  if (err.code !== "23505") return false;
  const msg = `${err.message ?? ""} ${err.details ?? ""}`.toLowerCase();
  return msg.includes("slug");
}

export function friendlyDbError(err: DbErrorLike, ctx: Context = {}): string {
  if (!err) return "Save failed. Please try again.";

  if (isSlugUniqueViolation(err)) {
    if (ctx.slug) {
      return `That URL slug ("${ctx.slug}") is already taken. Pick a different one.`;
    }
    return "That URL slug is already taken. Pick a different one.";
  }

  switch (err.code) {
    case "23505":
      // Unique violation on a column we didn't recognize.
      return "That value conflicts with an existing record. Try a different value.";
    case "23503":
      // Foreign key violation — a referenced row went missing or was wrong.
      return "Something this record points to is missing. Refresh and try again.";
    case "23514":
      // Check constraint — typically a bad enum or out-of-range value.
      return "One of the values isn't allowed here. Double-check the highlighted field.";
    case "42501":
      // Insufficient privilege — RLS rejected the action.
      return "You don't have permission to do that.";
    case "PGRST116":
      // Postgrest single() with no rows.
      return "We couldn't find that record. It may have been removed.";
    default:
      return "Save failed. Please try again or contact support if it keeps happening.";
  }
}

/**
 * Helper for cases where you want to log the raw error but still surface a
 * user-friendly version. Keep both in your action's exception path: the
 * raw error in your structured logger, the friendly version in the UI.
 */
export function unwrapDbError(err: unknown): DbErrorLike {
  if (!err || typeof err !== "object") return null;
  const o = err as Record<string, unknown>;
  return {
    code: typeof o.code === "string" ? o.code : null,
    message: typeof o.message === "string" ? o.message : null,
    details: typeof o.details === "string" ? o.details : null,
  };
}
