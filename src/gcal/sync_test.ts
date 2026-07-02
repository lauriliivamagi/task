/**
 * Google Calendar sync tests.
 *
 * Uses an injected fake calendar client — no network, no OAuth.
 */

import { assertEquals } from "@std/assert";
import {
  getDb,
  initDb,
  resetDbClient,
  runAllMigrations,
} from "../db/client.ts";
import { CalendarApiError, type GcalClient } from "./client.ts";
import { syncTaskToCalendar } from "./sync.ts";

function fakeClient(overrides: Partial<GcalClient> = {}): GcalClient {
  return {
    createEvent: (_calendarId, event) =>
      Promise.resolve({ ...event, id: "new-event-id" }),
    updateEvent: (_calendarId, eventId, event) =>
      Promise.resolve({ ...event, id: eventId }),
    deleteEvent: () => Promise.resolve(),
    getEvent: () => Promise.resolve(null),
    listCalendars: () => Promise.resolve([]),
    ...overrides,
  };
}

async function setupTask(gcalEventId: string | null): Promise<number> {
  const db = await initDb();
  await runAllMigrations(db);
  const result = await db.execute({
    sql: `INSERT INTO tasks (title, due_date, gcal_event_id)
          VALUES ('Sync test task', '2025-06-01T10:00:00Z', ?) RETURNING id`,
    args: [gcalEventId],
  });
  return Number(result.rows[0].id);
}

Deno.test({
  name: "gcal sync - rejects out-of-bounds durations before any work",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    for (const duration of [-1, 0, 25, Infinity, NaN]) {
      const result = await syncTaskToCalendar({
        taskId: 1,
        durationHours: duration,
        // Auth/client must never be reached for invalid input
        checkAuth: () => Promise.reject(new Error("must not be called")),
      });
      assertEquals(result.success, false, `duration ${duration}`);
      assertEquals(result.action, "skipped");
      assertEquals(result.error?.includes("Invalid duration"), true);
    }
  },
});

Deno.test({
  name: "gcal sync - recreates event when stored event was deleted (410)",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    resetDbClient();
    Deno.env.set("TASK_CLI_DB_URL", ":memory:");
    try {
      const taskId = await setupTask("dead-event-id");

      const result = await syncTaskToCalendar({
        taskId,
        checkAuth: () => Promise.resolve(true),
        client: fakeClient({
          updateEvent: () =>
            Promise.reject(new CalendarApiError(410, "Resource deleted")),
        }),
      });

      assertEquals(result.success, true);
      assertEquals(result.action, "created");
      assertEquals(result.eventId, "new-event-id");

      // Task now points at the fresh event
      const db = await getDb();
      const row = await db.execute({
        sql: "SELECT gcal_event_id FROM tasks WHERE id = ?",
        args: [taskId],
      });
      assertEquals(row.rows[0].gcal_event_id, "new-event-id");
    } finally {
      Deno.env.delete("TASK_CLI_DB_URL");
      resetDbClient();
    }
  },
});

Deno.test({
  name: "gcal sync - non-recoverable API errors still fail the sync",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    resetDbClient();
    Deno.env.set("TASK_CLI_DB_URL", ":memory:");
    try {
      const taskId = await setupTask("some-event-id");

      const result = await syncTaskToCalendar({
        taskId,
        checkAuth: () => Promise.resolve(true),
        client: fakeClient({
          updateEvent: () =>
            Promise.reject(new CalendarApiError(500, "Server error")),
        }),
      });

      assertEquals(result.success, false);
      assertEquals(result.action, "skipped");
      assertEquals(result.error?.includes("500"), true);
    } finally {
      Deno.env.delete("TASK_CLI_DB_URL");
      resetDbClient();
    }
  },
});
