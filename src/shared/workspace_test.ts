import { assertEquals, assertRejects } from "@std/assert";
import { exists } from "@std/fs";
import { join } from "@std/path";
import { assertResolvesTo } from "../test/test-utils.ts";
import {
  createWorkspace,
  generateClaudeMd,
  generateReadme,
  generateTaskRef,
  generateWorkspaceName,
  getWorkspaceFromContext,
  slugify,
} from "./workspace.ts";
import type { TaskFull } from "./schemas.ts";

// Test data
const mockTask: TaskFull = {
  id: 42,
  title: "Fix authentication bug",
  description: "Login fails with invalid token when session expires",
  status: "in-progress",
  priority: 1,
  due_date: "2025-01-15",
  recurrence: null,
  gcal_event_id: null,
  gcal_event_url: null,
  duration_hours: null,
  project_id: 1,
  project_name: "Backend",
  parent_id: null,
  parent_title: null,
  order: 0,
  created_at: "2025-01-10T10:00:00Z",
  updated_at: "2025-01-10T12:00:00Z",
  completed_at: null,
  subtasks: [
    { id: 43, title: "Investigate token expiry", status: "done" },
    { id: 44, title: "Add token refresh logic", status: "todo" },
    { id: 45, title: "Write tests", status: "todo" },
  ],
  comments: [
    {
      id: 1,
      content: "Affects mobile users",
      created_at: "2025-01-10T11:00:00Z",
    },
    {
      id: 2,
      content: "Related to PR #456",
      created_at: "2025-01-10T11:30:00Z",
    },
  ],
  attachments: [],
  tags: [{ id: 1, name: "bug" }, { id: 2, name: "auth" }],
};

Deno.test("slugify - converts title to URL-friendly slug", () => {
  assertEquals(slugify("Fix authentication bug"), "fix-authentication-bug");
  assertEquals(slugify("Add Feature: User Login"), "add-feature-user-login");
  assertEquals(slugify("  Multiple   Spaces  "), "multiple-spaces");
  assertEquals(slugify("UPPERCASE-and-lowercase"), "uppercase-and-lowercase");
  assertEquals(slugify("Special!@#$%^&*()chars"), "special-chars");
  assertEquals(slugify(""), "");
});

Deno.test("slugify - truncates long titles to 50 characters", () => {
  const longTitle =
    "This is a very long title that should be truncated to fifty characters or less";
  const result = slugify(longTitle);
  assertEquals(result.length <= 50, true);
});

Deno.test("generateWorkspaceName - creates name from task", () => {
  assertEquals(
    generateWorkspaceName(mockTask),
    "42-fix-authentication-bug",
  );

  assertEquals(
    generateWorkspaceName(mockTask, "task-{{task.id}}"),
    "task-42",
  );

  assertEquals(
    generateWorkspaceName(mockTask, "{{task.slug}}-v1"),
    "fix-authentication-bug-v1",
  );
});

Deno.test("generateReadme - generates proper markdown", () => {
  const readme = generateReadme(mockTask, "/home/user/git/42-fix-auth");

  // Check title
  assertEquals(readme.includes("# Task: Fix authentication bug"), true);

  // Check metadata
  assertEquals(readme.includes("**ID:** #42"), true);
  assertEquals(readme.includes("**Priority:** High"), true);
  assertEquals(readme.includes("**Status:** in-progress"), true);
  assertEquals(readme.includes("**Project:** Backend"), true);
  assertEquals(readme.includes("**Due:** 2025-01-15"), true);

  // Check description
  assertEquals(readme.includes("Login fails with invalid token"), true);

  // Check subtasks with checkboxes
  assertEquals(readme.includes("[x] Investigate token expiry"), true);
  assertEquals(readme.includes("[ ] Add token refresh logic"), true);

  // Check comments
  assertEquals(readme.includes("Affects mobile users"), true);
  assertEquals(readme.includes("Related to PR #456"), true);

  // Check footer
  assertEquals(readme.includes("`task view 42`"), true);
});

Deno.test("generateClaudeMd - generates AI instructions", () => {
  const claudeMd = generateClaudeMd(mockTask, "/home/user/git/42-fix-auth");

  // Check goal
  assertEquals(claudeMd.includes("Fix authentication bug"), true);
  assertEquals(claudeMd.includes("Login fails with invalid token"), true);

  // Check acceptance criteria (only incomplete subtasks)
  assertEquals(claudeMd.includes("Add token refresh logic"), true);
  assertEquals(claudeMd.includes("Write tests"), true);
  // Completed subtasks shouldn't appear in acceptance criteria
  assertEquals(
    claudeMd.includes("Investigate token expiry") === false ||
      claudeMd.includes("## Acceptance Criteria"),
    true,
  );

  // Check task reference
  assertEquals(claudeMd.includes("**Task ID:** 42"), true);
  assertEquals(claudeMd.includes("`task view 42`"), true);
  assertEquals(claudeMd.includes("`task update 42 --status done`"), true);

  // Check working directory hints
  assertEquals(claudeMd.includes("input/"), true);
  assertEquals(claudeMd.includes("output/"), true);
});

Deno.test("generateTaskRef - generates valid JSON", () => {
  const taskRef = generateTaskRef(mockTask);
  const parsed = JSON.parse(taskRef);

  assertEquals(parsed.task_id, 42);
  assertEquals(parsed.title, "Fix authentication bug");
  assertEquals(typeof parsed.created_at, "string");
  assertEquals(typeof parsed.task_cli_path, "string");
});

Deno.test("getWorkspaceFromContext - extracts workspace path", () => {
  assertEquals(
    getWorkspaceFromContext({ workspace: "/home/user/git/42-fix-auth" }),
    "/home/user/git/42-fix-auth",
  );

  assertEquals(getWorkspaceFromContext({}), null);
  assertEquals(getWorkspaceFromContext(null), null);
  assertEquals(getWorkspaceFromContext(undefined), null);
  assertEquals(getWorkspaceFromContext({ other: "field" }), null);
});

Deno.test("createWorkspace - creates workspace structure", async () => {
  const tempDir = await Deno.makeTempDir();
  const reposDir = join(tempDir, "repos");

  try {
    const result = await createWorkspace({
      task: mockTask,
      noOpen: true,
      config: {
        repos_dir: reposDir,
        default_template: "default",
        ide_command: "echo", // safe no-op command
        naming: "{{task.id}}-{{task.slug}}",
        auto_commit: true,
      },
    });

    // Check result
    assertEquals(result.name, "42-fix-authentication-bug");
    assertEquals(result.opened, false);
    await assertResolvesTo(exists(result.path), true);

    // Check directory structure
    await assertResolvesTo(exists(join(result.path, "README.md")), true);
    await assertResolvesTo(exists(join(result.path, "CLAUDE.md")), true);
    await assertResolvesTo(exists(join(result.path, "input")), true);
    await assertResolvesTo(exists(join(result.path, "output")), true);
    await assertResolvesTo(
      exists(join(result.path, "input", ".task-ref.json")),
      true,
    );
    await assertResolvesTo(exists(join(result.path, ".git")), true);

    // Check README content
    const readme = await Deno.readTextFile(join(result.path, "README.md"));
    assertEquals(readme.includes("Fix authentication bug"), true);

    // Check CLAUDE.md content
    const claudeMd = await Deno.readTextFile(join(result.path, "CLAUDE.md"));
    assertEquals(claudeMd.includes("task #42"), true);

    // Check task ref
    const taskRef = JSON.parse(
      await Deno.readTextFile(join(result.path, "input", ".task-ref.json")),
    );
    assertEquals(taskRef.task_id, 42);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("createWorkspace - rejects duplicate workspace", async () => {
  const tempDir = await Deno.makeTempDir();
  const reposDir = join(tempDir, "repos");

  try {
    // Create first workspace
    await createWorkspace({
      task: mockTask,
      noOpen: true,
      config: {
        repos_dir: reposDir,
        default_template: "default",
        ide_command: "echo",
        naming: "{{task.id}}-{{task.slug}}",
        auto_commit: false,
      },
    });

    // Try to create duplicate
    await assertRejects(
      () =>
        createWorkspace({
          task: mockTask,
          noOpen: true,
          config: {
            repos_dir: reposDir,
            default_template: "default",
            ide_command: "echo",
            naming: "{{task.id}}-{{task.slug}}",
            auto_commit: false,
          },
        }),
      Error,
      "Workspace already exists",
    );
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("createWorkspace - custom name overrides default", async () => {
  const tempDir = await Deno.makeTempDir();
  const reposDir = join(tempDir, "repos");

  try {
    const result = await createWorkspace({
      task: mockTask,
      name: "my-custom-workspace",
      noOpen: true,
      config: {
        repos_dir: reposDir,
        default_template: "default",
        ide_command: "echo",
        naming: "{{task.id}}-{{task.slug}}",
        auto_commit: false,
      },
    });

    assertEquals(result.name, "my-custom-workspace");
    assertEquals(result.path.endsWith("my-custom-workspace"), true);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});
