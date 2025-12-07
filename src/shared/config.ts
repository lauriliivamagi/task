/**
 * Configuration loader for task-cli
 *
 * Loads settings from ~/.task-cli/config.json with environment variable overrides.
 */

import { join } from "@std/path";
import { ensureDir } from "@std/fs";
import {
  type KeybindingsConfig,
  KeybindingsConfig as KeybindingsConfigSchema,
} from "./keybindings.ts";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface WorkConfig {
  repos_dir: string;
  default_template: string;
  ide_command: string;
  ide_args: string[];
  naming: string;
  auto_commit: boolean;
}

export interface SyncConfig {
  remote?: string;
  /** Enable auto-sync on server/TUI startup and shutdown (opt-in, default: false) */
  auto?: boolean;
}

export interface GcalConfig {
  calendar_id: string;
  default_duration_hours: number;
}

export interface Config {
  logLevel: LogLevel;
  work: WorkConfig;
  sync?: SyncConfig;
  gcal?: GcalConfig;
  keybindings?: KeybindingsConfig;
  activeDb: string;
}

const CONFIG_DIR = join(Deno.env.get("HOME") || ".", ".task-cli");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");
const DATABASES_DIR = join(CONFIG_DIR, "databases");

const DEFAULT_WORK_CONFIG: WorkConfig = {
  repos_dir: "~/git",
  default_template: "default",
  ide_command: "claude",
  ide_args: ["-n"],
  naming: "{{task.id}}-{{task.slug}}",
  auto_commit: true,
};

const DEFAULT_CONFIG: Config = {
  logLevel: "info",
  work: DEFAULT_WORK_CONFIG,
  activeDb: "default",
};

const LOG_LEVELS: LogLevel[] = ["debug", "info", "warn", "error"];

function isValidLogLevel(level: string): level is LogLevel {
  return LOG_LEVELS.includes(level as LogLevel);
}

let cachedConfig: Config | null = null;

/**
 * Create default config file if it doesn't exist.
 */
async function ensureConfigFile(): Promise<void> {
  try {
    await Deno.stat(CONFIG_FILE);
    // File exists, nothing to do
  } catch {
    // File doesn't exist, create it with defaults
    try {
      await ensureDir(CONFIG_DIR);
      const defaultContent = JSON.stringify(DEFAULT_CONFIG, null, 2) + "\n";
      await Deno.writeTextFile(CONFIG_FILE, defaultContent);
    } catch {
      // Failed to create config file - not critical, continue with defaults
    }
  }
}

/**
 * Load config file from disk.
 * Creates default config file if it doesn't exist.
 */
async function loadConfigFile(): Promise<Partial<Config>> {
  await ensureConfigFile();

  try {
    const content = await Deno.readTextFile(CONFIG_FILE);
    const parsed = JSON.parse(content);

    const config: Partial<Config> = {};

    if (parsed.logLevel && isValidLogLevel(parsed.logLevel)) {
      config.logLevel = parsed.logLevel;
    }

    // Parse work config
    if (parsed.work && typeof parsed.work === "object") {
      config.work = { ...DEFAULT_WORK_CONFIG };
      const w = parsed.work;
      if (typeof w.repos_dir === "string") config.work.repos_dir = w.repos_dir;
      if (typeof w.default_template === "string") {
        config.work.default_template = w.default_template;
      }
      if (typeof w.ide_command === "string") {
        config.work.ide_command = w.ide_command;
      }
      if (Array.isArray(w.ide_args)) {
        config.work.ide_args = w.ide_args.filter((a: unknown) =>
          typeof a === "string"
        );
      }
      if (typeof w.naming === "string") config.work.naming = w.naming;
      if (typeof w.auto_commit === "boolean") {
        config.work.auto_commit = w.auto_commit;
      }
    }

    // Parse sync config
    if (parsed.sync && typeof parsed.sync === "object") {
      config.sync = {};
      const s = parsed.sync;
      if (typeof s.remote === "string") config.sync.remote = s.remote;
      if (typeof s.auto === "boolean") {
        config.sync.auto = s.auto;
      }
    }

    // Parse gcal config
    if (parsed.gcal && typeof parsed.gcal === "object") {
      config.gcal = {
        calendar_id: "primary",
        default_duration_hours: 1,
      };
      const g = parsed.gcal;
      if (typeof g.calendar_id === "string") {
        config.gcal.calendar_id = g.calendar_id;
      }
      if (typeof g.default_duration_hours === "number") {
        config.gcal.default_duration_hours = g.default_duration_hours;
      }
    }

    // Parse activeDb
    if (typeof parsed.activeDb === "string" && parsed.activeDb.length > 0) {
      config.activeDb = parsed.activeDb;
    }

    // Parse keybindings config
    if (parsed.keybindings && typeof parsed.keybindings === "object") {
      const parseResult = KeybindingsConfigSchema.safeParse(parsed.keybindings);
      if (parseResult.success) {
        config.keybindings = parseResult.data;
      }
      // Invalid keybindings config is silently ignored, using defaults
    }

    return config;
  } catch {
    // File is invalid - use defaults
    return {};
  }
}

/**
 * Get configuration with environment variable overrides.
 * Priority: env vars > config file > defaults
 */
export async function getConfig(): Promise<Config> {
  if (cachedConfig) {
    return cachedConfig;
  }

  // Start with defaults
  const config: Config = {
    ...DEFAULT_CONFIG,
    work: { ...DEFAULT_WORK_CONFIG },
  };

  // Load from config file
  const fileConfig = await loadConfigFile();
  if (fileConfig.logLevel) {
    config.logLevel = fileConfig.logLevel;
  }
  if (fileConfig.work) {
    config.work = { ...config.work, ...fileConfig.work };
  }
  if (fileConfig.sync) {
    config.sync = fileConfig.sync;
  }
  if (fileConfig.gcal) {
    config.gcal = fileConfig.gcal;
  }
  if (fileConfig.keybindings) {
    config.keybindings = fileConfig.keybindings;
  }
  if (fileConfig.activeDb) {
    config.activeDb = fileConfig.activeDb;
  }

  // Environment variable overrides
  const envLogLevel = Deno.env.get("TASK_CLI_LOG_LEVEL");
  if (envLogLevel && isValidLogLevel(envLogLevel)) {
    config.logLevel = envLogLevel;
  }

  // Work-related env overrides
  const envReposDir = Deno.env.get("TASK_CLI_REPOS_DIR");
  if (envReposDir) config.work.repos_dir = envReposDir;

  const envIdeCommand = Deno.env.get("TASK_CLI_IDE_COMMAND");
  if (envIdeCommand) config.work.ide_command = envIdeCommand;

  cachedConfig = config;
  return config;
}

/**
 * Get config synchronously (uses cached value or defaults).
 * Call getConfig() at least once before using this.
 */
export function getConfigSync(): Config {
  return cachedConfig ||
    { ...DEFAULT_CONFIG, work: { ...DEFAULT_WORK_CONFIG } };
}

/** Reset cached config (useful for tests) */
export function resetConfig(): void {
  cachedConfig = null;
}

/**
 * Set the active database and persist to config file.
 * Updates both the cached config and the file on disk.
 */
export async function setActiveDb(name: string): Promise<void> {
  // Read current config file
  let currentConfig: Record<string, unknown> = {};
  try {
    const content = await Deno.readTextFile(CONFIG_FILE);
    currentConfig = JSON.parse(content);
  } catch {
    // File doesn't exist or is invalid - start fresh
  }

  // Update activeDb
  currentConfig.activeDb = name;

  // Write back to file
  await ensureDir(CONFIG_DIR);
  await Deno.writeTextFile(
    CONFIG_FILE,
    JSON.stringify(currentConfig, null, 2) + "\n",
  );

  // Update cached config
  if (cachedConfig) {
    cachedConfig.activeDb = name;
  }
}

/**
 * Get the databases directory path.
 */
export function getDatabasesDir(): string {
  return DATABASES_DIR;
}

/**
 * Get the path to a specific database directory.
 */
export function getDatabaseDir(name: string): string {
  return join(DATABASES_DIR, name);
}

/**
 * Set the Google Calendar ID and persist to config file.
 */
export async function setGcalCalendarId(calendarId: string): Promise<void> {
  // Read current config file
  let currentConfig: Record<string, unknown> = {};
  try {
    const content = await Deno.readTextFile(CONFIG_FILE);
    currentConfig = JSON.parse(content);
  } catch {
    // File doesn't exist or is invalid - start fresh
  }

  // Update gcal config
  if (!currentConfig.gcal || typeof currentConfig.gcal !== "object") {
    currentConfig.gcal = {};
  }
  (currentConfig.gcal as Record<string, unknown>).calendar_id = calendarId;

  // Write back to file
  await ensureDir(CONFIG_DIR);
  await Deno.writeTextFile(
    CONFIG_FILE,
    JSON.stringify(currentConfig, null, 2) + "\n",
  );

  // Update cached config
  if (cachedConfig) {
    if (!cachedConfig.gcal) {
      cachedConfig.gcal = {
        calendar_id: calendarId,
        default_duration_hours: 1,
      };
    } else {
      cachedConfig.gcal.calendar_id = calendarId;
    }
  }
}

/**
 * Get the configured Google Calendar ID.
 * Returns "primary" if not configured.
 */
export async function getGcalCalendarId(): Promise<string> {
  const config = await getConfig();
  return config.gcal?.calendar_id ?? "primary";
}

export { CONFIG_DIR, CONFIG_FILE, DATABASES_DIR };
