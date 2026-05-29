/**
 * Request correlation + timing middleware.
 *
 * Generates a request id (or propagates an inbound X-Request-ID), runs the rest
 * of the pipeline inside an AsyncLocalStorage scope (see `logContext`) so every
 * logger call during the request — including in route handlers and
 * synchronously-started background work — is tagged with the same requestId
 * without changing any call sites, and logs request start/end with method,
 * path, status, and duration. Sets X-Request-ID on the response.
 */

import type { MiddlewareHandler } from "hono";
import { logContext, logger } from "../../shared/logger.ts";

export const observability: MiddlewareHandler = async (c, next) => {
  const requestId = c.req.header("X-Request-ID") ?? crypto.randomUUID();
  const start = performance.now();
  const method = c.req.method;
  const path = c.req.path;

  await logContext.run({ requestId }, async () => {
    logger.debug("request.start", "http", { method, path });
    try {
      await next();
    } finally {
      c.header("X-Request-ID", requestId);
      logger.info("request.end", "http", {
        method,
        path,
        status: c.res.status,
        durationMs: Math.round((performance.now() - start) * 100) / 100,
      });
    }
  });
};
