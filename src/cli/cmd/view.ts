import type { Argv } from "yargs";
import { runWithClient } from "../bootstrap.ts";
import { formatRecurrence } from "../../shared/recurrence-parser.ts";
import type { RecurrenceRule } from "../../shared/schemas.ts";
import { linkifyText, makeHyperlink } from "../../shared/hyperlink.ts";

interface ViewArgs {
  id: number;
  json?: boolean;
  attach?: string;
}

export const viewCommand = {
  command: "view <id>",
  describe: "View task details",
  builder: (yargs: Argv) =>
    yargs
      .positional("id", {
        type: "number",
        describe: "Task ID",
        demandOption: true,
      })
      .option("json", {
        type: "boolean",
        describe: "Output in JSON format",
      })
      .option("attach", {
        type: "string",
        describe: "Attach to existing server URL",
      }),
  handler: async (args: ViewArgs) => {
    await runWithClient({ attach: args.attach }, async (client) => {
      try {
        const task = await client.getTask(args.id);

        if (args.json) {
          console.log(JSON.stringify(task));
        } else {
          console.log(`Task #${task.id}: ${task.title}`);
          console.log(`Status: ${task.status}`);
          console.log(`Priority: ${task.priority}`);
          console.log(`Project: ${task.project_name || "-"}`);
          console.log(`Due: ${task.due_date || "-"}`);

          // Display recurrence if present
          if (task.recurrence) {
            const recurrenceStr = formatRecurrence(
              task.recurrence as RecurrenceRule,
            );
            console.log(`Recurrence: ${recurrenceStr}`);
          }

          console.log(
            `Description: ${
              task.description ? linkifyText(task.description) : "-"
            }`,
          );

          if (task.subtasks.length > 0) {
            console.log("\nSubtasks:");
            for (const sub of task.subtasks) {
              console.log(
                `  [${
                  sub.status === "done" ? "x" : " "
                }] #${sub.id} ${sub.title}`,
              );
            }
          }

          if (task.comments.length > 0) {
            console.log("\nComments:");
            for (const comment of task.comments) {
              console.log(
                `  - ${linkifyText(comment.content)} (${comment.created_at})`,
              );
            }
          }

          if (task.attachments.length > 0) {
            console.log("\nAttachments:");
            for (const att of task.attachments) {
              const linkedPath = makeHyperlink(att.path, `file://${att.path}`);
              console.log(`  - ${att.filename} (${linkedPath})`);
            }
          }
        }
      } catch (error) {
        console.error((error as Error).message);
        Deno.exit(1);
      }
    });
  },
};
