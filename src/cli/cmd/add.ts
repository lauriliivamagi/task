import type { Argv } from "yargs";
import { runWithClient } from "../bootstrap.ts";
import { parseRecurrenceWithError } from "../../shared/recurrence-parser.ts";
import { parseDueDate } from "../../shared/date-parser.ts";
import { validateDuration } from "../../shared/validation.ts";

interface AddArgs {
  title: string;
  description?: string;
  project?: string;
  parent?: number;
  due?: string;
  tag?: string[];
  recurrence?: string;
  duration?: number;
  json?: boolean;
  attach?: string;
}

export const addCommand = {
  command: "add <title> [description]",
  describe: "Add a new task",
  builder: (yargs: Argv) =>
    yargs
      .positional("title", {
        type: "string",
        describe: "Task title",
        demandOption: true,
      })
      .positional("description", {
        type: "string",
        describe: "Task description",
      })
      .option("project", {
        alias: "p",
        type: "string",
        describe: "Project name",
      })
      .option("parent", {
        alias: "P",
        type: "number",
        describe: "Parent task ID",
      })
      .option("due", {
        alias: "d",
        type: "string",
        describe:
          'Due date/time (ISO: "2024-12-31" or "2024-12-31T14:00:00Z", or natural: "tomorrow at 14:00")',
      })
      .option("tag", {
        alias: "t",
        type: "array",
        string: true,
        describe: "Tags to assign (can be used multiple times)",
      })
      .option("recurrence", {
        alias: "r",
        type: "string",
        describe:
          'Recurrence rule (e.g., "every day", "every Monday", "monthly")',
      })
      .option("duration", {
        type: "number",
        describe: "Task duration in hours (0.25-24)",
      })
      .option("json", {
        type: "boolean",
        describe: "Output in JSON format",
      })
      .option("attach", {
        type: "string",
        describe: "Attach to existing server URL",
      }),
  handler: async (args: AddArgs) => {
    await runWithClient({ attach: args.attach }, async (client) => {
      // Parse recurrence if provided
      let recurrence = undefined;
      if (args.recurrence) {
        const parsed = parseRecurrenceWithError(args.recurrence);
        if (!parsed.rule) {
          console.error(parsed.error);
          Deno.exit(1);
        }
        recurrence = parsed.rule;
      }

      // Parse due date (supports ISO and natural language)
      let dueDate = undefined;
      if (args.due) {
        dueDate = parseDueDate(args.due);
        if (!dueDate) {
          console.error(
            `Invalid due date: "${args.due}". Try "2024-12-31", "2024-12-31T14:00:00Z", or "tomorrow at 14:00".`,
          );
          Deno.exit(1);
        }
      }

      // Validate duration if provided
      if (args.duration !== undefined) {
        const validation = validateDuration(args.duration);
        if (!validation.valid) {
          console.error(validation.error);
          Deno.exit(1);
        }
      }

      const task = await client.createTask({
        title: args.title,
        description: args.description,
        project: args.project,
        parent_id: args.parent,
        due_date: dueDate,
        tags: args.tag,
        recurrence,
        duration_hours: args.duration,
      });

      if (args.json) {
        console.log(JSON.stringify(task));
      } else {
        const tagInfo = args.tag && args.tag.length > 0
          ? ` [${args.tag.join(", ")}]`
          : "";
        const recurrenceInfo = args.recurrence ? ` (${args.recurrence})` : "";
        console.log(
          `Task created: #${task.id} ${task.title}${tagInfo}${recurrenceInfo}`,
        );
      }
    });
  },
};
