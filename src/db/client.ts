import type { Client } from "@libsql/client/node";
import { createClient } from "@libsql/client/node";
import {
  commentEmbeddingIndexMigration,
  commentEmbeddingMigration,
  completedAtMigration,
  contextMigration,
  durationMigration,
  embeddingIndexMigration,
  embeddingMigration,
  gcalEventMigration,
  gcalEventUrlMigration,
  orderMigration,
  recurrenceMigration,
  schema,
  tagsMigration,
} from "./schema.ts";
import { ensureDir } from "@std/fs";
import { join } from "@std/path";
import { logger } from "../shared/logger.ts";
import { assert, assertDefined } from "../shared/assert.ts";
import { getConfig, getConfigSync, getDatabaseDir } from "../shared/config.ts";
import {
  ensureDatabasesDir,
  getValidActiveDb,
  migrateToMultiDb,
} from "../shared/migration.ts";

// Base directory (kept for backward compatibility during migration check)
const BASE_DIR = join(Deno.env.get("HOME") || ".", ".task-cli");

/**
 * Get the current active database name.
 * Returns "default" if no database is configured.
 */
export function getActiveDbName(): string {
  return getConfigSync().activeDb ?? "default";
}

/**
 * Get the directory path for a specific database.
 */
export function getDbDir(name?: string): string {
  const dbName = name ?? getActiveDbName();
  return getDatabaseDir(dbName);
}

/**
 * Get the database file path for a specific database.
 */
export function getDbPath(name?: string): string {
  return join(getDbDir(name), "data.db");
}

/**
 * Get the attachments directory for a specific database.
 */
export function getAttachmentsDir(name?: string): string {
  return join(getDbDir(name), "attachments");
}

// Cache client to avoid creating new connections (important for in-memory DBs)
let cachedClient: Client | null = null;
let cachedDbUrl: string | null = null;

export async function getDb(): Promise<Client> {
  // Allow test override via environment variable (e.g., ":memory:" for in-memory DB)
  // Read at runtime to allow tests to set it dynamically
  const testDbUrl = Deno.env.get("TASK_CLI_DB_URL");

  // For file-based databases, run migration if needed and use dynamic path
  let dbUrl: string;
  if (testDbUrl) {
    dbUrl = testDbUrl;
  } else {
    // Load config from disk first (populates cache for getActiveDbName)
    await getConfig();

    // Run migration from single-db to multi-db if needed
    await migrateToMultiDb();
    await ensureDatabasesDir();

    // Validate active database exists, fall back to first available if not
    const configuredDb = getActiveDbName();
    const validDb = await getValidActiveDb(configuredDb);

    if (!validDb) {
      // No databases exist at all - create default
      const defaultDir = getDatabaseDir("default");
      await ensureDir(defaultDir);
      await ensureDir(join(defaultDir, "attachments"));
      dbUrl = `file:${join(defaultDir, "data.db")}`;
    } else {
      // Use the valid database (may differ from configured if that was deleted)
      dbUrl = `file:${getDbPath(validDb)}`;
    }
  }

  // Assert: DB URL must be non-empty.
  assert(dbUrl.length > 0, "Database URL must not be empty", "db");

  // Return cached client if URL hasn't changed
  if (cachedClient && cachedDbUrl === dbUrl) {
    return cachedClient;
  }

  const client = createClient({ url: dbUrl });

  // Assert: Client must be created successfully.
  assertDefined(client, "Database client must be created", "db");

  // Enable foreign key enforcement (SQLite ignores FK constraints by default)
  await client.execute("PRAGMA foreign_keys = ON;");

  // Cache the client
  cachedClient = client;
  cachedDbUrl = dbUrl;

  return client;
}

/** Reset the cached client (useful for tests) */
export function resetDbClient(): void {
  cachedClient = null;
  cachedDbUrl = null;
}

export async function initDb(): Promise<Client> {
  const db = await getDb();
  await db.executeMultiple(schema);
  return db;
}

/** Check if a column exists in a table */
async function columnExists(
  db: Client,
  table: string,
  column: string,
): Promise<boolean> {
  const result = await db.execute(`PRAGMA table_info(${table})`);
  return result.rows.some((row) => row.name === column);
}

/** Run embedding migration (add column + index) */
export async function migrateEmbeddings(): Promise<Client> {
  const db = await getDb();

  // Check if embedding column already exists
  const hasEmbedding = await columnExists(db, "tasks", "embedding");

  if (!hasEmbedding) {
    try {
      await db.execute(embeddingMigration);
      logger.info("Added embedding column to tasks table", "db");
    } catch (error) {
      // Column might already exist (race condition)
      if (!String(error).includes("duplicate column")) {
        throw error;
      }
    }
  }

  // Create index (IF NOT EXISTS handles idempotency)
  try {
    await db.execute(embeddingIndexMigration);
  } catch (error) {
    // Index creation might fail if libsql doesn't support vectors
    // This is expected in some environments (e.g., in-memory test DBs)
    logger.warn("Could not create vector index", "db", {
      error: String(error).slice(0, 100),
    });
  }

  return db;
}

/** Run comment embedding migration (add column + index) */
export async function migrateCommentEmbeddings(): Promise<Client> {
  const db = await getDb();

  const hasEmbedding = await columnExists(db, "comments", "embedding");

  if (!hasEmbedding) {
    try {
      await db.execute(commentEmbeddingMigration);
      logger.info("Added embedding column to comments table", "db");
    } catch (error) {
      if (!String(error).includes("duplicate column")) {
        throw error;
      }
    }
  }

  try {
    await db.execute(commentEmbeddingIndexMigration);
  } catch (error) {
    logger.warn("Could not create comment vector index", "db", {
      error: String(error).slice(0, 100),
    });
  }

  return db;
}

/** Run context migration on a specific database */
async function migrateContextOn(db: Client): Promise<void> {
  const hasContext = await columnExists(db, "tasks", "context");

  if (!hasContext) {
    try {
      await db.execute(contextMigration);
      logger.info("Added context column to tasks table", "db");
    } catch (error) {
      if (!String(error).includes("duplicate column")) {
        throw error;
      }
    }
  }
}

/** Run context migration (add context column) */
export async function migrateContext(): Promise<Client> {
  const db = await getDb();
  await migrateContextOn(db);
  return db;
}

/** Run order migration on a specific database */
async function migrateOrderOn(db: Client): Promise<void> {
  const hasOrder = await columnExists(db, "tasks", "order");

  if (!hasOrder) {
    try {
      await db.execute(orderMigration);
      logger.info("Added order column to tasks table", "db");
    } catch (error) {
      if (!String(error).includes("duplicate column")) {
        throw error;
      }
    }
  }

  // Check if order values need to be initialized (all are 0)
  const checkResult = await db.execute(
    "SELECT COUNT(*) as total, SUM(CASE WHEN `order` = 0 THEN 1 ELSE 0 END) as zeros FROM tasks",
  );

  // Assert: Query must return exactly one row with count results.
  assert(
    checkResult.rows.length === 1,
    "Order check query must return one row",
    "db",
  );
  assertDefined(checkResult.rows[0], "Order check row must exist", "db");

  const total = checkResult.rows[0].total as number;
  const zeros = checkResult.rows[0].zeros as number;

  // Assert: Counts must be non-negative integers.
  assert(total >= 0, "Task count must be non-negative", "db", { total });
  assert(
    zeros >= 0 && zeros <= total,
    "Zero count must be between 0 and total",
    "db",
    { zeros, total },
  );

  if (total > 0 && total === zeros) {
    // All tasks have order=0, need to initialize with unique values
    // Assign order based on created_at within each parent scope
    logger.info("Initializing order values for existing tasks", "db");

    // Get all distinct parent_id values (including NULL for root tasks)
    const scopes = await db.execute(
      "SELECT DISTINCT parent_id FROM tasks",
    );

    for (const row of scopes.rows) {
      const parentId = row.parent_id as number | null;

      // Get tasks in this scope ordered by created_at
      let tasks;
      if (parentId === null) {
        tasks = await db.execute(
          "SELECT id FROM tasks WHERE parent_id IS NULL ORDER BY created_at ASC",
        );
      } else {
        tasks = await db.execute({
          sql:
            "SELECT id FROM tasks WHERE parent_id = ? ORDER BY created_at ASC",
          args: [parentId],
        });
      }

      // Assign sequential order values
      for (let i = 0; i < tasks.rows.length; i++) {
        await db.execute({
          sql: "UPDATE tasks SET `order` = ? WHERE id = ?",
          args: [i, tasks.rows[i].id],
        });
      }
    }

    logger.info("Order values initialized for all tasks", "db");
  }
}

/** Run order migration (add order column and initialize values) */
export async function migrateOrder(): Promise<Client> {
  const db = await getDb();
  await migrateOrderOn(db);
  return db;
}

/** Check if a table exists */
async function tableExists(db: Client, table: string): Promise<boolean> {
  const result = await db.execute({
    sql: "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
    args: [table],
  });
  return result.rows.length > 0;
}

/** Run tags migration on a specific database */
async function migrateTagsOn(db: Client): Promise<void> {
  const hasTags = await tableExists(db, "tags");

  if (!hasTags) {
    try {
      await db.executeMultiple(tagsMigration);
      logger.info("Created tags and task_tags tables", "db");

      // Migrate existing tags from context JSON to new tables
      const tasksWithContext = await db.execute(
        "SELECT id, context FROM tasks WHERE context IS NOT NULL",
      );

      let migratedCount = 0;
      for (const row of tasksWithContext.rows) {
        try {
          const context = JSON.parse(row.context as string);
          if (context.tags && Array.isArray(context.tags)) {
            for (const tagName of context.tags) {
              if (typeof tagName === "string" && tagName.trim()) {
                // Get or create tag
                await db.execute({
                  sql: "INSERT OR IGNORE INTO tags (name) VALUES (?)",
                  args: [tagName.trim()],
                });
                const tagResult = await db.execute({
                  sql: "SELECT id FROM tags WHERE name = ?",
                  args: [tagName.trim()],
                });
                if (tagResult.rows[0]) {
                  // Create task_tags relation
                  await db.execute({
                    sql:
                      "INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?, ?)",
                    args: [row.id, tagResult.rows[0].id],
                  });
                  migratedCount++;
                }
              }
            }
          }
        } catch {
          // Skip tasks with invalid JSON
        }
      }

      if (migratedCount > 0) {
        logger.info(
          `Migrated ${migratedCount} tag associations from context JSON`,
          "db",
        );
      }
    } catch (error) {
      // Tables might already exist (race condition)
      if (!String(error).includes("already exists")) {
        throw error;
      }
    }
  }
}

/** Run tags migration (create tags tables and migrate from context JSON) */
export async function migrateTags(): Promise<Client> {
  const db = await getDb();
  await migrateTagsOn(db);
  return db;
}

/** Run completed_at migration on a specific database */
async function migrateCompletedAtOn(db: Client): Promise<void> {
  const hasCompletedAt = await columnExists(db, "tasks", "completed_at");

  if (!hasCompletedAt) {
    try {
      await db.execute(completedAtMigration);
      logger.info("Added completed_at column to tasks table", "db");
    } catch (error) {
      if (!String(error).includes("duplicate column")) {
        throw error;
      }
    }
  }
}

/** Run completed_at migration (add column for tracking task completion time) */
export async function migrateCompletedAt(): Promise<Client> {
  const db = await getDb();
  await migrateCompletedAtOn(db);
  return db;
}

/** Run recurrence migration on a specific database */
async function migrateRecurrenceOn(db: Client): Promise<void> {
  const hasRecurrence = await columnExists(db, "tasks", "recurrence");

  if (!hasRecurrence) {
    try {
      await db.execute(recurrenceMigration);
      logger.info("Added recurrence column to tasks table", "db");
    } catch (error) {
      if (!String(error).includes("duplicate column")) {
        throw error;
      }
    }
  }
}

/** Run recurrence migration (add column for recurring task rules) */
export async function migrateRecurrence(): Promise<Client> {
  const db = await getDb();
  await migrateRecurrenceOn(db);
  return db;
}

/** Run gcal_event_id migration on a specific database */
async function migrateGcalEventIdOn(db: Client): Promise<void> {
  const hasGcalEventId = await columnExists(db, "tasks", "gcal_event_id");

  if (!hasGcalEventId) {
    try {
      await db.execute(gcalEventMigration);
      logger.info("Added gcal_event_id column to tasks table", "db");
    } catch (error) {
      if (!String(error).includes("duplicate column")) {
        throw error;
      }
    }
  }

  // Also run gcal_event_url migration
  const hasGcalEventUrl = await columnExists(db, "tasks", "gcal_event_url");

  if (!hasGcalEventUrl) {
    try {
      await db.execute(gcalEventUrlMigration);
      logger.info("Added gcal_event_url column to tasks table", "db");
    } catch (error) {
      if (!String(error).includes("duplicate column")) {
        throw error;
      }
    }
  }
}

/** Run gcal_event_id migration (add column for Google Calendar event linking) */
export async function migrateGcalEventId(): Promise<Client> {
  const db = await getDb();
  await migrateGcalEventIdOn(db);
  return db;
}

/** Run duration_hours migration on a specific database */
async function migrateDurationOn(db: Client): Promise<void> {
  const hasDuration = await columnExists(db, "tasks", "duration_hours");

  if (!hasDuration) {
    try {
      await db.execute(durationMigration);
      logger.info("Added duration_hours column to tasks table", "db");
    } catch (error) {
      if (!String(error).includes("duplicate column")) {
        throw error;
      }
    }
  }
}

/** Run duration_hours migration (add column for task duration) */
export async function migrateDuration(): Promise<Client> {
  const db = await getDb();
  await migrateDurationOn(db);
  return db;
}

/**
 * Run all schema migrations on a specific database.
 * This is the SINGLE SOURCE OF TRUTH for the migration list.
 * When adding a new migration, add it here and it will run everywhere.
 */
export async function runAllMigrations(db: Client): Promise<void> {
  // Core schema migrations (order matters for some)
  await migrateContextOn(db);
  await migrateOrderOn(db);
  await migrateTagsOn(db);
  await migrateCompletedAtOn(db);
  await migrateRecurrenceOn(db);
  await migrateGcalEventIdOn(db);
  await migrateDurationOn(db);

  // Note: Embedding migrations are intentionally excluded.
  // They run on-demand when the embedding service initializes,
  // as they require vector extension support which may not be available.
}

/**
 * Run migrations on ALL databases.
 * Called on server startup to ensure all DBs have latest schema.
 *
 * When TASK_CLI_DB_URL is set (test/custom mode), only migrates that database.
 * Otherwise, iterates all databases in ~/.task-cli/databases/.
 */
export async function migrateAllDatabases(): Promise<void> {
  // If using custom database URL (tests or custom setup), migrate just that one
  const testDbUrl = Deno.env.get("TASK_CLI_DB_URL");
  if (testDbUrl) {
    const client = createClient({ url: testDbUrl });
    try {
      await client.execute("PRAGMA foreign_keys = ON;");
      await client.executeMultiple(schema);
      await runAllMigrations(client);
    } finally {
      client.close();
    }
    return;
  }

  const { listDatabaseNames, ensureDatabasesDir } = await import(
    "../shared/migration.ts"
  );
  const { DATABASES_DIR } = await import("../shared/config.ts");

  // Ensure database directory structure exists
  await ensureDatabasesDir();

  const dbNames = await listDatabaseNames();

  for (const name of dbNames) {
    const dbPath = join(DATABASES_DIR, name, "data.db");
    const client = createClient({ url: `file:${dbPath}` });
    try {
      // Enable foreign keys
      await client.execute("PRAGMA foreign_keys = ON;");
      // Create base schema (idempotent)
      await client.executeMultiple(schema);
      // Run all migrations
      await runAllMigrations(client);
      logger.info(`Migrated database: ${name}`, "db");
    } catch (error) {
      logger.error(`Failed to migrate database: ${name}`, "db", {
        error: String(error),
      });
      // Continue with other databases even if one fails
    } finally {
      client.close();
    }
  }
}

// Export BASE_DIR for backward compatibility (used by sync, etc.)
export { BASE_DIR as DB_DIR };
