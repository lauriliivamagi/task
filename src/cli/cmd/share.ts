import type { Argv } from "yargs";
import { runWithClient } from "../bootstrap.ts";
import {
  getTemplatesDir,
  listTemplates,
  loadTemplate,
  renderTemplate,
} from "../../shared/templates.ts";

interface ShareArgs {
  id: number;
  template?: string;
  raw?: boolean;
  "list-templates"?: boolean;
  json?: boolean;
  attach?: string;
}

export const shareCommand = {
  command: "share <id>",
  describe: "Share task with AI agent (outputs formatted prompt)",
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
        describe: "Use named template from ~/.task-cli/templates/",
      })
      .option("raw", {
        type: "boolean",
        describe: "Output raw JSON instead of formatted prompt",
      })
      .option("list-templates", {
        type: "boolean",
        describe: "List available templates",
      })
      .option("json", {
        type: "boolean",
        describe: "Output as JSON (for programmatic use)",
      })
      .option("attach", {
        type: "string",
        describe: "Attach to existing server URL",
      }),
  handler: async (args: ShareArgs) => {
    // Handle --list-templates
    if (args["list-templates"]) {
      try {
        const templates = await listTemplates();
        console.log(`Templates directory: ${getTemplatesDir()}\n`);
        console.log("Available templates:");
        for (const t of templates) {
          console.log(`  - ${t}`);
        }
      } catch (error) {
        console.error((error as Error).message);
        Deno.exit(1);
      }
      return;
    }

    await runWithClient({ attach: args.attach }, async (client) => {
      try {
        const task = await client.getTask(args.id);

        // --raw: output raw JSON
        if (args.raw) {
          console.log(JSON.stringify(task, null, 2));
          return;
        }

        // --json: output structured JSON with rendered prompt
        if (args.json) {
          const template = await loadTemplate(args.template);
          const rendered = renderTemplate(template, task);
          console.log(JSON.stringify({ prompt: rendered, task }));
          return;
        }

        // Default: render template and output
        const template = await loadTemplate(args.template);
        const rendered = renderTemplate(template, task);
        console.log(rendered);
      } catch (error) {
        console.error((error as Error).message);
        Deno.exit(1);
      }
    });
  },
};
