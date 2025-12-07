/**
 * Google Calendar API routes.
 *
 * Provides HTTP API for Google Calendar sync operations.
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { GcalBatchSyncInput, GcalSyncInput } from "../../shared/schemas.ts";
import { isAuthenticated } from "../../gcal/auth.ts";
import { createGcalClient } from "../../gcal/client.ts";
import {
  getSyncedTasks,
  getUnsyncedTasksWithDueDates,
  syncTasksToCalendar,
  syncTaskToCalendar,
  toSyncResponse,
} from "../../gcal/sync.ts";
import { getConfig } from "../../shared/config.ts";

export const gcalRoute = new Hono();

/**
 * GET /gcal/status
 * Get authentication status.
 */
gcalRoute.get("/status", async (c) => {
  const authenticated = await isAuthenticated();
  const config = await getConfig();

  return c.json({
    authenticated,
    calendarId: config.gcal?.calendar_id ?? "primary",
  });
});

/**
 * GET /gcal/calendars
 * List available calendars.
 */
gcalRoute.get("/calendars", async (c) => {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    return c.json({ error: "Not authenticated" }, 401);
  }

  try {
    const client = createGcalClient();
    const calendars = await client.listCalendars();
    return c.json({ calendars });
  } catch (error) {
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * POST /gcal/sync/:taskId
 * Sync a single task to Google Calendar.
 */
gcalRoute.post(
  "/sync/:taskId",
  zValidator("json", GcalSyncInput),
  async (c) => {
    const taskId = Number(c.req.param("taskId"));
    const input = c.req.valid("json");

    if (isNaN(taskId) || taskId <= 0) {
      return c.json({ error: "Invalid task ID" }, 400);
    }

    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return c.json({ error: "Not authenticated" }, 401);
    }

    try {
      const result = await syncTaskToCalendar({
        taskId,
        durationHours: input.durationHours,
        calendarId: input.calendarId,
        dueDate: input.dueDate,
      });

      if (result.success) {
        return c.json(toSyncResponse(result));
      } else {
        return c.json(toSyncResponse(result), 400);
      }
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  },
);

/**
 * POST /gcal/sync/batch
 * Sync multiple tasks to Google Calendar.
 */
gcalRoute.post(
  "/sync/batch",
  zValidator("json", GcalBatchSyncInput),
  async (c) => {
    const input = c.req.valid("json");

    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return c.json({ error: "Not authenticated" }, 401);
    }

    try {
      const results = await syncTasksToCalendar(input.taskIds, {
        durationHours: input.durationHours,
        calendarId: input.calendarId,
      });

      const responses = results.map(toSyncResponse);
      const successCount = results.filter((r) => r.success).length;
      const failCount = results.length - successCount;

      return c.json({
        results: responses,
        summary: {
          total: results.length,
          success: successCount,
          failed: failCount,
        },
      });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  },
);

/**
 * GET /gcal/synced
 * List all tasks that have been synced to Google Calendar.
 */
gcalRoute.get("/synced", async (c) => {
  try {
    const tasks = await getSyncedTasks();
    return c.json({ tasks });
  } catch (error) {
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * GET /gcal/unsynced
 * List all tasks with due dates that haven't been synced yet.
 */
gcalRoute.get("/unsynced", async (c) => {
  try {
    const tasks = await getUnsyncedTasksWithDueDates();
    return c.json({ tasks });
  } catch (error) {
    return c.json({ error: String(error) }, 500);
  }
});
