import type { Argv } from "yargs";
import { runWithClient } from "../bootstrap.ts";

interface AttachArgs {
  id: number;
  filepath: string;
  json?: boolean;
  attach?: string;
}

export const attachFileCommand = {
  command: "attach <id> <filepath>",
  describe: "Attach a file to a task",
  builder: (yargs: Argv) =>
    yargs
      .positional("id", {
        type: "number",
        describe: "Task ID",
        demandOption: true,
      })
      .positional("filepath", {
        type: "string",
        describe: "Path to file",
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
  handler: async (args: AttachArgs) => {
    await runWithClient({ attach: args.attach }, async (client) => {
      const attachment = await client.addAttachment(args.id, args.filepath);

      if (args.json) {
        console.log(JSON.stringify(attachment));
      } else {
        console.log(
          `File attached to task #${args.id}: ${attachment.path}`,
        );
      }
    });
  },
};
