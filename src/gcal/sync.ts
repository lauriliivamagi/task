/**
 * Google Calendar sync logic.
 *
 * Syncs tasks to Google Calendar events:
 * - Creates new events for tasks without gcal_event_id
 * - Updates existing events for tasks with gcal_event_id
 * - Stores event ID back on task for future updates
 */

import { getDb, migrateGcalEventId } from "../db/client.ts";
import { logger } from "../shared/logger.ts";
import { assert, assertDefined, assertPositive } from "../shared/assert.ts";
import { type GcalConfig, getConfig } from "../shared/config.ts";
import {
  DEFAULT_GCAL_DURATION_HOURS,
  MAX_GCAL_BATCH_SYNC,
} from "../shared/limits.ts";
import type { GcalSyncResponse } from "../shared/schemas.ts";
import { isAuthenticated } from "./auth.ts";
import {
  calculateEndTime,
  type CalendarEvent,
  createGcalClient,
  getEventUrl,
} from "./client.ts";

export interface SyncOptions {
  taskId: number;
  durationHours?: number;
  calendarId?: string;
  dueDate?: string; // ISO datetime override for tasks without due_date
}

export interface SyncResult {
  success: boolean;
  eventId?: string;
  eventUrl?: string;
  error?: string;
  action: "created" | "updated" | "skipped";
}

export class GcalSyncError extends Error {
  constructor(
    message: string,
    public readonly taskId: number,
  ) {
    super(message);
    this.name = "GcalSyncError";
  }
}

/**
 * Get gcal config asynchronously.
 */
async function getGcalConfigAsync(): Promise<GcalConfig> {
  const config = await getConfig();
  return config.gcal ?? {
    calendar_id: "primary",
    default_duration_hours: DEFAULT_GCAL_DURATION_HOURS,
  };
}

/**
 * Sync a single task to Google Calendar.
 */
export async function syncTaskToCalendar(
  options: SyncOptions,
): Promise<SyncResult> {
  const { taskId, dueDate: dueDateOverride } = options;

  assertPositive(taskId, "Task ID must be positive", "gcal");

  // Check authentication
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return {
      success: false,
      error: "Not authenticated. Run 'task gcal auth' first.",
      action: "skipped",
    };
  }

  // Run migration if needed
  await migrateGcalEventId();

  // Get config
  const gcalConfig = await getGcalConfigAsync();
  const calendarId = options.calendarId ?? gcalConfig.calendar_id;

  // Fetch task from database
  const db = await getDb();
  const result = await db.execute({
    sql: `
      SELECT t.id, t.title, t.description, t.due_date, t.gcal_event_id,
             t.duration_hours, p.name as project_name
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE t.id = ?
    `,
    args: [taskId],
  });

  if (result.rows.length === 0) {
    return {
      success: false,
      error: `Task ${taskId} not found`,
      action: "skipped",
    };
  }

  const task = result.rows[0];
  assertDefined(task, "Task row must exist", "gcal");

  const title = task.title as string;
  const description = task.description as string | null;
  const dueDate = dueDateOverride ?? (task.due_date as string | null);
  const gcalEventId = task.gcal_event_id as string | null;
  const projectName = task.project_name as string | null;
  const taskDurationHours = task.duration_hours as number | null;

  // Priority: options.durationHours > task.duration_hours > config default
  const durationHours = options.durationHours ??
    taskDurationHours ??
    gcalConfig.default_duration_hours;

  // Check for due date
  if (!dueDate) {
    return {
      success: false,
      error:
        `Task "${title}" has no due date. Provide --datetime to specify one.`,
      action: "skipped",
    };
  }

  // Build event summary with project prefix
  const eventSummary = projectName ? `[${projectName}] ${title}` : title;

  // Build event
  const event: CalendarEvent = {
    summary: eventSummary,
    description: description ?? undefined,
    start: {
      dateTime: dueDate,
    },
    end: {
      dateTime: calculateEndTime(dueDate, durationHours),
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: "popup", minutes: 5 },
      ],
    },
  };

  const client = createGcalClient();

  try {
    let resultEvent: CalendarEvent;
    let action: "created" | "updated";

    if (gcalEventId) {
      // Update existing event
      logger.info(`Updating event ${gcalEventId} for task ${taskId}`, "gcal");
      resultEvent = await client.updateEvent(calendarId, gcalEventId, event);
      action = "updated";
    } else {
      // Create new event
      logger.info(`Creating event for task ${taskId}`, "gcal");
      resultEvent = await client.createEvent(calendarId, event);
      action = "created";
    }

    // Compute the event URL
    assertDefined(resultEvent.id, "Event must have ID", "gcal");
    const eventUrl = resultEvent.htmlLink ??
      getEventUrl(resultEvent.id, calendarId);

    // Store event ID, URL, and duration on task (for both create and update)
    await db.execute({
      sql:
        "UPDATE tasks SET gcal_event_id = ?, gcal_event_url = ?, duration_hours = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      args: [resultEvent.id, eventUrl, durationHours, taskId],
    });

    return {
      success: true,
      eventId: resultEvent.id,
      eventUrl,
      action,
    };
  } catch (error) {
    logger.error(`Failed to sync task ${taskId}: ${error}`, "gcal");
    return {
      success: false,
      error: String(error),
      action: "skipped",
    };
  }
}

/**
 * Sync multiple tasks to Google Calendar.
 */
export async function syncTasksToCalendar(
  taskIds: number[],
  options?: Partial<Omit<SyncOptions, "taskId">>,
): Promise<SyncResult[]> {
  assert(taskIds.length > 0, "Must provide at least one task ID", "gcal");
  assert(
    taskIds.length <= MAX_GCAL_BATCH_SYNC,
    `Cannot sync more than ${MAX_GCAL_BATCH_SYNC} tasks at once`,
    "gcal",
  );

  const results: SyncResult[] = [];

  for (const taskId of taskIds) {
    const result = await syncTaskToCalendar({
      taskId,
      ...options,
    });
    results.push(result);
  }

  return results;
}

/**
 * Get all tasks that have been synced to Google Calendar.
 */
export async function getSyncedTasks(): Promise<
  Array<{ id: number; title: string; gcal_event_id: string }>
> {
  await migrateGcalEventId();
  const db = await getDb();

  const result = await db.execute(
    "SELECT id, title, gcal_event_id FROM tasks WHERE gcal_event_id IS NOT NULL",
  );

  return result.rows.map((row) => ({
    id: row.id as number,
    title: row.title as string,
    gcal_event_id: row.gcal_event_id as string,
  }));
}

/**
 * Get all tasks with due dates that are not yet synced.
 */
export async function getUnsyncedTasksWithDueDates(): Promise<
  Array<{ id: number; title: string; due_date: string }>
> {
  await migrateGcalEventId();
  const db = await getDb();

  const result = await db.execute(
    "SELECT id, title, due_date FROM tasks WHERE due_date IS NOT NULL AND gcal_event_id IS NULL",
  );

  return result.rows.map((row) => ({
    id: row.id as number,
    title: row.title as string,
    due_date: row.due_date as string,
  }));
}

/**
 * Convert SyncResult to GcalSyncResponse schema type.
 */
export function toSyncResponse(result: SyncResult): GcalSyncResponse {
  return {
    success: result.success,
    eventId: result.eventId,
    eventUrl: result.eventUrl,
    action: result.action,
    error: result.error,
  };
}
