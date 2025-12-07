/**
 * Recurrence Handler
 *
 * Handles the recreation of recurring tasks when they are completed.
 * Creates a new task instance with the same properties and calculates
 * the next due date based on the recurrence rule.
 */

import type { Client } from "@libsql/client/node";
import type { RecurrenceRule } from "./schemas.ts";
import { calculateNextDueDate } from "./recurrence-calculator.ts";
import { logger } from "./logger.ts";

/**
 * Result of handling a recurring task completion.
 */
export interface RecurrenceResult {
  /** ID of the newly created task, or null if no task was created */
  newTaskId: number | null;
  /** Error message if creation failed */
  error?: string;
  /** Whether the new task was synced to Google Calendar */
  gcalSynced?: boolean;
  /** Google Calendar event ID of the new task */
  gcalEventId?: string;
  /** Whether the new task should be synced to Google Calendar (original had gcal link) */
  shouldSyncToGcal?: boolean;
}

/**
 * Handle the completion of a recurring task.
 *
 * When a recurring task is marked as done, this function:
 * 1. Validates the task is a top-level recurring task
 * 2. Calculates the next due date
 * 3. Creates a new task with all fields copied
 * 4. Recreates all subtasks (with todo status)
 * 5. Copies all tags
 *
 * @param db - Database client
 * @param taskId - ID of the completed task
 * @returns Object with newTaskId (or null if not recurring/failed)
 */
export async function handleRecurringTaskCompletion(
  db: Client,
  taskId: number,
): Promise<RecurrenceResult> {
  // Fetch the completed task
  const taskResult = await db.execute({
    sql: `
      SELECT id, project_id, parent_id, title, description, status, priority,
             due_date, \`order\`, context, recurrence, duration_hours,
             gcal_event_id
      FROM tasks WHERE id = ?
    `,
    args: [taskId],
  });

  if (taskResult.rows.length === 0) {
    return { newTaskId: null, error: "Task not found" };
  }

  const task = taskResult.rows[0];

  // Only process top-level tasks with recurrence
  if (task.parent_id !== null) {
    return { newTaskId: null }; // Subtasks cannot be recurring
  }

  if (!task.recurrence) {
    return { newTaskId: null }; // Task is not recurring
  }

  // Parse recurrence rule
  let rule: RecurrenceRule;
  try {
    rule = typeof task.recurrence === "string"
      ? JSON.parse(task.recurrence)
      : task.recurrence;
  } catch {
    logger.warn(
      "Invalid recurrence JSON, treating as non-recurring",
      "recurrence",
      {
        taskId,
      },
    );
    return { newTaskId: null, error: "Invalid recurrence rule" };
  }

  // Calculate the next due date
  const nextDueDate = calculateNextDueDate(
    task.due_date as string | null,
    rule,
  );

  // Get all tags from the original task
  const tagsResult = await db.execute({
    sql: `
      SELECT t.id, t.name FROM tags t
      INNER JOIN task_tags tt ON t.id = tt.tag_id
      WHERE tt.task_id = ?
    `,
    args: [taskId],
  });
  const tags = tagsResult.rows.map((row) => ({
    id: row.id as number,
    name: row.name as string,
  }));

  // Get all subtasks (with their tags)
  const subtasksResult = await db.execute({
    sql: `
      SELECT id, title, description, priority, due_date, context, \`order\`
      FROM tasks WHERE parent_id = ?
      ORDER BY \`order\` ASC
    `,
    args: [taskId],
  });

  // Collect subtask tags
  const subtaskTags = new Map<number, Array<{ id: number; name: string }>>();
  for (const subtask of subtasksResult.rows) {
    const subTagsResult = await db.execute({
      sql: `
        SELECT t.id, t.name FROM tags t
        INNER JOIN task_tags tt ON t.id = tt.tag_id
        WHERE tt.task_id = ?
      `,
      args: [subtask.id],
    });
    subtaskTags.set(
      subtask.id as number,
      subTagsResult.rows.map((row) => ({
        id: row.id as number,
        name: row.name as string,
      })),
    );
  }

  // Calculate next order value for new top-level task
  const orderResult = await db.execute({
    sql:
      "SELECT COALESCE(MAX(`order`), -1) + 1 as next_order FROM tasks WHERE parent_id IS NULL",
    args: [],
  });
  const nextOrder = orderResult.rows[0].next_order as number;

  // Create the new recurring task
  const newTaskResult = await db.execute({
    sql: `
      INSERT INTO tasks (
        project_id, parent_id, title, description, status, priority,
        due_date, context, \`order\`, recurrence, duration_hours
      ) VALUES (?, NULL, ?, ?, 'todo', ?, ?, ?, ?, ?, ?)
      RETURNING id
    `,
    args: [
      task.project_id,
      task.title,
      task.description,
      task.priority,
      nextDueDate,
      task.context,
      nextOrder,
      typeof rule === "string" ? rule : JSON.stringify(rule),
      task.duration_hours,
    ],
  });

  const newTaskId = newTaskResult.rows[0].id as number;

  // Copy tags to new task
  for (const tag of tags) {
    await db.execute({
      sql: "INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?, ?)",
      args: [newTaskId, tag.id],
    });
  }

  // Recreate subtasks (all with 'todo' status)
  for (const subtask of subtasksResult.rows) {
    const newSubtaskResult = await db.execute({
      sql: `
        INSERT INTO tasks (
          project_id, parent_id, title, description, status, priority,
          due_date, context, \`order\`
        ) VALUES (?, ?, ?, ?, 'todo', ?, ?, ?, ?)
        RETURNING id
      `,
      args: [
        task.project_id,
        newTaskId,
        subtask.title,
        subtask.description,
        subtask.priority,
        subtask.due_date, // Copy due_date as-is
        subtask.context,
        subtask.order,
      ],
    });

    const newSubtaskId = newSubtaskResult.rows[0].id as number;

    // Copy tags to new subtask
    const subTags = subtaskTags.get(subtask.id as number) ?? [];
    for (const tag of subTags) {
      await db.execute({
        sql: "INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?, ?)",
        args: [newSubtaskId, tag.id],
      });
    }
  }

  // Check if the original task was synced to Google Calendar
  const hadGcalSync = task.gcal_event_id !== null;

  logger.info("Created next recurring task instance", "recurrence", {
    originalTaskId: taskId,
    newTaskId,
    nextDueDate,
    hadGcalSync,
  });

  return { newTaskId, gcalSynced: false, shouldSyncToGcal: hadGcalSync };
}
