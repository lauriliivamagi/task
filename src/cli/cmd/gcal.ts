/**
 * Google Calendar sync commands.
 *
 * Commands for authenticating and syncing tasks to Google Calendar.
 */

import type { Argv } from "yargs";
import { isAuthenticated, logout, startAuthFlow } from "../../gcal/auth.ts";
import { createGcalClient } from "../../gcal/client.ts";
import {
  getUnsyncedTasksWithDueDates,
  syncTasksToCalendar,
  syncTaskToCalendar,
} from "../../gcal/sync.ts";
import { parseDueDate } from "../../shared/date-parser.ts";
import { getConfig, setGcalCalendarId } from "../../shared/config.ts";

// ========== gcal auth ==========
const authCommand = {
  command: "auth",
  describe: "Authenticate with Google Calendar",
  builder: (yargs: Argv) => yargs,
  handler: async () => {
    try {
      const authenticated = await isAuthenticated();
      if (authenticated) {
        console.log("Already authenticated with Google Calendar.");
        console.log("Run 'task gcal logout' first to re-authenticate.");
        return;
      }

      await startAuthFlow();
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`);
      Deno.exit(1);
    }
  },
};

// ========== gcal status ==========
interface StatusArgs {
  json?: boolean;
}

const statusCommand = {
  command: "status",
  describe: "Show Google Calendar authentication status",
  builder: (yargs: Argv) =>
    yargs.option("json", {
      type: "boolean",
      describe: "Output as JSON",
    }),
  handler: async (args: StatusArgs) => {
    try {
      const authenticated = await isAuthenticated();
      const config = await getConfig();
      const calendarId = config.gcal?.calendar_id ?? "primary";

      if (args.json) {
        console.log(
          JSON.stringify({
            authenticated,
            calendarId,
          }),
        );
        return;
      }

      if (authenticated) {
        console.log("Status: Authenticated");
        console.log(`Calendar: ${calendarId}`);
      } else {
        console.log("Status: Not authenticated");
        console.log("\nRun 'task gcal auth' to authenticate.");
      }
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`);
      Deno.exit(1);
    }
  },
};

// ========== gcal logout ==========
const logoutCommand = {
  command: "logout",
  describe: "Clear Google Calendar authentication",
  builder: (yargs: Argv) => yargs,
  handler: async () => {
    try {
      await logout();
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`);
      Deno.exit(1);
    }
  },
};

// ========== gcal calendars ==========
interface CalendarsArgs {
  json?: boolean;
}

const calendarsCommand = {
  command: "calendars",
  describe: "List available Google calendars",
  builder: (yargs: Argv) =>
    yargs.option("json", {
      type: "boolean",
      describe: "Output as JSON",
    }),
  handler: async (args: CalendarsArgs) => {
    try {
      const authenticated = await isAuthenticated();
      if (!authenticated) {
        console.error("Not authenticated. Run 'task gcal auth' first.");
        Deno.exit(1);
      }

      const client = createGcalClient();
      const calendars = await client.listCalendars();

      if (args.json) {
        console.log(JSON.stringify(calendars, null, 2));
        return;
      }

      console.log("Available calendars:\n");
      for (const cal of calendars) {
        const marker = cal.primary ? " (primary)" : "";
        console.log(`  ${cal.summary}${marker}`);
        console.log(`    ID: ${cal.id}`);
      }
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`);
      Deno.exit(1);
    }
  },
};

// ========== gcal use ==========
interface UseArgs {
  calendarId: string;
}

const useCommand = {
  command: "use <calendar-id>",
  describe: "Set the default calendar for syncing",
  builder: (yargs: Argv) =>
    yargs.positional("calendar-id", {
      type: "string",
      describe: "Calendar ID or name (use 'task gcal calendars' to list)",
      demandOption: true,
    }),
  handler: async (args: UseArgs) => {
    try {
      const authenticated = await isAuthenticated();
      if (!authenticated) {
        console.error("Not authenticated. Run 'task gcal auth' first.");
        Deno.exit(1);
      }

      // Verify the calendar exists
      const client = createGcalClient();
      const calendars = await client.listCalendars();

      // Find by ID or name (case-insensitive)
      const calendar = calendars.find(
        (c) =>
          c.id === args.calendarId ||
          c.summary.toLowerCase() === args.calendarId.toLowerCase(),
      );

      if (!calendar) {
        console.error(`Calendar not found: ${args.calendarId}`);
        console.log("\nAvailable calendars:");
        for (const cal of calendars) {
          console.log(`  ${cal.summary} (${cal.id})`);
        }
        Deno.exit(1);
      }

      // Save the calendar ID
      await setGcalCalendarId(calendar.id);
      console.log(`Default calendar set to: ${calendar.summary}`);
      console.log(`Calendar ID: ${calendar.id}`);
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`);
      Deno.exit(1);
    }
  },
};

// ========== gcal sync ==========
interface SyncArgs {
  taskId?: number;
  all?: boolean;
  duration?: number;
  calendar?: string;
  datetime?: string;
  attach?: string;
}

const syncCommand = {
  command: "sync [task-id]",
  describe: "Sync task(s) to Google Calendar",
  builder: (yargs: Argv) =>
    yargs
      .positional("task-id", {
        type: "number",
        describe: "Task ID to sync",
      })
      .option("all", {
        type: "boolean",
        describe: "Sync all tasks with due dates",
      })
      .option("duration", {
        alias: "d",
        type: "number",
        describe: "Event duration in hours (default: 1)",
      })
      .option("calendar", {
        alias: "c",
        type: "string",
        describe: "Target calendar ID",
      })
      .option("datetime", {
        type: "string",
        describe: "Override/provide due datetime (e.g., 'tomorrow 14:00')",
      })
      .option("attach", {
        type: "string",
        describe: "Attach to existing server URL",
      }),
  handler: async (args: SyncArgs) => {
    try {
      const authenticated = await isAuthenticated();
      if (!authenticated) {
        console.error("Not authenticated. Run 'task gcal auth' first.");
        Deno.exit(1);
      }

      // Resolve natural language datetime if provided
      let dueDate: string | undefined;
      if (args.datetime) {
        dueDate = parseDueDate(args.datetime) ?? undefined;
        if (!dueDate) {
          console.error(`Could not parse datetime: ${args.datetime}`);
          Deno.exit(1);
        }
      }

      // Get default calendar from config if not specified
      const config = await getConfig();
      const calendarId = args.calendar ?? config.gcal?.calendar_id;

      if (args.all) {
        // Sync all tasks with due dates
        const tasks = await getUnsyncedTasksWithDueDates();

        if (tasks.length === 0) {
          console.log("No unsynced tasks with due dates found.");
          return;
        }

        console.log(`Found ${tasks.length} tasks to sync:\n`);

        const results = await syncTasksToCalendar(
          tasks.map((t) => t.id),
          {
            durationHours: args.duration,
            calendarId,
          },
        );

        let created = 0;
        let updated = 0;
        let failed = 0;

        for (let i = 0; i < results.length; i++) {
          const task = tasks[i];
          const result = results[i];

          if (result.success) {
            const icon = result.action === "created" ? "+" : "~";
            console.log(`  ${icon} #${task.id} ${task.title}`);
            if (result.action === "created") created++;
            else updated++;
          } else {
            console.log(`  ✗ #${task.id} ${task.title}: ${result.error}`);
            failed++;
          }
        }

        console.log();
        console.log(
          `Created: ${created}, Updated: ${updated}, Failed: ${failed}`,
        );
      } else if (args.taskId) {
        // Sync single task
        const result = await syncTaskToCalendar({
          taskId: args.taskId,
          durationHours: args.duration,
          calendarId,
          dueDate,
        });

        if (result.success) {
          const action = result.action === "created" ? "Created" : "Updated";
          console.log(`${action} calendar event for task #${args.taskId}`);
          if (result.eventUrl) {
            console.log(`Event URL: ${result.eventUrl}`);
          }
        } else {
          console.error(`Failed to sync: ${result.error}`);
          Deno.exit(1);
        }
      } else {
        // No task specified - show help
        console.log("Usage:");
        console.log("  task gcal sync <task-id>  # Sync single task");
        console.log(
          "  task gcal sync --all      # Sync all tasks with due dates",
        );
        console.log("\nOptions:");
        console.log("  --duration, -d <hours>    Event duration (default: 1)");
        console.log("  --calendar, -c <id>       Target calendar ID");
        console.log("  --datetime <datetime>     Override due datetime");
        Deno.exit(1);
      }
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`);
      Deno.exit(1);
    }
  },
};

// ========== Main gcal command ==========
export const gcalCommand = {
  command: "gcal <command>",
  describe: "Google Calendar sync",
  builder: (yargs: Argv) =>
    yargs
      .command(authCommand)
      .command(statusCommand)
      .command(logoutCommand)
      .command(calendarsCommand)
      .command(useCommand)
      .command(syncCommand)
      .demandCommand(1, "Please specify a gcal command"),
  handler: () => {
    // This is handled by subcommands
  },
};
