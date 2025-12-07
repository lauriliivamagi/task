import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { getDb } from "../../db/client.ts";
import {
  AddTagsToTaskInput,
  CreateTagInput,
  RenameTagInput,
} from "../../shared/schemas.ts";
import { getEmbeddingService } from "../../embeddings/service.ts";

export const tagsRoute = new Hono();

// List all tags with usage counts
tagsRoute.get("/", async (c) => {
  const db = await getDb();
  const result = await db.execute(`
    SELECT t.id, t.name, t.created_at, COUNT(tt.task_id) as task_count
    FROM tags t
    LEFT JOIN task_tags tt ON t.id = tt.tag_id
    GROUP BY t.id
    ORDER BY t.name ASC
  `);
  return c.json(result.rows);
});

// Create a new tag
tagsRoute.post("/", zValidator("json", CreateTagInput), async (c) => {
  const { name } = c.req.valid("json");
  const db = await getDb();

  // Check if tag already exists (case-insensitive due to COLLATE NOCASE)
  const existing = await db.execute({
    sql: "SELECT * FROM tags WHERE name = ?",
    args: [name.trim()],
  });

  if (existing.rows.length > 0) {
    return c.json(existing.rows[0]);
  }

  const result = await db.execute({
    sql: "INSERT INTO tags (name) VALUES (?) RETURNING *",
    args: [name.trim()],
  });

  return c.json(result.rows[0], 201);
});

// Rename a tag
tagsRoute.patch("/:id", zValidator("json", RenameTagInput), async (c) => {
  const id = Number(c.req.param("id"));
  const { name } = c.req.valid("json");
  const db = await getDb();

  const result = await db.execute({
    sql: "UPDATE tags SET name = ? WHERE id = ? RETURNING *",
    args: [name.trim(), id],
  });

  if (result.rows.length === 0) {
    return c.json({ error: `Tag #${id} not found` }, 404);
  }

  return c.json(result.rows[0]);
});

// Delete a tag
tagsRoute.delete("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const db = await getDb();

  await db.execute({
    sql: "DELETE FROM tags WHERE id = ?",
    args: [id],
  });

  return c.json({ deleted: true });
});

// Task-tag association routes (nested under /tasks/:taskId/tags)
export const taskTagsRoute = new Hono<{
  Variables: { taskId: number };
}>();

// Middleware to extract and validate taskId
taskTagsRoute.use("*", async (c, next) => {
  const taskId = Number(c.req.param("taskId"));
  if (isNaN(taskId)) {
    return c.json({ error: "Invalid task ID" }, 400);
  }
  c.set("taskId", taskId);
  await next();
});

// Get tags for a task
taskTagsRoute.get("/", async (c) => {
  const taskId = c.get("taskId");
  const db = await getDb();

  const result = await db.execute({
    sql: `
      SELECT tg.id, tg.name, tg.created_at
      FROM tags tg
      JOIN task_tags tt ON tg.id = tt.tag_id
      WHERE tt.task_id = ?
      ORDER BY tg.name ASC
    `,
    args: [taskId],
  });

  return c.json(result.rows);
});

// Add tags to a task (creates tags if they don't exist)
taskTagsRoute.post("/", zValidator("json", AddTagsToTaskInput), async (c) => {
  const taskId = c.get("taskId");
  const { tags } = c.req.valid("json");
  const db = await getDb();

  // Verify task exists
  const task = await db.execute({
    sql: "SELECT id, title, description FROM tasks WHERE id = ?",
    args: [taskId],
  });
  if (task.rows.length === 0) {
    return c.json({ error: `Task #${taskId} not found` }, 404);
  }

  const addedTags = [];
  for (const tagName of tags) {
    const trimmedName = tagName.trim();
    if (!trimmedName) continue;

    // Get or create tag
    await db.execute({
      sql: "INSERT OR IGNORE INTO tags (name) VALUES (?)",
      args: [trimmedName],
    });
    const tagResult = await db.execute({
      sql: "SELECT id, name FROM tags WHERE name = ?",
      args: [trimmedName],
    });

    if (tagResult.rows[0]) {
      const tag = tagResult.rows[0];
      // Create association (ignore if exists)
      await db.execute({
        sql: "INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?, ?)",
        args: [taskId, tag.id],
      });
      addedTags.push(tag);
    }
  }

  // Regenerate embeddings with tags
  regenerateTaskEmbedding(taskId, db);

  return c.json({ tags: addedTags }, 201);
});

// Set tags for a task (replaces existing tags, cleans up orphans)
taskTagsRoute.put("/", zValidator("json", AddTagsToTaskInput), async (c) => {
  const taskId = c.get("taskId");
  const { tags } = c.req.valid("json");
  const db = await getDb();

  // Verify task exists
  const task = await db.execute({
    sql: "SELECT id FROM tasks WHERE id = ?",
    args: [taskId],
  });
  if (task.rows.length === 0) {
    return c.json({ error: `Task #${taskId} not found` }, 404);
  }

  // Get current tags for cleanup later
  const currentTags = await db.execute({
    sql: "SELECT tag_id FROM task_tags WHERE task_id = ?",
    args: [taskId],
  });
  const previousTagIds = currentTags.rows.map((r) => r.tag_id as number);

  // Remove all current tags from this task
  await db.execute({
    sql: "DELETE FROM task_tags WHERE task_id = ?",
    args: [taskId],
  });

  // Add new tags
  const addedTags = [];
  for (const tagName of tags) {
    const trimmedName = tagName.trim();
    if (!trimmedName) continue;

    // Get or create tag
    await db.execute({
      sql: "INSERT OR IGNORE INTO tags (name) VALUES (?)",
      args: [trimmedName],
    });
    const tagResult = await db.execute({
      sql: "SELECT id, name FROM tags WHERE name = ?",
      args: [trimmedName],
    });

    if (tagResult.rows[0]) {
      const tag = tagResult.rows[0];
      await db.execute({
        sql: "INSERT INTO task_tags (task_id, tag_id) VALUES (?, ?)",
        args: [taskId, tag.id],
      });
      addedTags.push(tag);
    }
  }

  // Clean up orphaned tags (tags with no tasks)
  for (const tagId of previousTagIds) {
    const usage = await db.execute({
      sql: "SELECT COUNT(*) as count FROM task_tags WHERE tag_id = ?",
      args: [tagId],
    });
    if ((usage.rows[0].count as number) === 0) {
      await db.execute({
        sql: "DELETE FROM tags WHERE id = ?",
        args: [tagId],
      });
    }
  }

  // Regenerate embeddings with updated tags
  regenerateTaskEmbedding(taskId, db);

  return c.json({ tags: addedTags });
});

// Remove a tag from a task
taskTagsRoute.delete("/:tagId", async (c) => {
  const taskId = c.get("taskId");
  const tagId = Number(c.req.param("tagId"));
  const db = await getDb();

  await db.execute({
    sql: "DELETE FROM task_tags WHERE task_id = ? AND tag_id = ?",
    args: [taskId, tagId],
  });

  // Clean up orphaned tag
  const usage = await db.execute({
    sql: "SELECT COUNT(*) as count FROM task_tags WHERE tag_id = ?",
    args: [tagId],
  });
  if ((usage.rows[0].count as number) === 0) {
    await db.execute({
      sql: "DELETE FROM tags WHERE id = ?",
      args: [tagId],
    });
  }

  // Regenerate embeddings with updated tags
  regenerateTaskEmbedding(taskId, db);

  return c.json({ deleted: true });
});

// Helper to regenerate task embedding with current tags
async function regenerateTaskEmbedding(
  taskId: number,
  db: Awaited<ReturnType<typeof getDb>>,
): Promise<void> {
  const taskResult = await db.execute({
    sql: "SELECT title, description FROM tasks WHERE id = ?",
    args: [taskId],
  });

  if (taskResult.rows.length === 0) return;

  const task = taskResult.rows[0];
  const tagsResult = await db.execute({
    sql: `
      SELECT tg.name FROM tags tg
      JOIN task_tags tt ON tg.id = tt.tag_id
      WHERE tt.task_id = ?
    `,
    args: [taskId],
  });

  const tagNames = tagsResult.rows.map((r) => r.name as string);

  const embeddingService = getEmbeddingService();
  embeddingService
    .embedTask(
      taskId,
      task.title as string,
      task.description as string | null,
      tagNames,
    )
    .catch((err) => console.error("Failed to re-embed task with tags:", err));
}
