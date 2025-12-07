import type { Argv } from "yargs";
import { runWithClient } from "../bootstrap.ts";
import type { TaskStatus } from "../../shared/schemas.ts";

interface BulkUpdateArgs {
  ids: number[];
  status?: string;
  priority?: number;
  json?: boolean;
  attach?: string;
}

interface BulkDeleteArgs {
  ids: number[];
  yes?: boolean;
  json?: boolean;
  attach?: string;
}

export const bulkCommand = {
  command: "bulk <action>",
  describe: "Bulk operations on tasks",
  builder: (yargs: Argv) =>
    yargs
      .command({
        command: "update <ids..>",
        describe: "Update multiple tasks at once",
        builder: (y: Argv) =>
          y
            .positional("ids", {
              type: "number",
              array: true,
              demandOption: true,
              describe: "Task IDs to update",
            })
            .option("status", {
              alias: "s",
              type: "string",
              choices: ["todo", "in-progress", "done"],
              describe: "Set status for all tasks",
            })
            .option("priority", {
              alias: "p",
              type: "number",
              choices: [0, 1, 2],
              describe: "Set priority for all tasks",
            })
            .option("json", {
              type: "boolean",
              describe: "Output in JSON format",
            })
            .option("attach", {
              type: "string",
              describe: "Attach to existing server URL",
            }),
        handler: async (args: BulkUpdateArgs) => {
          if (!args.status && args.priority === undefined) {
            console.error(
              "Error: At least one of --status or --priority is required",
            );
            Deno.exit(1);
          }

          await runWithClient({ attach: args.attach }, async (client) => {
            const tasks = await client.bulkUpdateTasks(args.ids, {
              status: args.status as TaskStatus | undefined,
              priority: args.priority,
            });

            if (args.json) {
              console.log(JSON.stringify(tasks));
            } else {
              console.log(`Updated ${tasks.length} task(s).`);
              for (const task of tasks) {
                console.log(`  #${task.id}: ${task.title} [${task.status}]`);
              }
            }
          });
        },
      })
      .command({
        command: "delete <ids..>",
        describe: "Delete multiple tasks at once",
        builder: (y: Argv) =>
          y
            .positional("ids", {
              type: "number",
              array: true,
              demandOption: true,
              describe: "Task IDs to delete",
            })
            .option("yes", {
              alias: "y",
              type: "boolean",
              describe: "Skip confirmation",
            })
            .option("json", {
              type: "boolean",
              describe: "Output in JSON format",
            })
            .option("attach", {
              type: "string",
              describe: "Attach to existing server URL",
            }),
        handler: async (args: BulkDeleteArgs) => {
          if (!args.yes) {
            console.log(
              `About to delete ${args.ids.length} task(s): ${
                args.ids.join(", ")
              }`,
            );
            console.log("Use --yes to confirm deletion.");
            return;
          }

          await runWithClient({ attach: args.attach }, async (client) => {
            const result = await client.bulkDeleteTasks(args.ids);

            if (args.json) {
              console.log(JSON.stringify(result));
            } else {
              console.log(`Deleted ${result.deleted} task(s).`);
            }
          });
        },
      })
      .demandCommand(1, "Please specify an action: update or delete"),
  handler: () => {},
};
