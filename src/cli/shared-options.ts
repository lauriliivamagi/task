/**
 * Shared CLI Option Builders
 *
 * Reusable yargs option definitions for common CLI arguments.
 * Reduces duplication across command files.
 */

import type { Argv } from "yargs";

/**
 * Add --due option for due date/time specification.
 * Accepts both ISO format and natural language.
 */
export function addDueDateOption<T>(
  yargs: Argv<T>,
): Argv<T & { due?: string }> {
  return yargs.option("due", {
    alias: "d",
    type: "string",
    describe:
      'Due date/time (ISO: "2024-12-31" or "2024-12-31T14:00:00Z", or natural: "tomorrow at 14:00")',
  });
}

/**
 * Add --recurrence option for recurring task specification.
 */
export function addRecurrenceOption<T>(
  yargs: Argv<T>,
): Argv<T & { recurrence?: string }> {
  return yargs.option("recurrence", {
    alias: "r",
    type: "string",
    describe: 'Recurrence rule (e.g., "every day", "every Monday", "monthly")',
  });
}

/**
 * Add --duration option for task duration in hours.
 */
export function addDurationOption<T>(
  yargs: Argv<T>,
): Argv<T & { duration?: number }> {
  return yargs.option("duration", {
    type: "number",
    describe: "Task duration in hours (0.25-24)",
  });
}

/**
 * Add --project option for project name.
 */
export function addProjectOption<T>(
  yargs: Argv<T>,
): Argv<T & { project?: string }> {
  return yargs.option("project", {
    alias: "p",
    type: "string",
    describe: "Project name",
  });
}

/**
 * Add --json option for JSON output format.
 */
export function addJsonOption<T>(yargs: Argv<T>): Argv<T & { json?: boolean }> {
  return yargs.option("json", {
    type: "boolean",
    describe: "Output in JSON format",
  });
}

/**
 * Add --attach option for attaching to existing server.
 */
export function addAttachOption<T>(
  yargs: Argv<T>,
): Argv<T & { attach?: string }> {
  return yargs.option("attach", {
    type: "string",
    describe: "Attach to existing server URL",
  });
}

/**
 * Add common task creation options.
 * Includes: project, due, tag, recurrence, duration, json, attach
 */
export function addTaskCreationOptions<T>(
  yargs: Argv<T>,
): Argv<
  T & {
    project?: string;
    due?: string;
    tag?: string[];
    recurrence?: string;
    duration?: number;
    json?: boolean;
    attach?: string;
  }
> {
  return yargs
    .option("project", {
      alias: "p",
      type: "string",
      describe: "Project name",
    })
    .option("due", {
      alias: "d",
      type: "string",
      describe:
        'Due date/time (ISO: "2024-12-31" or natural: "tomorrow at 14:00")',
    })
    .option("tag", {
      alias: "t",
      type: "array",
      string: true,
      describe: "Tags to assign (can be used multiple times)",
    })
    .option("recurrence", {
      alias: "r",
      type: "string",
      describe:
        'Recurrence rule (e.g., "every day", "every Monday", "monthly")',
    })
    .option("duration", {
      type: "number",
      describe: "Task duration in hours (0.25-24)",
    })
    .option("json", {
      type: "boolean",
      describe: "Output in JSON format",
    })
    .option("attach", {
      type: "string",
      describe: "Attach to existing server URL",
    });
}
