/**
 * Task Subtasks Route
 *
 * POST /tasks/:id/complete-subtasks - Complete all subtasks of a task
 */

import { Hono } from "hono";
import { getDb } from "../../../db/client.ts";

export const subtasksRoute = new Hono();

subtasksRoute.post("/:id/complete-subtasks", async (c) => {
  const id = Number(c.req.param("id"));
  const db = await getDb();

  // Verify parent task exists
  const parent = await db.execute({
    sql: "SELECT id FROM tasks WHERE id = ?",
    args: [id],
  });

  if (parent.rows.length === 0) {
    return c.json({ error: `Task #${id} not found` }, 404);
  }

  const result = await db.execute({
    sql: `
      UPDATE tasks
      SET status = 'done', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE parent_id = ? AND status != 'done'
    `,
    args: [id],
  });

  return c.json({ updated: result.rowsAffected });
});
