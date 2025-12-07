export const schema = `
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    parent_id INTEGER,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'todo', -- todo, in-progress, done
    priority INTEGER DEFAULT 0, -- 0: normal, 1: high, 2: urgent
    due_date DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (parent_id) REFERENCES tasks(id)
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    path TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
  );
`;

/**
 * Migration to add embedding column and vector index.
 * Uses Turso's native vector support with F32_BLOB type.
 */
export const embeddingMigration = `
  -- Add embedding column if not exists (768 dimensions)
  ALTER TABLE tasks ADD COLUMN embedding F32_BLOB(768);
`;

export const embeddingIndexMigration = `
  -- Create vector similarity index
  CREATE INDEX IF NOT EXISTS tasks_embedding_idx ON tasks (
    libsql_vector_idx(embedding, 'metric=cosine')
  );
`;

/**
 * Migration to add embedding column to comments table.
 */
export const commentEmbeddingMigration = `
  ALTER TABLE comments ADD COLUMN embedding F32_BLOB(768);
`;

export const commentEmbeddingIndexMigration = `
  CREATE INDEX IF NOT EXISTS comments_embedding_idx ON comments (
    libsql_vector_idx(embedding, 'metric=cosine')
  );
`;

/**
 * Migration to add context column to tasks table.
 * Stores JSON blob for AI agent context (files, urls, git, etc.)
 */
export const contextMigration = `
  ALTER TABLE tasks ADD COLUMN context TEXT;
`;

/**
 * Migration to add order column to tasks table.
 * Used for manual task ordering. Top-level tasks have global order,
 * subtasks have order within their parent.
 */
export const orderMigration = `
  ALTER TABLE tasks ADD COLUMN \`order\` INTEGER DEFAULT 0;
`;

/**
 * Migration to add completed_at column to tasks table.
 * Tracks when a task was marked as done (separate from updated_at).
 */
export const completedAtMigration = `
  ALTER TABLE tasks ADD COLUMN completed_at DATETIME;
`;

/**
 * Migration to add tags tables.
 * Creates normalized tags and task_tags (many-to-many) tables.
 */
export const tagsMigration = `
  CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS task_tags (
    task_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (task_id, tag_id),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
  );
`;

/**
 * Migration to add recurrence column to tasks table.
 * Stores JSON recurrence rules for recurring tasks.
 * Only top-level tasks (parent_id IS NULL) can have recurrence.
 */
export const recurrenceMigration = `
  ALTER TABLE tasks ADD COLUMN recurrence TEXT;
`;

/**
 * Migration to add gcal_event_id column to tasks table.
 * Stores the Google Calendar event ID for synced tasks.
 * Enables create/update operations on linked calendar events.
 */
export const gcalEventMigration = `
  ALTER TABLE tasks ADD COLUMN gcal_event_id TEXT;
`;

/**
 * Migration to add gcal_event_url column to tasks table.
 * Stores the full Google Calendar event URL for direct linking.
 */
export const gcalEventUrlMigration = `
  ALTER TABLE tasks ADD COLUMN gcal_event_url TEXT;
`;

/**
 * Migration to add duration_hours column to tasks table.
 * Stores task duration in hours (0.25-24). Used for Google Calendar events
 * and general time estimation.
 */
export const durationMigration = `
  ALTER TABLE tasks ADD COLUMN duration_hours REAL;
`;
