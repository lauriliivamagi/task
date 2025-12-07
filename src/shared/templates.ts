/**
 * Template loading and rendering for task sharing
 */

import { ensureDir } from "@std/fs";
import { join } from "@std/path";
import type { TaskFull } from "./schemas.ts";

const TEMPLATES_DIR = join(
  Deno.env.get("HOME") || ".",
  ".task-cli",
  "templates",
);

export const DEFAULT_TEMPLATE = `Help me with this task:

**Task: {{title}}**
ID: {{id}} | Status: {{status}} | Priority: {{priority}} | Due: {{due_date}}
Project: {{project}}

Description:
{{description}}

Subtasks:
{{subtasks}}

Comments:
{{comments}}

---
For more task details: \`task view {{id}}\` | CLI help: \`task --help\`
`;

const PRIORITY_LABELS: Record<number, string> = {
  0: "Normal",
  1: "High",
  2: "Urgent",
};

/**
 * Ensure templates directory exists and default template is created
 */
export async function ensureTemplatesDir(): Promise<void> {
  await ensureDir(TEMPLATES_DIR);

  const defaultPath = join(TEMPLATES_DIR, "default.txt");
  try {
    await Deno.stat(defaultPath);
  } catch {
    // File doesn't exist, create it
    await Deno.writeTextFile(defaultPath, DEFAULT_TEMPLATE);
  }
}

/**
 * Load a template by name from the templates directory
 */
export async function loadTemplate(name = "default"): Promise<string> {
  await ensureTemplatesDir();

  const templatePath = join(TEMPLATES_DIR, `${name}.txt`);
  try {
    return await Deno.readTextFile(templatePath);
  } catch {
    throw new Error(`Template "${name}" not found at ${templatePath}`);
  }
}

/**
 * List available templates
 */
export async function listTemplates(): Promise<string[]> {
  await ensureTemplatesDir();

  const templates: string[] = [];
  for await (const entry of Deno.readDir(TEMPLATES_DIR)) {
    if (entry.isFile && entry.name.endsWith(".txt")) {
      templates.push(entry.name.replace(/\.txt$/, ""));
    }
  }
  return templates.sort();
}

/**
 * Format subtasks as a checkbox list
 */
function formatSubtasks(subtasks: TaskFull["subtasks"]): string {
  if (!subtasks || subtasks.length === 0) {
    return "(no subtasks)";
  }

  return subtasks
    .map((s) => {
      const checkbox = s.status === "done" ? "[x]" : "[ ]";
      return `- ${checkbox} ${s.title}`;
    })
    .join("\n");
}

/**
 * Format comments with timestamps
 */
function formatComments(comments: TaskFull["comments"]): string {
  if (!comments || comments.length === 0) {
    return "(no comments)";
  }

  return comments
    .map((c) => {
      const date = c.created_at.split("T")[0]; // Extract date part
      return `- "${c.content}" (${date})`;
    })
    .join("\n");
}

/**
 * Format context metadata
 */
function formatContext(context: unknown): string {
  if (!context || typeof context !== "object") {
    return "";
  }

  const ctx = context as {
    files?: { path: string; line_start?: number; line_end?: number }[];
    urls?: { url: string; title?: string }[];
    tags?: string[];
    git?: { branch?: string; commit?: string };
  };

  const parts: string[] = [];

  if (ctx.files && ctx.files.length > 0) {
    const fileStrs = ctx.files.map((f) => {
      if (f.line_start && f.line_end) {
        return `${f.path}:${f.line_start}-${f.line_end}`;
      } else if (f.line_start) {
        return `${f.path}:${f.line_start}`;
      }
      return f.path;
    });
    parts.push(`Files: ${fileStrs.join(", ")}`);
  }

  if (ctx.urls && ctx.urls.length > 0) {
    const urlStrs = ctx.urls.map((u) =>
      u.title ? `${u.title} (${u.url})` : u.url
    );
    parts.push(`URLs: ${urlStrs.join(", ")}`);
  }

  if (ctx.tags && ctx.tags.length > 0) {
    parts.push(`Tags: ${ctx.tags.join(", ")}`);
  }

  if (ctx.git) {
    const gitParts: string[] = [];
    if (ctx.git.branch) gitParts.push(`branch ${ctx.git.branch}`);
    if (ctx.git.commit) gitParts.push(`commit ${ctx.git.commit}`);
    if (gitParts.length > 0) {
      parts.push(`Git: ${gitParts.join(", ")}`);
    }
  }

  return parts.join("\n");
}

/**
 * Render a template with task data
 */
export function renderTemplate(template: string, task: TaskFull): string {
  const replacements: Record<string, string> = {
    "{{id}}": String(task.id),
    "{{title}}": task.title,
    "{{status}}": task.status,
    "{{priority}}": PRIORITY_LABELS[task.priority] || "Normal",
    "{{due_date}}": task.due_date || "No due date",
    "{{project}}": task.project_name || "No project",
    "{{description}}": task.description || "(no description)",
    "{{subtasks}}": formatSubtasks(task.subtasks),
    "{{comments}}": formatComments(task.comments),
    "{{context}}": formatContext((task as { context?: unknown }).context),
    "{{json}}": JSON.stringify(task, null, 2),
  };

  let result = template;
  for (const [placeholder, value] of Object.entries(replacements)) {
    result = result.replaceAll(placeholder, value);
  }

  return result;
}

/**
 * Get the templates directory path
 */
export function getTemplatesDir(): string {
  return TEMPLATES_DIR;
}
