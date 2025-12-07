import type { Argv } from "yargs";
import { runWithClient } from "../bootstrap.ts";
import type { ReportPeriod, TaskWithProject } from "../../shared/schemas.ts";

interface ReportArgs {
  period?: string;
  from?: string;
  to?: string;
  project?: string;
  json?: boolean;
  attach?: string;
}

const PRIORITY_LABELS: Record<number, string> = {
  0: "normal",
  1: "high",
  2: "urgent",
};

function formatTask(task: TaskWithProject): string {
  const project = task.project_name ? ` [${task.project_name}]` : "";
  const priority = task.priority > 0
    ? ` (${PRIORITY_LABELS[task.priority] ?? "unknown"})`
    : "";
  const title = task.parent_title
    ? `${task.parent_title} > ${task.title}`
    : task.title;
  return `  #${task.id} ${title}${project}${priority}`;
}

export const reportCommand = {
  command: "report",
  describe: "Show task activity report for a time period",
  builder: (yargs: Argv) =>
    yargs
      .option("period", {
        type: "string",
        choices: ["week", "month", "quarter"],
        describe: "Report period (current calendar week/month/quarter)",
      })
      .option("from", {
        type: "string",
        describe: "Start date (YYYY-MM-DD), defaults to today if --to omitted",
      })
      .option("to", {
        type: "string",
        describe: "End date (YYYY-MM-DD), use with --from for custom range",
      })
      .option("project", {
        alias: "p",
        type: "string",
        describe: "Filter by project name",
      })
      .option("json", {
        type: "boolean",
        describe: "Output in JSON format",
      })
      .option("attach", {
        type: "string",
        describe: "Attach to existing server URL",
      }),
  handler: async (args: ReportArgs) => {
    await runWithClient({ attach: args.attach }, async (client) => {
      const report = await client.getReport({
        period: args.period as ReportPeriod | undefined,
        from: args.from,
        to: args.to,
        project: args.project,
      });

      if (args.json) {
        console.log(JSON.stringify(report));
      } else {
        // Header
        console.log(`Task Report: ${report.period.label}`);
        console.log(`Period: ${report.period.from} to ${report.period.to}`);
        console.log("=".repeat(60));
        console.log();

        // Summary
        console.log("Summary:");
        console.log(`  Completed:   ${report.summary.completed_count} tasks`);
        console.log(
          `  In Progress: ${report.summary.in_progress_count} tasks`,
        );
        console.log(`  Added:       ${report.summary.added_count} tasks`);
        console.log();

        // Completed section
        if (report.completed.length > 0) {
          console.log("Completed Tasks:");
          console.log("-".repeat(40));
          for (const task of report.completed) {
            console.log(formatTask(task));
          }
          console.log();
        }

        // In-progress section
        if (report.in_progress.length > 0) {
          console.log("In Progress (worked on this period):");
          console.log("-".repeat(40));
          for (const task of report.in_progress) {
            console.log(formatTask(task));
          }
          console.log();
        }

        // Added section
        if (report.added.length > 0) {
          console.log("Added Tasks:");
          console.log("-".repeat(40));
          for (const task of report.added) {
            console.log(formatTask(task));
          }
        }

        // Empty report message
        if (
          report.completed.length === 0 &&
          report.in_progress.length === 0 &&
          report.added.length === 0
        ) {
          console.log("No task activity during this period.");
        }
      }
    });
  },
};
