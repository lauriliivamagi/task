import { Hono } from "hono";
import { cors } from "hono/cors";
import { tasksRoute } from "./routes/tasks/index.ts";
import { projectsRoute } from "./routes/projects.ts";
import { commentsRoute } from "./routes/comments.ts";
import { attachmentsRoute } from "./routes/attachments.ts";
import { statsRoute } from "./routes/stats.ts";
import { parseRoute } from "./routes/parse.ts";
import { tagsRoute, taskTagsRoute } from "./routes/tags.ts";
import { reportsRoute } from "./routes/reports.ts";
import { gcalRoute } from "./routes/gcal.ts";
import { initDb, migrateAllDatabases } from "../db/client.ts";
import { logger } from "../shared/logger.ts";
import { AssertionError } from "../shared/assert.ts";
import {
  scheduleAutoCommit,
  syncOnShutdown,
  syncOnStartup,
} from "../shared/sync.ts";

// Create Hono app
const app = new Hono();

// Middleware
app.use("*", cors());

// Auto-commit middleware: schedule git commit after successful write operations
app.use("*", async (c, next) => {
  await next();

  // Only trigger for successful mutating requests
  const method = c.req.method;
  const isMutating = method === "POST" || method === "PATCH" ||
    method === "PUT" || method === "DELETE";
  const isSuccess = c.res.status >= 200 && c.res.status < 300;

  if (isMutating && isSuccess) {
    // Fire and forget - schedule commit in background
    scheduleAutoCommit();
  }
});

// Error handling
app.onError((err, c) => {
  // Assertion failures indicate programmer errors - log full details.
  if (err instanceof AssertionError) {
    logger.error("Assertion failed in request handler", "server", {
      assertion: err.message,
      context: err.context,
      data: err.data,
      stack: err.stack,
    });
    return c.json(
      {
        error: "Internal error: assertion failed",
        assertion: err.message,
      },
      500,
    );
  }

  // Regular errors
  logger.error("Server error", "server", {
    error: err.message,
    stack: err.stack,
  });
  return c.json(
    {
      error: err.message || "Internal server error",
    },
    500,
  );
});

// Health check
app.get("/health", (c) => {
  return c.json({ status: "ok" });
});

// Mount routes
app.route("/tasks", tasksRoute);
app.route("/projects", projectsRoute);
app.route("/tags", tagsRoute);
app.route("/tasks/:taskId/comments", commentsRoute);
app.route("/tasks/:taskId/attachments", attachmentsRoute);
app.route("/tasks/:taskId/tags", taskTagsRoute);
app.route("/stats", statsRoute);
app.route("/parse", parseRoute);
app.route("/reports", reportsRoute);
app.route("/gcal", gcalRoute);

export type AppType = typeof app;

export interface ServerOptions {
  port?: number;
  hostname?: string;
  quiet?: boolean;
  /** Enable git sync on startup and shutdown. Defaults to false. */
  enableSync?: boolean;
}

export async function startServer(
  options: ServerOptions = {},
): Promise<Deno.HttpServer<Deno.NetAddr>> {
  const port = options.port ?? 3000;
  const hostname = options.hostname ?? "127.0.0.1";
  const enableSync = options.enableSync ?? false;

  // Auto-sync: pull latest changes before startup (if enabled)
  if (enableSync) {
    await syncOnStartup();
  }

  // Run migrations on ALL databases, then initialize active database connection
  await migrateAllDatabases();
  await initDb();

  const server = Deno.serve(
    { port, hostname, onListen: options.quiet ? () => {} : undefined },
    app.fetch,
  );

  const addr = server.addr as Deno.NetAddr;
  logger.info(
    `Server started on http://${addr.hostname}:${addr.port}`,
    "server",
  );

  if (!options.quiet) {
    console.log(`Server listening on http://${addr.hostname}:${addr.port}`);
  }

  // Register shutdown handler for auto-sync
  registerShutdownHandler(server, enableSync);

  return server;
}

/**
 * Register shutdown handler to sync on server stop.
 * Handles SIGINT (Ctrl+C) and SIGTERM signals.
 */
function registerShutdownHandler(
  server: Deno.HttpServer<Deno.NetAddr>,
  enableSync: boolean,
): void {
  const shutdown = async () => {
    logger.info("Server shutting down...", "server");

    // Auto-sync: commit and push changes before shutdown (if enabled)
    if (enableSync) {
      await syncOnShutdown();
    }

    // Gracefully close the server
    await server.shutdown();

    Deno.exit(0);
  };

  // Handle graceful shutdown signals
  Deno.addSignalListener("SIGINT", shutdown);
  Deno.addSignalListener("SIGTERM", shutdown);
}

export { app };
