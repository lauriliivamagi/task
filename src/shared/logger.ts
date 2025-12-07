/**
 * Logger for task-cli
 *
 * Logs to ~/.task-cli/logs/ with daily rotation.
 * Log level is configurable via TASK_CLI_LOG_LEVEL or config file.
 */

import { join } from "@std/path";
import { ensureDir } from "@std/fs";
import {
  type Config,
  getConfig,
  getConfigSync,
  type LogLevel,
} from "./config.ts";

const LOG_DIR = join(Deno.env.get("HOME") || ".", ".task-cli", "logs");

// Check if logging is disabled (useful for tests)
const isLoggingDisabled = () => Deno.env.get("TASK_CLI_LOG_DISABLED") === "1";

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private currentDate: string | null = null;
  private logFile: Deno.FsFile | null = null;
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private config: Config | null = null;

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
    const now = new Date();
    return now.toISOString().split("T")[0]; // YYYY-MM-DD
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
   * Format and write a log entry.
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

    const file = await this.getLogFile();
    if (!file) return;

    const timestamp = new Date().toISOString();
    const levelStr = level.toUpperCase().padEnd(5);
    const contextStr = context ? `[${context}] ` : "";
    const dataStr = data ? ` ${JSON.stringify(data)}` : "";

    const line =
      `[${timestamp}] [${levelStr}] ${contextStr}${message}${dataStr}\n`;

    try {
      const encoder = new TextEncoder();
      await file.write(encoder.encode(line));
    } catch {
      // Write failed - ignore
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
