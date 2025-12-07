/**
 * Workspace creation for task-based development
 *
 * Creates git repositories from templates with task context pre-populated.
 */

import { copy, ensureDir, exists } from "@std/fs";
import { join } from "@std/path";
import type { TaskFull } from "./schemas.ts";

const HOME = Deno.env.get("HOME") || ".";
const TASK_CLI_DIR = join(HOME, ".task-cli");
const WORKSPACE_TEMPLATES_DIR = join(TASK_CLI_DIR, "workspace-templates");

export interface WorkConfig {
  repos_dir: string;
  default_template: string;
  ide_command: string;
  ide_args: string[];
  naming: string;
  auto_commit: boolean;
}

export const DEFAULT_WORK_CONFIG: WorkConfig = {
  repos_dir: "~/git",
  default_template: "default",
  ide_command: "claude",
  ide_args: ["-n"],
  naming: "{{task.id}}-{{task.slug}}",
  auto_commit: true,
};

export interface CreateWorkspaceOptions {
  task: TaskFull;
  template?: string;
  name?: string;
  noOpen?: boolean;
  config?: Partial<WorkConfig>;
}

export interface WorkspaceResult {
  path: string;
  name: string;
  opened: boolean;
}

/**
 * Generate a URL-friendly slug from a title
 */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 50);
}

/**
 * Generate workspace name from task using naming pattern
 */
export function generateWorkspaceName(
  task: TaskFull,
  pattern: string = DEFAULT_WORK_CONFIG.naming,
): string {
  const slug = slugify(task.title);
  return pattern
    .replace("{{task.id}}", String(task.id))
    .replace("{{task.slug}}", slug);
}

/**
 * Expand ~ to home directory
 */
function expandPath(path: string): string {
  if (path.startsWith("~/")) {
    return join(HOME, path.substring(2));
  }
  return path;
}

/**
 * Get workspace templates directory
 */
export function getWorkspaceTemplatesDir(): string {
  return WORKSPACE_TEMPLATES_DIR;
}

/**
 * Ensure default workspace template exists
 */
async function ensureDefaultTemplate(): Promise<void> {
  const defaultDir = join(WORKSPACE_TEMPLATES_DIR, "default");

  if (await exists(defaultDir)) {
    return;
  }

  await ensureDir(defaultDir);

  // Create default .gitignore
  await Deno.writeTextFile(
    join(defaultDir, ".gitignore"),
    `# Dependencies
node_modules/
.venv/

# Build
dist/
build/
*.pyc
__pycache__/

# IDE
.idea/
.vscode/
*.swp

# OS
.DS_Store
Thumbs.db

# Output artifacts
output/*.tmp
`,
  );

  // Create _hooks directory with post-create script
  const hooksDir = join(defaultDir, "_hooks");
  await ensureDir(hooksDir);
  await Deno.writeTextFile(
    join(hooksDir, "post-create.sh"),
    `#!/bin/bash
# Post-create hook for default template
# This runs after the workspace is created

echo "Workspace ready!"
`,
  );
}

/**
 * List available workspace templates
 */
export async function listWorkspaceTemplates(): Promise<string[]> {
  await ensureDir(WORKSPACE_TEMPLATES_DIR);
  await ensureDefaultTemplate();

  const templates: string[] = [];
  for await (const entry of Deno.readDir(WORKSPACE_TEMPLATES_DIR)) {
    if (entry.isDirectory && !entry.name.startsWith(".")) {
      templates.push(entry.name);
    }
  }
  return templates.sort();
}

/**
 * Format subtasks as markdown checklist
 */
function formatSubtasksMarkdown(subtasks: TaskFull["subtasks"]): string {
  if (!subtasks || subtasks.length === 0) {
    return "_No subtasks defined_";
  }
  return subtasks
    .map((s) => `- [${s.status === "done" ? "x" : " "}] ${s.title}`)
    .join("\n");
}

/**
 * Format comments for README
 */
function formatCommentsMarkdown(comments: TaskFull["comments"]): string {
  if (!comments || comments.length === 0) {
    return "_No comments_";
  }
  return comments
    .map((c) => {
      const date = c.created_at.split("T")[0];
      return `- **${date}**: ${c.content}`;
    })
    .join("\n");
}

const PRIORITY_LABELS: Record<number, string> = {
  0: "Normal",
  1: "High",
  2: "Urgent",
};

/**
 * Generate README.md content for workspace
 */
export function generateReadme(task: TaskFull, repoPath: string): string {
  const priority = PRIORITY_LABELS[task.priority] || "Normal";
  const dueDate = task.due_date || "No due date";
  const project = task.project_name || "No project";

  return `# Task: ${task.title}

**ID:** #${task.id} | **Priority:** ${priority} | **Status:** ${task.status}
**Project:** ${project} | **Due:** ${dueDate}

## Description

${task.description || "_No description provided_"}

## Acceptance Criteria (Subtasks)

${formatSubtasksMarkdown(task.subtasks)}

## Comments & Notes

${formatCommentsMarkdown(task.comments)}

---

**Source:** \`task view ${task.id}\`
**Workspace:** \`${repoPath}\`
`;
}

/**
 * Generate CLAUDE.md content for AI assistants
 */
export function generateClaudeMd(task: TaskFull, repoPath: string): string {
  const subtasksList = task.subtasks && task.subtasks.length > 0
    ? task.subtasks
      .filter((s) => s.status !== "done")
      .map((s) => `- ${s.title}`)
      .join("\n")
    : "- Complete the main task objective";

  return `# CLAUDE.md

This workspace was created for task #${task.id} from task-cli.

## Goal

${task.title}

${task.description || ""}

## Acceptance Criteria

${subtasksList}

## Task Reference

- **Task ID:** ${task.id}
- **Task CLI:** \`~/.task-cli\`
- **View task:** \`task view ${task.id}\`
- **Update status:** \`task update ${task.id} --status done\`

## Working Directory

- **Input files:** \`${repoPath}/input/\` - Reference materials and attachments
- **Output artifacts:** \`${repoPath}/output/\` - Place deliverables here

## When Complete

1. Ensure all acceptance criteria are met
2. Place any output artifacts in the \`output/\` directory
3. Run: \`task update ${task.id} --status done\`
`;
}

/**
 * Generate .task-ref.json for bidirectional linking
 */
export function generateTaskRef(task: TaskFull): string {
  return JSON.stringify(
    {
      task_id: task.id,
      task_cli_path: TASK_CLI_DIR,
      created_at: new Date().toISOString(),
      title: task.title,
    },
    null,
    2,
  );
}

/**
 * Apply template variables to file content
 */
function applyTemplateVariables(
  content: string,
  task: TaskFull,
  repoName: string,
  repoPath: string,
): string {
  const date = new Date().toISOString().split("T")[0];
  const subtasksMd = formatSubtasksMarkdown(task.subtasks);
  const commentsMd = formatCommentsMarkdown(task.comments);

  return content
    .replace(/\{\{task\.id\}\}/g, String(task.id))
    .replace(/\{\{task\.title\}\}/g, task.title)
    .replace(/\{\{task\.description\}\}/g, task.description || "")
    .replace(
      /\{\{task\.priority\}\}/g,
      PRIORITY_LABELS[task.priority] || "Normal",
    )
    .replace(/\{\{task\.project\}\}/g, task.project_name || "")
    .replace(/\{\{task\.due\}\}/g, task.due_date || "")
    .replace(/\{\{task\.subtasks\}\}/g, subtasksMd)
    .replace(/\{\{task\.comments\}\}/g, commentsMd)
    .replace(/\{\{task\.json\}\}/g, JSON.stringify(task, null, 2))
    .replace(/\{\{repo\.name\}\}/g, repoName)
    .replace(/\{\{repo\.path\}\}/g, repoPath)
    .replace(/\{\{date\}\}/g, date);
}

/**
 * Copy template files to workspace, applying variable substitution
 */
async function copyTemplateFiles(
  templateDir: string,
  targetDir: string,
  task: TaskFull,
  repoName: string,
): Promise<void> {
  for await (const entry of Deno.readDir(templateDir)) {
    // Skip _hooks directory (handled separately)
    if (entry.name === "_hooks") continue;

    const srcPath = join(templateDir, entry.name);
    const destPath = join(targetDir, entry.name);

    if (entry.isDirectory) {
      await ensureDir(destPath);
      await copyTemplateFiles(srcPath, destPath, task, repoName);
    } else if (entry.isFile) {
      // Read, apply variables, write
      const content = await Deno.readTextFile(srcPath);
      const processed = applyTemplateVariables(
        content,
        task,
        repoName,
        targetDir,
      );
      await Deno.writeTextFile(destPath, processed);
    }
  }
}

/**
 * Run post-create hook if it exists
 */
async function runPostCreateHook(
  templateDir: string,
  workspacePath: string,
): Promise<void> {
  const hookPath = join(templateDir, "_hooks", "post-create.sh");

  if (!(await exists(hookPath))) {
    return;
  }

  try {
    const command = new Deno.Command("bash", {
      args: [hookPath],
      cwd: workspacePath,
      stdout: "inherit",
      stderr: "inherit",
    });
    await command.output();
  } catch {
    // Hook failure is not critical
    console.warn("Warning: post-create hook failed");
  }
}

/**
 * Copy task attachments to workspace input/ directory
 */
async function copyAttachments(
  task: TaskFull,
  inputDir: string,
): Promise<void> {
  const attachments = task.attachments;
  if (!attachments || attachments.length === 0) {
    return;
  }

  for (const attachment of attachments) {
    const srcPath = attachment.path;
    if (await exists(srcPath)) {
      const destPath = join(inputDir, attachment.filename);
      await copy(srcPath, destPath, { overwrite: true });
    }
  }
}

/**
 * Initialize git repository
 */
async function initGitRepo(
  workspacePath: string,
  task: TaskFull,
  autoCommit: boolean,
): Promise<void> {
  const command = new Deno.Command("git", {
    args: ["init"],
    cwd: workspacePath,
    stdout: "null",
    stderr: "null",
  });
  await command.output();

  if (autoCommit) {
    // git add
    const addCmd = new Deno.Command("git", {
      args: ["add", "-A"],
      cwd: workspacePath,
      stdout: "null",
      stderr: "null",
    });
    await addCmd.output();

    // git commit
    const commitCmd = new Deno.Command("git", {
      args: [
        "commit",
        "-m",
        `Initial workspace for task #${task.id}: ${task.title}`,
      ],
      cwd: workspacePath,
      stdout: "null",
      stderr: "null",
    });
    await commitCmd.output();
  }
}

/**
 * Open workspace in IDE
 */
function openIde(
  workspacePath: string,
  ideCommand: string,
  ideArgs: string[] = [],
): void {
  try {
    const command = new Deno.Command(ideCommand, {
      args: [...ideArgs, workspacePath],
      stdout: "null",
      stderr: "null",
    });
    // Don't wait for IDE to close
    command.spawn();
  } catch {
    console.warn(`Warning: Could not open IDE with command '${ideCommand}'`);
  }
}

/**
 * Create a workspace for a task
 */
export async function createWorkspace(
  options: CreateWorkspaceOptions,
): Promise<WorkspaceResult> {
  const config = { ...DEFAULT_WORK_CONFIG, ...options.config };
  const task = options.task;

  // Determine workspace name
  const repoName = options.name || generateWorkspaceName(task, config.naming);

  // Determine workspace path
  const reposDir = expandPath(config.repos_dir);
  await ensureDir(reposDir);
  const workspacePath = join(reposDir, repoName);

  // Check if workspace already exists
  if (await exists(workspacePath)) {
    throw new Error(`Workspace already exists: ${workspacePath}`);
  }

  // Ensure templates exist
  await ensureDir(WORKSPACE_TEMPLATES_DIR);
  await ensureDefaultTemplate();

  // Find template
  const templateName = options.template || config.default_template;
  const templateDir = join(WORKSPACE_TEMPLATES_DIR, templateName);

  if (!(await exists(templateDir))) {
    throw new Error(
      `Template '${templateName}' not found. Available templates: ${
        (
          await listWorkspaceTemplates()
        ).join(", ")
      }`,
    );
  }

  // Create workspace directory structure
  await ensureDir(workspacePath);
  await ensureDir(join(workspacePath, "input"));
  await ensureDir(join(workspacePath, "output"));

  // Copy template files
  await copyTemplateFiles(templateDir, workspacePath, task, repoName);

  // Generate README.md
  const readme = generateReadme(task, workspacePath);
  await Deno.writeTextFile(join(workspacePath, "README.md"), readme);

  // Generate CLAUDE.md
  const claudeMd = generateClaudeMd(task, workspacePath);
  await Deno.writeTextFile(join(workspacePath, "CLAUDE.md"), claudeMd);

  // Generate .task-ref.json in input/
  const taskRef = generateTaskRef(task);
  await Deno.writeTextFile(
    join(workspacePath, "input", ".task-ref.json"),
    taskRef,
  );

  // Create .gitkeep in output/
  await Deno.writeTextFile(join(workspacePath, "output", ".gitkeep"), "");

  // Copy attachments
  await copyAttachments(task, join(workspacePath, "input"));

  // Initialize git repository
  await initGitRepo(workspacePath, task, config.auto_commit);

  // Run post-create hook
  await runPostCreateHook(templateDir, workspacePath);

  // Open IDE
  let opened = false;
  if (!options.noOpen) {
    openIde(workspacePath, config.ide_command, config.ide_args);
    opened = true;
  }

  return {
    path: workspacePath,
    name: repoName,
    opened,
  };
}

/**
 * Get workspace path from task context if it exists
 */
export function getWorkspaceFromContext(
  context: unknown,
): string | null {
  if (!context || typeof context !== "object") {
    return null;
  }
  const ctx = context as { workspace?: string };
  return ctx.workspace || null;
}
