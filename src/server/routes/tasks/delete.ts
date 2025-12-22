/**
 * Task Delete Routes
 *
 * DELETE /tasks/:id - Delete single task
 * DELETE /tasks/bulk - Bulk delete multiple tasks
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { getDb } from "../../../db/client.ts";
import { BulkDeleteInput } from "../../../shared/schemas.ts";

export const deleteRoute = new Hono();

// Bulk delete tasks (must be before /:id routes)
deleteRoute.delete(
  "/bulk",
  zValidator("json", BulkDeleteInput),
  async (c) => {
    const { ids } = c.req.valid("json");
    const db = await getDb();

    const placeholders = ids.map(() => "?").join(", ");
    const result = await db.execute({
      sql: `DELETE FROM tasks WHERE id IN (${placeholders})`,
      args: ids,
    });

    return c.json({ deleted: result.rowsAffected });
  },
);

// Delete single task (with subtask cascade)
deleteRoute.delete("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const db = await getDb();

  // Delete subtasks first (single level - subtasks cannot have subtasks)
  await db.execute({
    sql: "DELETE FROM tasks WHERE parent_id = ?",
    args: [id],
  });

  // Then delete the task itself
  await db.execute({
    sql: "DELETE FROM tasks WHERE id = ?",
    args: [id],
  });

  return c.json({ deleted: true });
});
