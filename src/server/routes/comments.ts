import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { getDb } from "../../db/client.ts";
import { getEmbeddingService } from "../../embeddings/service.ts";
import { CreateCommentInput } from "../../shared/schemas.ts";

export const commentsRoute = new Hono();

// List comments for a task
commentsRoute.get("/", async (c) => {
  const taskId = Number(c.req.param("taskId"));
  const db = await getDb();

  const result = await db.execute({
    sql: "SELECT * FROM comments WHERE task_id = ? ORDER BY created_at ASC",
    args: [taskId],
  });

  return c.json(result.rows);
});

// Add comment to task
commentsRoute.post(
  "/",
  zValidator("json", CreateCommentInput),
  async (c) => {
    const taskId = Number(c.req.param("taskId"));
    const input = c.req.valid("json");
    const db = await getDb();

    // Check if task exists
    const taskResult = await db.execute({
      sql: "SELECT id FROM tasks WHERE id = ?",
      args: [taskId],
    });

    if (taskResult.rows.length === 0) {
      return c.json({ error: `Task #${taskId} not found` }, 404);
    }

    const result = await db.execute({
      sql: "INSERT INTO comments (task_id, content) VALUES (?, ?) RETURNING *",
      args: [taskId, input.content],
    });

    const comment = result.rows[0];

    // Fire-and-forget embedding generation
    getEmbeddingService()
      .embedComment(comment.id as number, input.content)
      .catch((err) => console.error("Failed to embed comment:", err));

    return c.json(comment, 201);
  },
);

// Delete comment
commentsRoute.delete("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const db = await getDb();

  await db.execute({
    sql: "DELETE FROM comments WHERE id = ?",
    args: [id],
  });

  return c.json({ deleted: true });
});
