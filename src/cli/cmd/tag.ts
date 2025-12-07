import type { Argv } from "yargs";
import { runWithClient } from "../bootstrap.ts";

interface TagAddArgs {
  taskId: number;
  tags: string[];
  json?: boolean;
  attach?: string;
}

interface TagRemoveArgs {
  taskId: number;
  tag: string;
  json?: boolean;
  attach?: string;
}

interface TagListArgs {
  json?: boolean;
  attach?: string;
}

interface TagRenameArgs {
  tagId: number;
  newName: string;
  json?: boolean;
  attach?: string;
}

interface TagDeleteArgs {
  tagId: number;
  yes?: boolean;
  json?: boolean;
  attach?: string;
}

export const tagCommand = {
  command: "tag <command>",
  describe: "Manage task tags",
  builder: (yargs: Argv) =>
    yargs
      .command({
        command: "add <taskId> <tags...>",
        describe: "Add tags to a task",
        builder: (y: Argv) =>
          y
            .positional("taskId", {
              type: "number",
              describe: "Task ID",
              demandOption: true,
            })
            .positional("tags", {
              type: "string",
              array: true,
              describe: "Tags to add",
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
        handler: async (args: TagAddArgs) => {
          await runWithClient({ attach: args.attach }, async (client) => {
            const result = await client.addTagsToTask(args.taskId, args.tags);
            if (args.json) {
              console.log(JSON.stringify(result));
            } else {
              const tagNames = result.tags.map((t) => t.name).join(", ");
              console.log(`Added tags to task #${args.taskId}: ${tagNames}`);
            }
          });
        },
      })
      .command({
        command: "remove <taskId> <tag>",
        describe: "Remove a tag from a task",
        builder: (y: Argv) =>
          y
            .positional("taskId", {
              type: "number",
              describe: "Task ID",
              demandOption: true,
            })
            .positional("tag", {
              type: "string",
              describe: "Tag name to remove",
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
        handler: async (args: TagRemoveArgs) => {
          await runWithClient({ attach: args.attach }, async (client) => {
            // First get the task's tags to find the tag ID
            const tags = await client.getTaskTags(args.taskId);
            const tag = tags.find(
              (t) => t.name.toLowerCase() === args.tag.toLowerCase(),
            );

            if (!tag) {
              console.error(
                `Tag "${args.tag}" not found on task #${args.taskId}`,
              );
              Deno.exit(1);
            }

            await client.removeTagFromTask(args.taskId, tag.id);
            if (args.json) {
              console.log(JSON.stringify({ deleted: true }));
            } else {
              console.log(
                `Removed tag "${args.tag}" from task #${args.taskId}`,
              );
            }
          });
        },
      })
      .command({
        command: "list",
        describe: "List all tags with usage counts",
        builder: (y: Argv) =>
          y
            .option("json", {
              type: "boolean",
              describe: "Output in JSON format",
            })
            .option("attach", {
              type: "string",
              describe: "Attach to existing server URL",
            }),
        handler: async (args: TagListArgs) => {
          await runWithClient({ attach: args.attach }, async (client) => {
            const tags = await client.listTags();
            if (args.json) {
              console.log(JSON.stringify(tags));
            } else {
              if (tags.length === 0) {
                console.log("No tags found.");
                return;
              }

              const pad = (s: string | number | null | undefined, n: number) =>
                String(s ?? "-").padEnd(n);
              console.log(
                `${pad("ID", 6)} ${pad("Count", 7)} Name`,
              );
              console.log(
                `${pad("--", 6)} ${pad("-----", 7)} ----`,
              );

              for (const tag of tags) {
                console.log(
                  `${pad(tag.id, 6)} ${pad(tag.task_count, 7)} ${tag.name}`,
                );
              }
            }
          });
        },
      })
      .command({
        command: "rename <tagId> <newName>",
        describe: "Rename a tag",
        builder: (y: Argv) =>
          y
            .positional("tagId", {
              type: "number",
              describe: "Tag ID",
              demandOption: true,
            })
            .positional("newName", {
              type: "string",
              describe: "New tag name",
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
        handler: async (args: TagRenameArgs) => {
          await runWithClient({ attach: args.attach }, async (client) => {
            const tag = await client.renameTag(args.tagId, args.newName);
            if (args.json) {
              console.log(JSON.stringify(tag));
            } else {
              console.log(`Renamed tag #${tag.id} to "${tag.name}"`);
            }
          });
        },
      })
      .command({
        command: "delete <tagId>",
        describe: "Delete a tag",
        builder: (y: Argv) =>
          y
            .positional("tagId", {
              type: "number",
              describe: "Tag ID",
              demandOption: true,
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
        handler: async (args: TagDeleteArgs) => {
          await runWithClient({ attach: args.attach }, async (client) => {
            await client.deleteTag(args.tagId);
            if (args.json) {
              console.log(JSON.stringify({ deleted: true }));
            } else {
              console.log(`Deleted tag #${args.tagId}`);
            }
          });
        },
      })
      .demandCommand(1, "Please specify a tag subcommand"),
  handler: () => {
    // This won't be called due to demandCommand
  },
};
