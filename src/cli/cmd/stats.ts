import type { Argv } from "yargs";
import { runWithClient } from "../bootstrap.ts";

interface StatsArgs {
  json?: boolean;
  attach?: string;
}

export const statsCommand = {
  command: "stats",
  describe: "Show task statistics",
  builder: (yargs: Argv) =>
    yargs
      .option("json", {
        type: "boolean",
        describe: "Output in JSON format",
      })
      .option("attach", {
        type: "string",
        describe: "Attach to existing server URL",
      }),
  handler: async (args: StatsArgs) => {
    await runWithClient({ attach: args.attach }, async (client) => {
      const stats = await client.getStats();

      if (args.json) {
        console.log(JSON.stringify(stats));
      } else {
        console.log("Task Statistics");
        console.log("===============");
        console.log(`Total tasks: ${stats.total}`);
        console.log(`Overdue:     ${stats.overdue}`);
        console.log();
        console.log("By Status:");
        console.log(`  Todo:        ${stats.by_status.todo}`);
        console.log(`  In Progress: ${stats.by_status["in-progress"]}`);
        console.log(`  Done:        ${stats.by_status.done}`);
        console.log();
        console.log("By Priority:");
        console.log(`  Normal: ${stats.by_priority.normal}`);
        console.log(`  High:   ${stats.by_priority.high}`);
        console.log(`  Urgent: ${stats.by_priority.urgent}`);
        console.log();
        console.log("By Project:");
        for (const p of stats.by_project) {
          console.log(`  ${p.project_name || "(No project)"}: ${p.count}`);
        }
      }
    });
  },
};
