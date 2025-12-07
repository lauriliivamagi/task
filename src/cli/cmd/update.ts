import type { Argv } from "yargs";
import { runWithClient } from "../bootstrap.ts";
import type { TaskStatus } from "../../shared/schemas.ts";
import {
  formatRecurrence,
  parseRecurrenceWithError,
} from "../../shared/recurrence-parser.ts";
import { parseDueDate } from "../../shared/date-parser.ts";
import { validateDuration } from "../../shared/validation.ts";

interface UpdateArgs {
  id: number;
  title?: string;
  description?: string;
  status?: string;
  priority?: number;
  due?: string;
  project?: string;
  "clear-project"?: boolean;
  recurrence?: string;
  "clear-recurrence"?: boolean;
  duration?: number;
  "clear-duration"?: boolean;
  json?: boolean;
  attach?: string;
}

export const updateCommand = {
  command: "update <id>",
  describe: "Update a task",
  builder: (yargs: Argv) =>
    yargs
      .positional("id", {
        type: "number",
        describe: "Task ID",
        demandOption: true,
      })
      .option("title", {
        alias: "t",
        type: "string",
        describe: "New title",
      })
      .option("description", {
        alias: "D",
        type: "string",
        describe: "New description",
      })
      .option("status", {
        alias: "s",
        type: "string",
        describe: "New status (todo, in-progress, done)",
        choices: ["todo", "in-progress", "done"],
      })
      .option("priority", {
        alias: "p",
        type: "number",
        describe: "New priority (0: normal, 1: high, 2: urgent)",
        choices: [0, 1, 2],
      })
      .option("due", {
        alias: "d",
        type: "string",
        describe:
          'New due date/time (ISO: "2024-12-31" or "2024-12-31T14:00:00Z", or natural: "tomorrow at 14:00")',
      })
      .option("project", {
        type: "string",
        describe: "Move task to project (creates project if needed)",
      })
      .option("clear-project", {
        type: "boolean",
        describe: "Remove task from its project",
      })
      .option("recurrence", {
        alias: "r",
        type: "string",
        describe:
          'Recurrence rule (e.g., "every day", "every Monday", "monthly")',
      })
      .option("clear-recurrence", {
        type: "boolean",
        describe: "Remove recurrence from task",
      })
      .option("duration", {
        type: "number",
        describe: "Task duration in hours (0.25-24)",
      })
      .option("clear-duration", {
        type: "boolean",
        describe: "Remove duration from task",
      })
      .option("json", {
        type: "boolean",
        describe: "Output in JSON format",
      })
      .option("attach", {
        type: "string",
        describe: "Attach to existing server URL",
      }),
  handler: async (args: UpdateArgs) => {
    if (
      args.title === undefined &&
      args.description === undefined &&
      args.status === undefined &&
      args.priority === undefined &&
      args.due === undefined &&
      args.project === undefined &&
      !args["clear-project"] &&
      args.recurrence === undefined &&
      !args["clear-recurrence"] &&
      args.duration === undefined &&
      !args["clear-duration"]
    ) {
      console.log("No updates specified.");
      return;
    }

    await runWithClient({ attach: args.attach }, async (client) => {
      // Parse recurrence if provided
      let recurrence:
        | ReturnType<typeof parseRecurrenceWithError>["rule"]
        | null
        | undefined = undefined;
      if (args["clear-recurrence"]) {
        recurrence = null; // null to remove
      } else if (args.recurrence) {
        const parsed = parseRecurrenceWithError(args.recurrence);
        if (!parsed.rule) {
          console.error(parsed.error);
          Deno.exit(1);
        }
        recurrence = parsed.rule;
      }

      // Parse due date (supports ISO and natural language)
      let dueDate: string | null | undefined = undefined;
      if (args.due) {
        dueDate = parseDueDate(args.due);
        if (!dueDate) {
          console.error(
            `Invalid due date: "${args.due}". Try "2024-12-31", "2024-12-31T14:00:00Z", or "tomorrow at 14:00".`,
          );
          Deno.exit(1);
        }
      }

      // Resolve project name to ID (or null to remove)
      let projectId: number | null | undefined = undefined;
      if (args["clear-project"]) {
        projectId = null;
      } else if (args.project) {
        const projects = await client.listProjects();
        const existing = projects.find((p) => p.name === args.project);
        if (existing) {
          projectId = existing.id;
        } else {
          const created = await client.createProject({ name: args.project });
          projectId = created.id;
        }
      }

      // Handle duration
      let durationHours: number | null | undefined = undefined;
      if (args["clear-duration"]) {
        durationHours = null;
      } else if (args.duration !== undefined) {
        const validation = validateDuration(args.duration);
        if (!validation.valid) {
          console.error(validation.error);
          Deno.exit(1);
        }
        durationHours = args.duration;
      }

      const task = await client.updateTask(args.id, {
        title: args.title,
        description: args.description,
        status: args.status as TaskStatus | undefined,
        priority: args.priority,
        due_date: dueDate,
        project_id: projectId,
        recurrence,
        duration_hours: durationHours,
      });

      if (args.json) {
        console.log(JSON.stringify(task));
      } else {
        let message = `Task #${args.id} updated.`;

        // Show next task ID if a recurring task was created
        if ("recurring_next_task_id" in task && task.recurring_next_task_id) {
          message +=
            ` Next recurring task created: #${task.recurring_next_task_id}`;
        }

        // Show recurrence info if it was changed
        if (args.recurrence && recurrence) {
          message += ` Recurrence: ${formatRecurrence(recurrence)}`;
        } else if (args["clear-recurrence"]) {
          message += " Recurrence removed.";
        }

        console.log(message);
      }
    });
  },
};
