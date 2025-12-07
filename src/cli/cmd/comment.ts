import type { Argv } from "yargs";
import { runWithClient } from "../bootstrap.ts";

interface CommentArgs {
  id: number;
  content: string;
  json?: boolean;
  attach?: string;
}

export const commentCommand = {
  command: "comment <id> <content>",
  describe: "Add a comment to a task",
  builder: (yargs: Argv) =>
    yargs
      .positional("id", {
        type: "number",
        describe: "Task ID",
        demandOption: true,
      })
      .positional("content", {
        type: "string",
        describe: "Comment content",
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
  handler: async (args: CommentArgs) => {
    await runWithClient({ attach: args.attach }, async (client) => {
      const comment = await client.addComment(args.id, {
        content: args.content,
      });

      if (args.json) {
        console.log(JSON.stringify(comment));
      } else {
        console.log(`Comment added to task #${args.id}.`);
      }
    });
  },
};
