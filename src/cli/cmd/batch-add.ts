import type { Argv } from "yargs";
import { runWithClient } from "../bootstrap.ts";
import { BatchCreateInput } from "../../shared/schemas.ts";

interface BatchAddArgs {
  file?: string;
  json?: boolean;
  attach?: string;
}

async function readInput(file?: string): Promise<string> {
  if (file) {
    return await Deno.readTextFile(file);
  }

  // Read from stdin
  const decoder = new TextDecoder();
  const chunks: Uint8Array[] = [];

  for await (const chunk of Deno.stdin.readable) {
    chunks.push(chunk);
  }

  return decoder.decode(new Uint8Array(chunks.flatMap((c) => [...c])));
}

export const batchAddCommand = {
  command: "batch-add",
  describe: "Create multiple tasks with subtasks from JSON input",
  builder: (yargs: Argv) =>
    yargs
      .option("file", {
        alias: "f",
        type: "string",
        describe: "Read JSON input from file (otherwise reads from stdin)",
      })
      .option("json", {
        type: "boolean",
        describe: "Output in JSON format",
      })
      .option("attach", {
        type: "string",
        describe: "Attach to existing server URL",
      })
      .example(
        'echo \'{"tasks":[{"title":"Parent","subtasks":[{"title":"Child"}]}]}\' | $0 batch-add',
        "Create task with subtask from stdin",
      )
      .example(
        "$0 batch-add --file tasks.json",
        "Create tasks from JSON file",
      ),
  handler: async (args: BatchAddArgs) => {
    try {
      const inputText = await readInput(args.file);
      const input = JSON.parse(inputText);

      // Validate input
      const parsed = BatchCreateInput.safeParse(input);
      if (!parsed.success) {
        console.error("Invalid input format:");
        for (const issue of parsed.error.issues) {
          console.error(`  ${issue.path.join(".")}: ${issue.message}`);
        }
        Deno.exit(1);
      }

      await runWithClient({ attach: args.attach }, async (client) => {
        const result = await client.batchCreateTasks(parsed.data);

        if (args.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(`Created ${result.count} task(s).`);
          for (const task of result.created) {
            console.log(`  #${task.id}: ${task.title}`);
            if (task.subtasks && task.subtasks.length > 0) {
              for (const subtask of task.subtasks) {
                console.log(`    #${subtask.id}: ${subtask.title}`);
              }
            }
          }
        }
      });
    } catch (error) {
      if (error instanceof SyntaxError) {
        console.error("Invalid JSON input:", error.message);
      } else {
        console.error("Error:", (error as Error).message);
      }
      Deno.exit(1);
    }
  },
};
