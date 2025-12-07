import type { Argv } from "yargs";
import { runWithClient } from "../bootstrap.ts";
import { getConfig } from "../../shared/config.ts";
import {
  createWorkspace,
  getWorkspaceFromContext,
  getWorkspaceTemplatesDir,
  listWorkspaceTemplates,
} from "../../shared/workspace.ts";

interface WorkArgs {
  id: number;
  template?: string;
  name?: string;
  "no-open"?: boolean;
  "list-templates"?: boolean;
  open?: boolean;
  attach?: string;
}

export const workCommand = {
  command: "work <id>",
  describe: "Create a workspace for a task and start working",
  builder: (yargs: Argv) =>
    yargs
      .positional("id", {
        type: "number",
        describe: "Task ID",
        demandOption: true,
      })
      .option("template", {
        alias: "t",
        type: "string",
        describe: "Use specific workspace template",
      })
      .option("name", {
        alias: "n",
        type: "string",
        describe: "Custom workspace name (default: <id>-<slug>)",
      })
      .option("no-open", {
        type: "boolean",
        describe: "Create workspace but don't open IDE",
      })
      .option("open", {
        alias: "o",
        type: "boolean",
        describe: "Open existing workspace in IDE",
      })
      .option("list-templates", {
        type: "boolean",
        describe: "List available workspace templates",
      })
      .option("attach", {
        type: "string",
        describe: "Attach to existing server URL",
      }),
  handler: async (args: WorkArgs) => {
    // Handle --list-templates
    if (args["list-templates"]) {
      try {
        const templates = await listWorkspaceTemplates();
        console.log(`Templates directory: ${getWorkspaceTemplatesDir()}\n`);
        console.log("Available workspace templates:");
        for (const t of templates) {
          console.log(`  - ${t}`);
        }
        console.log(
          "\nCreate custom templates by adding directories to the templates folder.",
        );
      } catch (error) {
        console.error((error as Error).message);
        Deno.exit(1);
      }
      return;
    }

    await runWithClient({ attach: args.attach }, async (client) => {
      try {
        // Get task details
        const task = await client.getTask(args.id);

        // Check if workspace already exists in task context (and folder exists on disk)
        let existingWorkspace = getWorkspaceFromContext(
          (task as { context?: unknown }).context,
        );

        // Verify folder actually exists
        if (existingWorkspace) {
          try {
            const stat = await Deno.stat(existingWorkspace);
            if (!stat.isDirectory) {
              existingWorkspace = null;
            }
          } catch {
            // Folder doesn't exist, treat as no workspace
            existingWorkspace = null;
          }
        }

        // Handle --open flag: just open existing workspace
        if (args.open) {
          if (!existingWorkspace) {
            console.error(
              `No workspace found for task #${args.id}. Use 'task work ${args.id}' to create one.`,
            );
            Deno.exit(1);
          }

          const config = await getConfig();
          const ideCommand = config.work.ide_command;
          const ideArgs = config.work.ide_args || [];

          console.log(`Opening workspace: ${existingWorkspace}`);
          const command = new Deno.Command(ideCommand, {
            args: [...ideArgs, existingWorkspace],
            stdout: "null",
            stderr: "null",
          });
          command.spawn();
          return;
        }

        // Check if workspace already exists
        if (existingWorkspace) {
          console.log(
            `Workspace already exists for task #${args.id}: ${existingWorkspace}`,
          );
          console.log(
            `Use 'task work ${args.id} --open' to open it in your IDE.`,
          );
          return;
        }

        // Get config
        const config = await getConfig();

        // Create workspace
        console.log(`Creating workspace for task #${args.id}: ${task.title}`);

        const result = await createWorkspace({
          task,
          template: args.template,
          name: args.name,
          noOpen: args["no-open"],
          config: config.work,
        });

        // Update task context with workspace path
        await client.updateTask(args.id, {
          context: {
            ...((task as { context?: Record<string, unknown> }).context || {}),
            workspace: result.path,
          },
        });

        console.log(`\nWorkspace created: ${result.path}`);
        console.log(`  Name: ${result.name}`);
        console.log(
          `  Template: ${args.template || config.work.default_template}`,
        );

        if (args["no-open"]) {
          console.log(`  IDE: Use 'task work ${args.id} --open' to open`);
        } else {
          console.log(`  IDE: Opening with '${config.work.ide_command}'`);
        }

        console.log(`\nWorkspace structure:`);
        console.log(`  ${result.path}/`);
        console.log(`  ├── README.md      # Task context`);
        console.log(`  ├── CLAUDE.md      # AI instructions`);
        console.log(`  ├── input/         # Attachments & reference`);
        console.log(`  └── output/        # Deliverables`);

        console.log(`\nWhen done: task update ${args.id} --status done`);
      } catch (error) {
        console.error((error as Error).message);
        Deno.exit(1);
      }
    });
  },
};
