/**
 * Lightweight timing helper.
 *
 * Runs `fn`, then logs its duration and outcome via the structured logger.
 * This is NOT OpenTelemetry — it is simple, correlated timing that appears in
 * the logs alongside the per-request id (see `logContext` in logger.ts), which
 * is the right-sized signal for a local-first single-user tool. High-value call
 * sites are background/IO operations: embedding generation, Google Calendar API
 * calls, etc.
 */

import { logger } from "./logger.ts";

function elapsedMs(start: number): number {
  return Math.round((performance.now() - start) * 100) / 100;
}

export async function withSpan<T>(
  name: string,
  fn: () => Promise<T>,
  context = "span",
  data?: Record<string, unknown>,
): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    logger.debug(`${name} ok`, context, {
      ...data,
      durationMs: elapsedMs(start),
    });
    return result;
  } catch (error) {
    logger.warn(`${name} failed`, context, {
      ...data,
      durationMs: elapsedMs(start),
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
