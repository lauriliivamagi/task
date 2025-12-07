/**
 * Migration from single-database to multi-database structure.
 *
 * Old structure:
 *   ~/.task-cli/data.db
 *   ~/.task-cli/attachments/
 *   ~/.task-cli/tui-state.json
 *
 * New structure:
 *   ~/.task-cli/databases/default/data.db
 *   ~/.task-cli/databases/default/attachments/
 *   ~/.task-cli/databases/default/tui-state.json
 */

import { join } from "@std/path";
import { ensureDir, exists, move } from "@std/fs";
import { logger } from "./logger.ts";
import { CONFIG_DIR, DATABASES_DIR, setActiveDb } from "./config.ts";

const OLD_DB_PATH = join(CONFIG_DIR, "data.db");
const OLD_ATTACHMENTS_DIR = join(CONFIG_DIR, "attachments");
const OLD_TUI_STATE = join(CONFIG_DIR, "tui-state.json");

const DEFAULT_DB_DIR = join(DATABASES_DIR, "default");
const NEW_DB_PATH = join(DEFAULT_DB_DIR, "data.db");
const NEW_ATTACHMENTS_DIR = join(DEFAULT_DB_DIR, "attachments");
const NEW_TUI_STATE = join(DEFAULT_DB_DIR, "tui-state.json");

/**
 * Check if migration is needed.
 * Migration is needed when old structure exists and new structure does not.
 */
export async function needsMigration(): Promise<boolean> {
  const oldExists = await exists(OLD_DB_PATH);
  const newExists = await exists(DATABASES_DIR);
  return oldExists && !newExists;
}

/**
 * Migrate from single-database to multi-database structure.
 * Returns true if migration was performed, false if not needed.
 *
 * This migration is safe: it creates new directories first, then moves files.
 * If any step fails, it logs the error and returns false.
 */
export async function migrateToMultiDb(): Promise<boolean> {
  // Check if migration is needed
  if (!(await needsMigration())) {
    return false;
  }

  logger.info("Migrating to multi-database structure...", "migration");

  try {
    // Create new directory structure
    await ensureDir(DEFAULT_DB_DIR);
    await ensureDir(NEW_ATTACHMENTS_DIR);

    // Move database file
    if (await exists(OLD_DB_PATH)) {
      await move(OLD_DB_PATH, NEW_DB_PATH);
      logger.info("Moved data.db to databases/default/", "migration");
    }

    // Move attachments directory contents
    if (await exists(OLD_ATTACHMENTS_DIR)) {
      // Move each file individually since we already created the target dir
      try {
        for await (const entry of Deno.readDir(OLD_ATTACHMENTS_DIR)) {
          const oldPath = join(OLD_ATTACHMENTS_DIR, entry.name);
          const newPath = join(NEW_ATTACHMENTS_DIR, entry.name);
          await move(oldPath, newPath);
        }
        // Remove empty old attachments directory
        await Deno.remove(OLD_ATTACHMENTS_DIR);
        logger.info("Moved attachments to databases/default/", "migration");
      } catch (error) {
        logger.warn("Could not move all attachments", "migration", {
          error: String(error),
        });
      }
    }

    // Move TUI state file
    if (await exists(OLD_TUI_STATE)) {
      await move(OLD_TUI_STATE, NEW_TUI_STATE);
      logger.info("Moved tui-state.json to databases/default/", "migration");
    }

    // Set activeDb to "default" in config
    await setActiveDb("default");

    logger.info("Migration to multi-database structure complete", "migration");
    return true;
  } catch (error) {
    logger.error("Migration failed", "migration", { error: String(error) });
    return false;
  }
}

/**
 * Ensure the databases directory structure exists.
 * Creates the default database directory only if no databases exist at all.
 */
export async function ensureDatabasesDir(): Promise<void> {
  // If databases dir doesn't exist and old structure doesn't exist,
  // create the default database directory
  if (!(await exists(DATABASES_DIR))) {
    if (!(await exists(OLD_DB_PATH))) {
      // Fresh install - create default database directory
      await ensureDir(join(DATABASES_DIR, "default"));
      await ensureDir(join(DATABASES_DIR, "default", "attachments"));
    }
  }
}

/**
 * List all available database names.
 */
export async function listDatabaseNames(): Promise<string[]> {
  const names: string[] = [];
  try {
    for await (const entry of Deno.readDir(DATABASES_DIR)) {
      if (entry.isDirectory) {
        const dbPath = join(DATABASES_DIR, entry.name, "data.db");
        if (await exists(dbPath)) {
          names.push(entry.name);
        }
      }
    }
  } catch {
    // Directory doesn't exist
  }
  return names;
}

/**
 * Get a valid active database name.
 * If the configured activeDb doesn't exist, returns the first available database.
 * Returns null if no databases exist.
 */
export async function getValidActiveDb(
  configuredDb: string,
): Promise<string | null> {
  const dbPath = join(DATABASES_DIR, configuredDb, "data.db");
  if (await exists(dbPath)) {
    return configuredDb;
  }

  // Configured database doesn't exist, find first available
  const available = await listDatabaseNames();
  if (available.length > 0) {
    // Sort to get consistent results, prefer "default" if it exists
    available.sort((a, b) => {
      if (a === "default") return -1;
      if (b === "default") return 1;
      return a.localeCompare(b);
    });
    return available[0];
  }

  return null;
}
