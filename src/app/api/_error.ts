import type { NextRequest } from "next/server";

/**
 * Centralised structured error logger for API routes.
 *
 * Emits a single JSON line to console.error so that log aggregators
 * can parse it without regex. Safe to call with any thrown value.
 */
export function logError(endpoint: string, error: unknown, req?: NextRequest): void {
  const entry: Record<string, unknown> = {
    level: "error",
    endpoint,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    method: req?.method,
    url: req?.url,
    timestamp: new Date().toISOString(),
  };

  // Attach useful request headers when available.
  const ip = req?.headers.get("CF-Connecting-IP");
  if (ip) entry.ip = ip;
  const ua = req?.headers.get("user-agent");
  if (ua) entry.userAgent = ua;

  console.error(JSON.stringify(entry));
}
