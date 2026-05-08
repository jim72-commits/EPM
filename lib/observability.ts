/**
 * Thin observability shim. Structured logs to stdout (picked up by Vercel
 * Logs) keep forensic data available without a vendor dependency.
 *
 * To upgrade to Sentry later: `npm install @sentry/nextjs`, run `npx @sentry/wizard`,
 * then call Sentry's `captureException` from `captureException` below and
 * `Sentry.captureMessage` from `logEvent`.
 */

type JsonSafe = string | number | boolean | null | undefined | JsonSafe[] | { [k: string]: JsonSafe };

function serializeError(err: unknown): JsonSafe {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack ?? null,
      ...(err.cause ? { cause: serializeError(err.cause) } : {}),
    };
  }
  if (typeof err === "object" && err !== null) {
    try {
      return JSON.parse(JSON.stringify(err)) as JsonSafe;
    } catch {
      return String(err);
    }
  }
  return String(err);
}

export function logEvent(name: string, fields?: Record<string, JsonSafe>): void {
  const payload: Record<string, JsonSafe> = {
    level: "info",
    event: name,
    ts: new Date().toISOString(),
    ...(fields ?? {}),
  };
  console.log(JSON.stringify(payload));
}

export function captureException(
  err: unknown,
  context?: Record<string, JsonSafe>,
): void {
  const payload: Record<string, JsonSafe> = {
    level: "error",
    event: "exception",
    ts: new Date().toISOString(),
    error: serializeError(err),
    ...(context ?? {}),
  };
  console.error(JSON.stringify(payload));
}
