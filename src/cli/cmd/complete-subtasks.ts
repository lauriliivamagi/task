import type { Argv } from "yargs";
import { runWithClient } from "../bootstrap.ts";

interface CompleteSubtasksArgs {
  id: number;
  json?: boolean;
  attach?: string;
}

export const completeSubtasksCommand = {
  command: "complete-subtasks <id>",
  describe: "Mark all subtasks of a task as done",
  builder: (yargs: Argv) =>
    yargs
      .positional("id", {
        type: "number",
        demandOption: true,
        describe: "Parent task ID",
      })
      .option("json", {
        type: "boolean",
        describe: "Output in JSON format",
      })
      .option("attach", {
        type: "string",
        describe: "Attach to existing server URL",
      }),
  handler: async (args: CompleteSubtasksArgs) => {
    await runWithClient({ attach: args.attach }, async (client) => {
      const result = await client.completeSubtasks(args.id);

      if (args.json) {
        console.log(JSON.stringify(result));
      } else {
        if (result.updated === 0) {
          console.log(
            `No subtasks found for task #${args.id} or all already done.`,
          );
        } else {
          console.log(`Marked ${result.updated} subtask(s) as done.`);
        }
      }
    });
  },
};
