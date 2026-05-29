/**
 * Logger for task-cli
 *
 * Logs to ~/.task-cli/logs/ with daily rotation. Records are structured: the
 * file sink writes one JSON object per line by default (machine-parseable), or
 * human-readable lines when TASK_CLI_LOG_FORMAT=pretty. A per-request
 * correlation id (see `logContext`) is injected automatically when present, so
 * background log calls during an HTTP request are correlated without changing
 * call sites.
 *
 * Configuration:
 *   TASK_CLI_LOG_LEVEL    debug|info|warn|error  (or config file)
 *   TASK_CLI_LOG_FORMAT   json|pretty            (or config file; default json)
 *   TASK_CLI_LOG_CONSOLE  1 = also mirror pretty logs to stderr (dev only)
 *   TASK_CLI_LOG_DISABLED 1 = disable all logging (used in tests)
 */

import { join } from "@std/path";
import { ensureDir } from "@std/fs";
import { AsyncLocalStorage } from "node:async_hooks";
import { bold, cyan, gray, red, yellow } from "@std/fmt/colors";
import {
  type Config,
  getConfig,
  getConfigSync,
  type LogFormat,
  type LogLevel,
} from "./config.ts";

const LOG_DIR = join(Deno.env.get("HOME") || ".", ".task-cli", "logs");

// Check if logging is disabled (useful for tests)
const isLoggingDisabled = (): boolean =>
  Deno.env.get("TASK_CLI_LOG_DISABLED") === "1";

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Per-request context (request / correlation id), propagated across awaits via
 * AsyncLocalStorage. Set by the server's observability middleware so that
 * background log calls made during a request are correlated automatically,
 * without changing any logger call sites.
 */
export const logContext = new AsyncLocalStorage<{ requestId?: string }>();

/** JSON replacer that renders BigInt (e.g. libsql row counts) as strings. */
function jsonReplacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}

function renderJson(record: Record<string, unknown>): string {
  return JSON.stringify(record, jsonReplacer) + "\n";
}

const LEVEL_COLOR: Record<LogLevel, (s: string) => string> = {
  debug: gray,
  info: cyan,
  warn: yellow,
  error: red,
};

/** Render a record as a human-readable line (optionally ANSI-colored). */
function renderPretty(record: Record<string, unknown>, color: boolean): string {
  const { ts, level, context, msg, ...rest } = record as {
    ts: string;
    level: LogLevel;
    context?: string;
    msg: string;
    [key: string]: unknown;
  };
  const levelStr = level.toUpperCase().padEnd(5);
  const lvl = color ? bold(LEVEL_COLOR[level](levelStr)) : levelStr;
  const ctxRaw = context ? `[${context}] ` : "";
  const ctx = color && ctxRaw ? gray(ctxRaw) : ctxRaw;
  const extra = Object.entries(rest)
    .map(([k, v]) =>
      `${k}=${typeof v === "string" ? v : JSON.stringify(v, jsonReplacer)}`
    )
    .join(" ");
  const extraStr = extra ? ` ${color ? gray(extra) : extra}` : "";
  const time = color ? gray(ts) : ts;
  return `${time} ${lvl} ${ctx}${msg}${extraStr}\n`;
}

function consoleMirrorEnabled(): boolean {
  if (isLoggingDisabled()) return false;
  if (Deno.env.get("TASK_CLI_LOG_CONSOLE") !== "1") return false;
  try {
    return Deno.stderr.isTerminal();
  } catch {
    return false;
  }
}

class Logger {
  private currentDate: string | null = null;
  private logFile: Deno.FsFile | null = null;
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private config: Config | null = null;
  private encoder = new TextEncoder();

  /**
   * Initialize the logger (lazy, async).
   * Creates the log directory and opens the log file.
   */
  private async init(): Promise<void> {
    if (this.initialized || isLoggingDisabled()) {
      this.initialized = true;
      return;
    }

    // Prevent concurrent initialization
    if (this.initPromise) {
      await this.initPromise;
      return;
    }

    this.initPromise = (async () => {
      try {
        await ensureDir(LOG_DIR);
        this.config = await getConfig();
        this.initialized = true;
      } catch {
        // Log directory creation failed - disable logging
        this.initialized = true;
      }
    })();

    await this.initPromise;
  }

  /**
   * Get today's date string for log file naming.
   */
  private getDateString(): string {
    return Temporal.Now.plainDateISO().toString(); // YYYY-MM-DD
  }

  /**
   * Get or rotate log file based on date.
   */
  private async getLogFile(): Promise<Deno.FsFile | null> {
    const today = this.getDateString();

    // Rotate if date changed
    if (this.currentDate !== today) {
      if (this.logFile) {
        try {
          this.logFile.close();
        } catch {
          // Ignore close errors
        }
        this.logFile = null;
      }

      try {
        const logPath = join(LOG_DIR, `task-cli-${today}.log`);
        this.logFile = await Deno.open(logPath, {
          create: true,
          append: true,
          write: true,
        });
        this.currentDate = today;
      } catch {
        // File open failed - disable logging
        return null;
      }
    }

    return this.logFile;
  }

  /**
   * Check if a log level should be logged based on current config.
   */
  private shouldLog(level: LogLevel): boolean {
    if (isLoggingDisabled()) return false;
    const configLevel = this.config?.logLevel || getConfigSync().logLevel;
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[configLevel];
  }

  /**
   * Resolve the file-sink record format (env > config file > default json).
   */
  private resolveFormat(): LogFormat {
    const env = Deno.env.get("TASK_CLI_LOG_FORMAT");
    if (env === "json" || env === "pretty") return env;
    return this.config?.logFormat ?? getConfigSync().logFormat ?? "json";
  }

  /**
   * Build a structured record and write it to the file sink (and, when
   * enabled, mirror a pretty line to stderr for development).
   */
  private async write(
    level: LogLevel,
    message: string,
    context?: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    // Skip logging if disabled via environment variable
    if (isLoggingDisabled()) {
      return;
    }

    await this.init();

    if (!this.shouldLog(level)) {
      return;
    }

    const requestId = logContext.getStore()?.requestId;
    const record: Record<string, unknown> = {
      ts: Temporal.Now.instant().toString(),
      level,
      ...(context ? { context } : {}),
      msg: message,
      ...(requestId ? { requestId } : {}),
      ...(data ?? {}),
    };

    const fileLine = this.resolveFormat() === "pretty"
      ? renderPretty(record, false)
      : renderJson(record);

    const file = await this.getLogFile();
    if (file) {
      try {
        await file.write(this.encoder.encode(fileLine));
      } catch {
        // Write failed - ignore
      }
    }

    // Optional human-readable console mirror for dev (stderr, never stdout).
    if (consoleMirrorEnabled()) {
      try {
        console.error(renderPretty(record, true).trimEnd());
      } catch {
        // Ignore console errors
      }
    }
  }

  /**
   * Log a debug message.
   */
  debug(
    message: string,
    context?: string,
    data?: Record<string, unknown>,
  ): void {
    this.write("debug", message, context, data);
  }

  /**
   * Log an info message.
   */
  info(
    message: string,
    context?: string,
    data?: Record<string, unknown>,
  ): void {
    this.write("info", message, context, data);
  }

  /**
   * Log a warning message.
   */
  warn(
    message: string,
    context?: string,
    data?: Record<string, unknown>,
  ): void {
    this.write("warn", message, context, data);
  }

  /**
   * Log an error message.
   */
  error(
    message: string,
    context?: string,
    data?: Record<string, unknown>,
  ): void {
    this.write("error", message, context, data);
  }

  /**
   * Close the log file (for cleanup).
   */
  close(): void {
    if (this.logFile) {
      try {
        this.logFile.close();
      } catch {
        // Ignore close errors
      }
      this.logFile = null;
      this.currentDate = null;
    }
  }
}

// Singleton instance
export const logger = new Logger();

export { LOG_DIR };
