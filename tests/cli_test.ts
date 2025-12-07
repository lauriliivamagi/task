import { assertEquals, assertStringIncludes } from "@std/assert";
import { APP_VERSION } from "../src/shared/version.ts";

const CLI_PATH = new URL("../src/main.ts", import.meta.url).pathname;

// Use a temporary file-based database for CLI tests (subprocess needs file-based DB)
const TEST_DB_PATH = `/tmp/task-cli-test-${Deno.pid}-${Date.now()}.db`;

async function runCli(
  args: string[],
): Promise<{ stdout: string; stderr: string; code: number }> {
  const env = { ...Deno.env.toObject() };
  // Use temp test database instead of real one
  env.TASK_CLI_DB_URL = `file:${TEST_DB_PATH}`;
  env.TASK_CLI_LOG_DISABLED = "1";
  env.TASK_CLI_SYNC_DISABLED = "1";

  const command = new Deno.Command("deno", {
    args: ["run", "-A", CLI_PATH, ...args],
    stdout: "piped",
    stderr: "piped",
    env,
  });

  const { code, stdout, stderr } = await command.output();

  return {
    stdout: new TextDecoder().decode(stdout),
    stderr: new TextDecoder().decode(stderr),
    code,
  };
}

// Clean up test database after all tests
addEventListener("unload", () => {
  try {
    Deno.removeSync(TEST_DB_PATH);
  } catch {
    // Ignore if file doesn't exist
  }
});

Deno.test("CLI shows help", async () => {
  const result = await runCli(["--help"]);

  assertEquals(result.code, 0);
  // Check for commands in help output
  assertStringIncludes(result.stdout, "add");
  assertStringIncludes(result.stdout, "list");
  assertStringIncludes(result.stdout, "view");
  assertStringIncludes(result.stdout, "update");
  assertStringIncludes(result.stdout, "serve");
  assertStringIncludes(result.stdout, "tui");
});

Deno.test("CLI shows version", async () => {
  const result = await runCli(["--version"]);

  assertEquals(result.code, 0);
  assertStringIncludes(result.stdout, APP_VERSION);
});

Deno.test("add command creates task", async () => {
  const result = await runCli(["add", "Integration test task", "--json"]);

  assertEquals(result.code, 0);
  const task = JSON.parse(result.stdout);
  assertEquals(task.title, "Integration test task");
  assertEquals(task.status, "todo");
});

Deno.test("add command with description", async () => {
  const result = await runCli([
    "add",
    "Task with desc",
    "This is the description",
    "--json",
  ]);

  assertEquals(result.code, 0);
  const task = JSON.parse(result.stdout);
  assertEquals(task.title, "Task with desc");
});

Deno.test("add command with project creates project", async () => {
  const result = await runCli([
    "add",
    "Project task",
    "--project",
    "TestProject",
    "--json",
  ]);

  assertEquals(result.code, 0);
  const task = JSON.parse(result.stdout);
  assertEquals(task.title, "Project task");
});

Deno.test("list command returns JSON array", async () => {
  // First add a task
  await runCli(["add", "Task for list test"]);

  const result = await runCli(["list", "--json"]);

  assertEquals(result.code, 0);
  const tasks = JSON.parse(result.stdout);
  assertEquals(Array.isArray(tasks), true);
});

Deno.test("list command filters by project", async () => {
  // Add tasks to different projects
  await runCli(["add", "Task in ProjectA", "--project", "ProjectA"]);
  await runCli(["add", "Task in ProjectB", "--project", "ProjectB"]);

  const result = await runCli(["list", "--project", "ProjectA", "--json"]);

  assertEquals(result.code, 0);
  const tasks = JSON.parse(result.stdout);
  assertEquals(
    tasks.every((t: { project_name: string }) => t.project_name === "ProjectA"),
    true,
  );
});

Deno.test("view command shows task details", async () => {
  // Add a task first
  const addResult = await runCli([
    "add",
    "Task to view",
    "Description here",
    "--json",
  ]);
  const task = JSON.parse(addResult.stdout);

  const viewResult = await runCli(["view", String(task.id), "--json"]);

  assertEquals(viewResult.code, 0);
  const viewedTask = JSON.parse(viewResult.stdout);
  assertEquals(viewedTask.title, "Task to view");
  assertEquals(viewedTask.description, "Description here");
});

Deno.test("update command changes status", async () => {
  // Add a task first
  const addResult = await runCli(["add", "Task to update status", "--json"]);
  const task = JSON.parse(addResult.stdout);

  // Update status
  const updateResult = await runCli([
    "update",
    String(task.id),
    "--status",
    "in-progress",
    "--json",
  ]);

  assertEquals(updateResult.code, 0);
  const updatedTask = JSON.parse(updateResult.stdout);
  assertEquals(updatedTask.status, "in-progress");
});

Deno.test("update command changes priority", async () => {
  // Add a task first
  const addResult = await runCli(["add", "Task to update priority", "--json"]);
  const task = JSON.parse(addResult.stdout);

  // Update priority
  const updateResult = await runCli([
    "update",
    String(task.id),
    "--priority",
    "2",
    "--json",
  ]);

  assertEquals(updateResult.code, 0);
  const updatedTask = JSON.parse(updateResult.stdout);
  assertEquals(updatedTask.priority, 2);
});

Deno.test("comment command adds comment", async () => {
  // Add a task first
  const addResult = await runCli(["add", "Task for comment", "--json"]);
  const task = JSON.parse(addResult.stdout);

  // Add comment
  const commentResult = await runCli([
    "comment",
    String(task.id),
    "Test comment content",
  ]);

  assertEquals(commentResult.code, 0);
  assertStringIncludes(commentResult.stdout, "Comment added");
});

Deno.test("list --all shows done tasks", async () => {
  // Add and complete a task
  const addResult = await runCli(["add", "Task to complete", "--json"]);
  const task = JSON.parse(addResult.stdout);
  await runCli(["update", String(task.id), "--status", "done"]);

  // List without --all should not show it
  const listResult = await runCli(["list", "--json"]);
  const tasks = JSON.parse(listResult.stdout);
  const foundWithoutAll = tasks.some((t: { id: number }) => t.id === task.id);
  assertEquals(foundWithoutAll, false);

  // List with --all should show it
  const listAllResult = await runCli(["list", "--all", "--json"]);
  const allTasks = JSON.parse(listAllResult.stdout);
  const foundWithAll = allTasks.some((t: { id: number }) => t.id === task.id);
  assertEquals(foundWithAll, true);
});

// ============================================================================
// Tag command tests
// ============================================================================

Deno.test("tag list returns tags", async () => {
  const result = await runCli(["tag", "list", "--json"]);

  assertEquals(result.code, 0);
  const tags = JSON.parse(result.stdout);
  assertEquals(Array.isArray(tags), true);
});

Deno.test("tag add adds tag to task", async () => {
  // First create a task
  const addResult = await runCli(["add", "Task for tagging", "--json"]);
  const task = JSON.parse(addResult.stdout);

  // Add a tag to the task
  const tagResult = await runCli([
    "tag",
    "add",
    String(task.id),
    "test-tag",
    "--json",
  ]);

  assertEquals(tagResult.code, 0);
  // The output should include the added tags
  const response = JSON.parse(tagResult.stdout);
  assertEquals(Array.isArray(response.tags), true);
  assertEquals(
    response.tags.some((t: { name: string }) => t.name === "test-tag"),
    true,
  );
});

Deno.test("add command with tags option", async () => {
  const result = await runCli([
    "add",
    "Task with tags",
    "-t",
    "urgent",
    "-t",
    "work",
    "--json",
  ]);

  assertEquals(result.code, 0);
  const task = JSON.parse(result.stdout);
  assertEquals(task.title, "Task with tags");
});

// ============================================================================
// Report command tests
// ============================================================================

Deno.test("report command shows week report", async () => {
  const result = await runCli(["report", "--period", "week"]);

  assertEquals(result.code, 0);
  // Report should include section headers
  assertStringIncludes(result.stdout, "Week");
});

Deno.test("report command with json output", async () => {
  const result = await runCli(["report", "--period", "week", "--json"]);

  assertEquals(result.code, 0);
  const report = JSON.parse(result.stdout);
  assertEquals(typeof report.period, "object");
  assertEquals(Array.isArray(report.completed), true);
  assertEquals(Array.isArray(report.in_progress), true);
  assertEquals(Array.isArray(report.added), true);
});

// ============================================================================
// Recurrence command tests
// ============================================================================

Deno.test("add command with recurrence", async () => {
  const result = await runCli([
    "add",
    "Daily recurring task",
    "--recurrence",
    "every day",
    "--json",
  ]);

  assertEquals(result.code, 0);
  const task = JSON.parse(result.stdout);
  assertEquals(task.title, "Daily recurring task");
  assertEquals(typeof task.recurrence, "object");
  assertEquals(task.recurrence.type, "daily");
});

Deno.test("update command sets recurrence", async () => {
  // Add a task first
  const addResult = await runCli(["add", "Task to make recurring", "--json"]);
  const task = JSON.parse(addResult.stdout);

  // Add recurrence
  const updateResult = await runCli([
    "update",
    String(task.id),
    "--recurrence",
    "every Monday",
    "--json",
  ]);

  assertEquals(updateResult.code, 0);
  const updatedTask = JSON.parse(updateResult.stdout);
  assertEquals(updatedTask.recurrence.type, "weekly");
});

Deno.test("update command clears recurrence", async () => {
  // Add a recurring task
  const addResult = await runCli([
    "add",
    "Task to clear recurrence",
    "--recurrence",
    "daily",
    "--json",
  ]);
  const task = JSON.parse(addResult.stdout);

  // Clear recurrence
  const updateResult = await runCli([
    "update",
    String(task.id),
    "--clear-recurrence",
    "--json",
  ]);

  assertEquals(updateResult.code, 0);
  const updatedTask = JSON.parse(updateResult.stdout);
  assertEquals(updatedTask.recurrence, null);
});
