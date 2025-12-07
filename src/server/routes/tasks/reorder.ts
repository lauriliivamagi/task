/**
 * Task Reorder Route
 *
 * POST /tasks/:id/reorder - Move task up/down within its scope
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { getDb } from "../../../db/client.ts";
import { ReorderTaskInput } from "../../../shared/schemas.ts";

export const reorderRoute = new Hono();

reorderRoute.post(
  "/:id/reorder",
  zValidator("json", ReorderTaskInput),
  async (c) => {
    const id = Number(c.req.param("id"));
    const { direction } = c.req.valid("json");
    const db = await getDb();

    // Get the task to reorder
    const taskResult = await db.execute({
      sql: "SELECT id, parent_id, `order` FROM tasks WHERE id = ?",
      args: [id],
    });

    if (taskResult.rows.length === 0) {
      return c.json({ error: `Task #${id} not found` }, 404);
    }

    const task = taskResult.rows[0];
    const currentOrder = task.order as number;
    const parentId = task.parent_id as number | null;

    // Find the adjacent task in the specified direction within the same scope
    // Only consider non-done tasks (visible tasks) for reordering
    let adjacentResult;
    if (direction === "up") {
      // Find task with the next lower order value
      if (parentId !== null) {
        adjacentResult = await db.execute({
          sql: `SELECT id, \`order\` FROM tasks
                WHERE parent_id = ? AND \`order\` < ? AND status != 'done'
                ORDER BY \`order\` DESC LIMIT 1`,
          args: [parentId, currentOrder],
        });
      } else {
        adjacentResult = await db.execute({
          sql: `SELECT id, \`order\` FROM tasks
                WHERE parent_id IS NULL AND \`order\` < ? AND status != 'done'
                ORDER BY \`order\` DESC LIMIT 1`,
          args: [currentOrder],
        });
      }
    } else {
      // Find task with the next higher order value
      if (parentId !== null) {
        adjacentResult = await db.execute({
          sql: `SELECT id, \`order\` FROM tasks
                WHERE parent_id = ? AND \`order\` > ? AND status != 'done'
                ORDER BY \`order\` ASC LIMIT 1`,
          args: [parentId, currentOrder],
        });
      } else {
        adjacentResult = await db.execute({
          sql: `SELECT id, \`order\` FROM tasks
                WHERE parent_id IS NULL AND \`order\` > ? AND status != 'done'
                ORDER BY \`order\` ASC LIMIT 1`,
          args: [currentOrder],
        });
      }
    }

    // No adjacent task found (already at boundary)
    if (adjacentResult.rows.length === 0) {
      return c.json({ swapped: false, message: "Already at boundary" });
    }

    const adjacentTask = adjacentResult.rows[0];
    const adjacentId = adjacentTask.id as number;
    const adjacentOrder = adjacentTask.order as number;

    // Swap the order values
    await db.execute({
      sql:
        "UPDATE tasks SET `order` = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      args: [adjacentOrder, id],
    });
    await db.execute({
      sql:
        "UPDATE tasks SET `order` = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      args: [currentOrder, adjacentId],
    });

    return c.json({
      swapped: true,
      task: { id, order: adjacentOrder },
      swappedWith: { id: adjacentId, order: currentOrder },
    });
  },
);
