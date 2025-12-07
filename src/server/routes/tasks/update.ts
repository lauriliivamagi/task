/**
 * Task Update Routes
 *
 * PATCH /tasks/:id - Update single task
 * PATCH /tasks/bulk - Bulk update multiple tasks
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { getDb } from "../../../db/client.ts";
import { BulkUpdateInput, UpdateTaskInput } from "../../../shared/schemas.ts";
import { getEmbeddingService } from "../../../embeddings/service.ts";
import { normalizeDateToDateTime } from "../../../shared/date-parser.ts";
import { handleRecurringTaskCompletion } from "../../../shared/recurrence-handler.ts";
import { syncTaskToCalendar } from "../../../gcal/sync.ts";
import { logger } from "../../../shared/logger.ts";
import { parseTaskJsonFields } from "./helpers.ts";

export const updateRoute = new Hono();

// Bulk update tasks (must be before /:id routes)
updateRoute.patch(
  "/bulk",
  zValidator("json", BulkUpdateInput),
  async (c) => {
    const { ids, update } = c.req.valid("json");
    const db = await getDb();

    const updates: string[] = [];
    const args: (string | number | null)[] = [];

    // Handle completed_at when status changes
    if (update.status !== undefined) {
      updates.push("status = ?");
      args.push(update.status);

      if (update.status === "done") {
        // Set completed_at only for tasks transitioning to done
        updates.push(
          "completed_at = CASE WHEN status != 'done' THEN CURRENT_TIMESTAMP ELSE completed_at END",
        );
      } else {
        // Clear completed_at when transitioning away from done
        updates.push("completed_at = NULL");
      }
    }
    if (update.priority !== undefined) {
      updates.push("priority = ?");
      args.push(update.priority);
    }
    if (update.due_date !== undefined) {
      updates.push("due_date = ?");
      args.push(
        update.due_date ? normalizeDateToDateTime(update.due_date) : null,
      );
    }
    if (update.title !== undefined) {
      updates.push("title = ?");
      args.push(update.title);
    }
    if (update.description !== undefined) {
      updates.push("description = ?");
      args.push(update.description);
    }
    if (update.project_id !== undefined) {
      updates.push("project_id = ?");
      args.push(update.project_id);
    }
    if (update.order !== undefined) {
      updates.push("`order` = ?");
      args.push(update.order);
    }
    if (update.duration_hours !== undefined) {
      updates.push("duration_hours = ?");
      args.push(update.duration_hours);
    }

    if (updates.length === 0) {
      return c.json({ error: "No updates specified" }, 400);
    }

    updates.push("updated_at = CURRENT_TIMESTAMP");

    const placeholders = ids.map(() => "?").join(", ");
    const sql = `
      UPDATE tasks
      SET ${updates.join(", ")}
      WHERE id IN (${placeholders})
      RETURNING *
    `;

    const result = await db.execute({ sql, args: [...args, ...ids] });
    return c.json(result.rows);
  },
);

// Update single task
updateRoute.patch(
  "/:id",
  zValidator("json", UpdateTaskInput),
  async (c) => {
    const id = Number(c.req.param("id"));
    const input = c.req.valid("json");
    const db = await getDb();

    const updates: string[] = [];
    const args: (string | number | null)[] = [];

    // Handle completed_at when status changes
    if (input.status !== undefined) {
      updates.push("status = ?");
      args.push(input.status);

      if (input.status === "done") {
        // Check if task is not already done (to set completed_at only on transition)
        const currentTask = await db.execute({
          sql: "SELECT status FROM tasks WHERE id = ?",
          args: [id],
        });
        if (
          currentTask.rows.length > 0 && currentTask.rows[0].status !== "done"
        ) {
          updates.push("completed_at = CURRENT_TIMESTAMP");
        }
      } else {
        // Transitioning away from done - clear completed_at
        updates.push("completed_at = NULL");
      }
    }
    if (input.priority !== undefined) {
      updates.push("priority = ?");
      args.push(input.priority);
    }
    if (input.due_date !== undefined) {
      updates.push("due_date = ?");
      args.push(
        input.due_date ? normalizeDateToDateTime(input.due_date) : null,
      );
    }
    if (input.title !== undefined) {
      updates.push("title = ?");
      args.push(input.title);
    }
    if (input.description !== undefined) {
      updates.push("description = ?");
      args.push(input.description);
    }
    if (input.project_id !== undefined) {
      updates.push("project_id = ?");
      args.push(input.project_id);
    }
    if (input.order !== undefined) {
      updates.push("`order` = ?");
      args.push(input.order);
    }
    if (input.context !== undefined) {
      updates.push("context = ?");
      args.push(JSON.stringify(input.context));
    }
    if (input.recurrence !== undefined) {
      // Check that subtasks cannot have recurrence
      const taskCheck = await db.execute({
        sql: "SELECT parent_id FROM tasks WHERE id = ?",
        args: [id],
      });
      if (taskCheck.rows.length > 0 && taskCheck.rows[0].parent_id !== null) {
        return c.json(
          {
            error:
              "Subtasks cannot have recurrence. Only top-level tasks can be recurring.",
          },
          400,
        );
      }
      updates.push("recurrence = ?");
      args.push(input.recurrence ? JSON.stringify(input.recurrence) : null);
    }
    if (input.duration_hours !== undefined) {
      updates.push("duration_hours = ?");
      args.push(input.duration_hours);
    }

    if (updates.length === 0) {
      const result = await db.execute({
        sql: "SELECT * FROM tasks WHERE id = ?",
        args: [id],
      });
      if (result.rows.length === 0) {
        return c.json({ error: `Task #${id} not found` }, 404);
      }
      return c.json(result.rows[0]);
    }

    updates.push("updated_at = CURRENT_TIMESTAMP");
    args.push(id);

    const sql = `UPDATE tasks SET ${
      updates.join(", ")
    } WHERE id = ? RETURNING *`;
    const result = await db.execute({ sql, args });

    if (result.rows.length === 0) {
      return c.json({ error: `Task #${id} not found` }, 404);
    }

    const task = parseTaskJsonFields(result.rows[0]);

    // Handle recurring task completion - create next instance
    let nextTaskId: number | null = null;
    let gcalEventId: string | undefined;
    if (input.status === "done") {
      const recurrenceResult = await handleRecurringTaskCompletion(db, id);
      nextTaskId = recurrenceResult.newTaskId;

      // Auto-sync to Google Calendar if original task was synced
      if (recurrenceResult.shouldSyncToGcal && recurrenceResult.newTaskId) {
        try {
          const syncResult = await syncTaskToCalendar({
            taskId: recurrenceResult.newTaskId,
          });
          if (syncResult.success) {
            gcalEventId = syncResult.eventId;
            logger.info(
              "Auto-synced recurring task to Google Calendar",
              "tasks",
              {
                newTaskId: recurrenceResult.newTaskId,
                eventId: syncResult.eventId,
              },
            );
          }
        } catch (err) {
          // Don't fail the whole request if gcal sync fails
          logger.warn(
            "Failed to auto-sync recurring task to calendar",
            "tasks",
            {
              newTaskId: recurrenceResult.newTaskId,
              error: String(err),
            },
          );
        }
      }
    }

    // Regenerate embedding if title or description changed
    if (input.title !== undefined || input.description !== undefined) {
      const embeddingService = getEmbeddingService();
      embeddingService
        .embedTask(
          id,
          task.title as string,
          task.description as string | null,
        )
        .catch((err) => console.error("Failed to re-embed task:", err));
    }

    // Include nextTaskId and gcal info in response if a recurring task was created
    if (nextTaskId !== null) {
      return c.json({
        ...task,
        recurring_next_task_id: nextTaskId,
        ...(gcalEventId && { recurring_next_gcal_event_id: gcalEventId }),
      });
    }

    return c.json(task);
  },
);
