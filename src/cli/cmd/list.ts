import type { Argv } from "yargs";
import { runWithClient } from "../bootstrap.ts";
import type { TaskStatus } from "../../shared/schemas.ts";

interface ListArgs {
  all?: boolean;
  project?: string;
  q?: string;
  dueBefore?: string;
  dueAfter?: string;
  overdue?: boolean;
  priority?: number;
  status?: string;
  tag?: string;
  semantic?: string;
  limit?: number;
  json?: boolean;
  attach?: string;
}

export const listCommand = {
  command: "list",
  describe: "List tasks",
  builder: (yargs: Argv) =>
    yargs
      .option("all", {
        alias: "a",
        type: "boolean",
        describe: "Show all tasks (including done)",
      })
      .option("project", {
        alias: "p",
        type: "string",
        describe: "Filter by project",
      })
      .option("q", {
        alias: "search",
        type: "string",
        describe: "Search in title and description",
      })
      .option("due-before", {
        type: "string",
        describe: "Tasks due before date (YYYY-MM-DD)",
      })
      .option("due-after", {
        type: "string",
        describe: "Tasks due after date (YYYY-MM-DD)",
      })
      .option("overdue", {
        type: "boolean",
        describe: "Show only overdue tasks",
      })
      .option("priority", {
        type: "number",
        choices: [0, 1, 2],
        describe: "Filter by priority (0=normal, 1=high, 2=urgent)",
      })
      .option("status", {
        type: "string",
        choices: ["todo", "in-progress", "done"],
        describe: "Filter by status",
      })
      .option("tag", {
        alias: "t",
        type: "string",
        describe: "Filter by tag",
      })
      .option("semantic", {
        alias: "s",
        type: "string",
        describe: "Semantic search query (requires embedding provider)",
      })
      .option("limit", {
        alias: "n",
        type: "number",
        default: 10,
        describe: "Limit results (used with semantic search)",
      })
      .option("json", {
        type: "boolean",
        describe: "Output in JSON format",
      })
      .option("attach", {
        type: "string",
        describe: "Attach to existing server URL",
      }),
  handler: async (args: ListArgs) => {
    await runWithClient({ attach: args.attach }, async (client) => {
      const tasks = await client.listTasks({
        all: args.all,
        project: args.project,
        q: args.q,
        due_before: args.dueBefore,
        due_after: args.dueAfter,
        overdue: args.overdue,
        priority: args.priority,
        status: args.status as TaskStatus | undefined,
        tag: args.tag,
        semantic: args.semantic,
        limit: args.limit,
      });

      if (args.json) {
        console.log(JSON.stringify(tasks));
      } else {
        if (tasks.length === 0) {
          console.log("No tasks found.");
          return;
        }

        const pad = (s: string | null | undefined, n: number) =>
          String(s ?? "-").padEnd(n);
        console.log(
          `${pad("ID", 5)} ${pad("Status", 12)} ${pad("Priority", 9)} ${
            pad(
              "Due",
              12,
            )
          } ${pad("Project", 15)} Title`,
        );
        console.log(
          `${pad("--", 5)} ${pad("------", 12)} ${pad("--------", 9)} ${
            pad(
              "---",
              12,
            )
          } ${pad("-------", 15)} -----`,
        );

        for (const row of tasks) {
          const priority = row.priority === 2
            ? "Urgent"
            : row.priority === 1
            ? "High"
            : "Normal";
          console.log(
            `${pad(String(row.id), 5)} ${pad(String(row.status), 12)} ${
              pad(
                priority,
                9,
              )
            } ${pad(row.due_date, 12)} ${
              pad(row.project_name, 15)
            } ${row.title}`,
          );
        }
      }
    });
  },
};
