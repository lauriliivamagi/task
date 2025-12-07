import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  BatchTaskInput,
  ParseTasksInput,
  SubtaskInput,
} from "../../shared/schemas.ts";
import { parseNaturalDate } from "../../shared/date-parser.ts";

export const parseRoute = new Hono();

interface ParsedTask {
  title: string;
  description?: string;
  project?: string;
  due_date?: string;
  priority?: number;
  subtasks?: SubtaskInput[];
}

/**
 * Parse a single line of text into task parts.
 * Supports markers:
 *   @project - assign to project
 *   due:DATE - due date (natural language)
 *   priority:high or p:2 - priority level
 */
function parseTaskLine(
  line: string,
  defaults?: { project?: string; priority?: number },
): ParsedTask {
  let title = line.trim();
  const task: Partial<ParsedTask> = {};

  // Extract @project
  const projectMatch = title.match(/@(\S+)/);
  if (projectMatch) {
    task.project = projectMatch[1];
    title = title.replace(/@\S+/, "").trim();
  } else if (defaults?.project) {
    task.project = defaults.project;
  }

  // Extract due:DATE
  const dueMatch = title.match(/\bdue:(\S+)/i);
  if (dueMatch) {
    const parsed = parseNaturalDate(dueMatch[1]);
    if (parsed) {
      task.due_date = parsed;
    }
    title = title.replace(/\bdue:\S+/i, "").trim();
  }

  // Extract priority:level or p:level
  const priorityMatch = title.match(/\b(?:priority|p):(\S+)/i);
  if (priorityMatch) {
    const level = priorityMatch[1].toLowerCase();
    if (level === "high" || level === "1") {
      task.priority = 1;
    } else if (level === "urgent" || level === "2") {
      task.priority = 2;
    } else if (level === "normal" || level === "0") {
      task.priority = 0;
    }
    title = title.replace(/\b(?:priority|p):\S+/i, "").trim();
  } else if (defaults?.priority !== undefined) {
    task.priority = defaults.priority;
  }

  task.title = title;
  return task as ParsedTask;
}

/**
 * Parse text format:
 *   Task title @project due:tomorrow priority:high
 *     - Subtask 1
 *     - Subtask 2
 */
function parseTextFormat(
  content: string,
  defaults?: { project?: string; priority?: number },
): BatchTaskInput[] {
  const lines = content.split("\n");
  const tasks: BatchTaskInput[] = [];
  let currentTask: BatchTaskInput | null = null;

  for (const line of lines) {
    if (!line.trim()) continue;

    // Check if this is a subtask (starts with indentation + - or *)
    const subtaskMatch = line.match(/^(\s{2,}|\t)[-*]\s+(.+)/);
    if (subtaskMatch && currentTask) {
      const subtaskParsed = parseTaskLine(subtaskMatch[2], defaults);
      currentTask.subtasks = currentTask.subtasks || [];
      currentTask.subtasks.push({
        title: subtaskParsed.title,
        description: subtaskParsed.description,
        due_date: subtaskParsed.due_date,
        priority: subtaskParsed.priority,
      });
    } else if (line.trim()) {
      // New top-level task
      const parsed = parseTaskLine(line, defaults);
      currentTask = {
        title: parsed.title,
        description: parsed.description,
        project: parsed.project,
        due_date: parsed.due_date,
        priority: parsed.priority,
      };
      tasks.push(currentTask);
    }
  }

  return tasks;
}

/**
 * Parse markdown format:
 *   - [ ] Task title @project due:tomorrow
 *     - [ ] Subtask 1
 *     - [ ] Subtask 2
 */
function parseMarkdownFormat(
  content: string,
  defaults?: { project?: string; priority?: number },
): BatchTaskInput[] {
  const lines = content.split("\n");
  const tasks: BatchTaskInput[] = [];
  let currentTask: BatchTaskInput | null = null;

  for (const line of lines) {
    if (!line.trim()) continue;

    // Match markdown checkbox: - [ ] or - [x] or * [ ] etc.
    // Top-level: no leading whitespace or minimal
    // Subtask: 2+ spaces or tab before the bullet
    const topMatch = line.match(/^[-*]\s+\[[ x]\]\s+(.+)/i);
    const subtaskMatch = line.match(/^(\s{2,}|\t)[-*]\s+\[[ x]\]\s+(.+)/i);

    if (subtaskMatch && currentTask) {
      const subtaskParsed = parseTaskLine(subtaskMatch[2], defaults);
      currentTask.subtasks = currentTask.subtasks || [];
      currentTask.subtasks.push({
        title: subtaskParsed.title,
        description: subtaskParsed.description,
        due_date: subtaskParsed.due_date,
        priority: subtaskParsed.priority,
      });
    } else if (topMatch) {
      const parsed = parseTaskLine(topMatch[1], defaults);
      currentTask = {
        title: parsed.title,
        description: parsed.description,
        project: parsed.project,
        due_date: parsed.due_date,
        priority: parsed.priority,
      };
      tasks.push(currentTask);
    }
  }

  return tasks;
}

// Parse tasks from text/markdown
parseRoute.post(
  "/",
  zValidator("json", ParseTasksInput),
  (c) => {
    const { format, content, defaults } = c.req.valid("json");
    const warnings: string[] = [];

    let tasks: BatchTaskInput[] = [];

    try {
      switch (format) {
        case "json": {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            tasks = parsed;
          } else if (parsed.tasks && Array.isArray(parsed.tasks)) {
            tasks = parsed.tasks;
          } else {
            return c.json({
              error: "JSON must be an array or object with tasks array",
            }, 400);
          }
          break;
        }
        case "text": {
          tasks = parseTextFormat(content, defaults);
          break;
        }
        case "markdown": {
          tasks = parseMarkdownFormat(content, defaults);
          break;
        }
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        return c.json(
          { error: `Invalid ${format} format: ${error.message}` },
          400,
        );
      }
      throw error;
    }

    if (tasks.length === 0) {
      warnings.push("No tasks found in input");
    }

    // Validate tasks have required fields
    const validTasks = tasks.filter((t) => {
      if (!t.title || t.title.trim() === "") {
        warnings.push(`Skipped task with empty title`);
        return false;
      }
      return true;
    });

    return c.json({
      tasks: validTasks,
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  },
);
