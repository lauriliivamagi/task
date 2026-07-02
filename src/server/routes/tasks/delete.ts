/**
 * Task Delete Routes
 *
 * DELETE /tasks/:id - Delete single task
 * DELETE /tasks/bulk - Bulk delete multiple tasks
 */

import { Hono } from "hono";
import type { Client } from "@libsql/client/node";
import { zValidator } from "@hono/zod-validator";
import { getDb } from "../../../db/client.ts";
import { BulkDeleteInput } from "../../../shared/schemas.ts";
import { logger } from "../../../shared/logger.ts";

export const deleteRoute = new Hono();

/**
 * Collect the full set of task ids that a delete will remove (the given ids
 * plus their direct subtasks) and the ids of comments belonging to them.
 * Must run BEFORE the delete: comments are removed by FK cascade.
 */
async function collectDeleteTargets(
  db: Client,
  ids: number[],
): Promise<{ taskIds: number[]; commentIds: number[] }> {
  const placeholders = ids.map(() => "?").join(", ");
  const subtasks = await db.execute({
    sql: `SELECT id FROM tasks WHERE parent_id IN (${placeholders})`,
    args: ids,
  });
  const taskIds = [
    ...ids,
    ...subtasks.rows.map((row) => Number(row.id)),
  ];

  const taskPlaceholders = taskIds.map(() => "?").join(", ");
  const comments = await db.execute({
    sql: `SELECT id FROM comments WHERE task_id IN (${taskPlaceholders})`,
    args: taskIds,
  });
  const commentIds = comments.rows.map((row) => Number(row.id));

  return { taskIds, commentIds };
}

/**
 * Remove embeddings for deleted tasks/comments. The `emb` database is attached
 * separately, so FK cascades can't reach it — without this, deleted rows leave
 * orphaned vectors that pollute semantic search forever. Best-effort: embedding
 * storage may be unavailable (e.g. attach failed), and that must not fail the
 * delete itself.
 */
async function deleteEmbeddings(
  db: Client,
  taskIds: number[],
  commentIds: number[],
): Promise<void> {
  try {
    if (taskIds.length > 0) {
      const placeholders = taskIds.map(() => "?").join(", ");
      await db.execute({
        sql:
          `DELETE FROM emb.task_embeddings WHERE task_id IN (${placeholders})`,
        args: taskIds,
      });
    }
    if (commentIds.length > 0) {
      const placeholders = commentIds.map(() => "?").join(", ");
      await db.execute({
        sql:
          `DELETE FROM emb.comment_embeddings WHERE comment_id IN (${placeholders})`,
        args: commentIds,
      });
    }
  } catch (error) {
    logger.warn("Failed to clean up embeddings after delete", "tasks", {
      error: String(error).slice(0, 100),
    });
  }
}

// Bulk delete tasks (must be before /:id routes)
deleteRoute.delete(
  "/bulk",
  zValidator("json", BulkDeleteInput),
  async (c) => {
    const { ids } = c.req.valid("json");
    const db = await getDb();

    const { taskIds, commentIds } = await collectDeleteTargets(db, ids);

    // Delete subtasks first: parent_id has no ON DELETE cascade, so deleting a
    // parent that still has subtasks would violate the foreign key.
    const placeholders = ids.map(() => "?").join(", ");
    const subtaskResult = await db.execute({
      sql: `DELETE FROM tasks WHERE parent_id IN (${placeholders})`,
      args: ids,
    });
    const result = await db.execute({
      sql: `DELETE FROM tasks WHERE id IN (${placeholders})`,
      args: ids,
    });

    await deleteEmbeddings(db, taskIds, commentIds);

    return c.json({
      deleted: result.rowsAffected + subtaskResult.rowsAffected,
    });
  },
);

// Delete single task (with subtask cascade)
deleteRoute.delete("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const db = await getDb();

  const { taskIds, commentIds } = await collectDeleteTargets(db, [id]);

  // Delete subtasks first (single level - subtasks cannot have subtasks)
  await db.execute({
    sql: "DELETE FROM tasks WHERE parent_id = ?",
    args: [id],
  });

  // Then delete the task itself
  const result = await db.execute({
    sql: "DELETE FROM tasks WHERE id = ?",
    args: [id],
  });

  if (result.rowsAffected === 0) {
    return c.json({ error: `Task #${id} not found` }, 404);
  }

  await deleteEmbeddings(db, taskIds, commentIds);

  return c.json({ deleted: true });
});
