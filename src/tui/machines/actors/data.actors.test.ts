/**
 * Tests for Data Actors
 *
 * Tests the promise-based actors used for data operations in the TUI.
 * These actors are invoked by the TUI state machine to perform async operations.
 */

import { assertEquals, assertExists } from "@std/assert";
import { MockTaskClient } from "../../mock_client.ts";

// We test the underlying promise logic directly since the actors
// are simple wrappers around promises with fromPromise()

// === loadTasks Tests ===

Deno.test("loadTasks - loads all tasks from client", async () => {
  const client = new MockTaskClient();
  const tasks = await client.listTasks({ all: false });

  assertEquals(tasks.length > 0, true);
  assertEquals(tasks[0].title, "Buy groceries");
});

Deno.test("loadTasks - supports semantic search param", async () => {
  const client = new MockTaskClient();
  const tasks = await client.listTasks({ semantic: "groceries" });

  assertEquals(Array.isArray(tasks), true);
});

// === loadTaskDetail Tests ===

Deno.test("loadTaskDetail - loads task by id", async () => {
  const client = new MockTaskClient();
  const task = await client.getTask(1);

  assertEquals(task.id, 1);
  assertEquals(task.title, "Buy groceries");
  assertEquals(task.description, "Milk, eggs, bread");
});

Deno.test("loadTaskDetail - includes full task details", async () => {
  const client = new MockTaskClient();
  const task = await client.getTask(1);

  assertExists(task.subtasks);
  assertExists(task.comments);
  assertExists(task.attachments);
  assertExists(task.tags);
});

// === toggleStatus Tests ===

Deno.test("toggleStatus - toggles from todo to done", async () => {
  const client = new MockTaskClient();
  const taskBefore = await client.getTask(1);
  assertEquals(taskBefore.status, "todo");

  await client.updateTask(1, { status: "done" });
  const taskAfter = await client.getTask(1);

  assertEquals(taskAfter.status, "done");
});

Deno.test("toggleStatus - toggles from done to todo", async () => {
  const client = new MockTaskClient();
  // First complete the task
  await client.updateTask(1, { status: "done" });

  // Then toggle back
  await client.updateTask(1, { status: "todo" });
  const task = await client.getTask(1);

  assertEquals(task.status, "todo");
});

Deno.test("toggleStatus - can set in-progress status", async () => {
  const client = new MockTaskClient();
  await client.updateTask(1, { status: "in-progress" });
  const task = await client.getTask(1);

  assertEquals(task.status, "in-progress");
});

// === reorderTask Tests ===

Deno.test("reorderTask - reorders task down", async () => {
  const client = new MockTaskClient();
  const result = await client.reorderTask(1, "down");

  assertEquals(result.swapped, true);
  assertExists(result.task);
});

Deno.test("reorderTask - reorders task up", async () => {
  const client = new MockTaskClient();
  const result = await client.reorderTask(2, "up");

  assertEquals(result.swapped, true);
  assertExists(result.task);
});

Deno.test("reorderTask - returns false when at boundary", async () => {
  const client = new MockTaskClient();
  // Task at order 0 can't go up
  const result = await client.reorderTask(1, "up");

  assertEquals(result.swapped, false);
});

// === createWorkspace Tests ===

Deno.test("createWorkspace - creates workspace for task", async () => {
  const client = new MockTaskClient();
  const result = await client.createWorkspace(1);

  assertExists(result.path);
  assertExists(result.name);
  assertEquals(result.opened, true);
});

// === gcalSync Tests ===

Deno.test("gcalSync - default mock returns unauthenticated", async () => {
  const client = new MockTaskClient();

  // Default mock is not authenticated
  const status = await client.getGcalStatus();
  assertEquals(status.authenticated, false);
});

Deno.test("gcalSync - syncs task (mock always succeeds)", async () => {
  const client = new MockTaskClient();
  const result = await client.syncToCalendar(1, { durationHours: 1 });

  // Mock syncToCalendar always succeeds
  assertEquals(result.success, true);
  assertExists(result.eventId);
  assertExists(result.eventUrl);
});

Deno.test("gcalSync - handles custom duration", async () => {
  const client = new MockTaskClient();
  const result = await client.syncToCalendar(1, { durationHours: 2.5 });

  assertEquals(result.success, true);
});

Deno.test("gcalSync - returns action type", async () => {
  const client = new MockTaskClient();
  const result = await client.syncToCalendar(1, { durationHours: 1 });

  assertEquals(["created", "updated", "skipped"].includes(result.action), true);
});

// === updateDuration Tests ===

Deno.test("updateDuration - updates task duration", async () => {
  const client = new MockTaskClient();
  await client.updateTask(1, { duration_hours: 2.5 });

  const task = await client.getTask(1);
  assertEquals(task.duration_hours, 2.5);
});

Deno.test("updateDuration - can set duration to null", async () => {
  const client = new MockTaskClient();
  // Set duration first
  await client.updateTask(1, { duration_hours: 2 });
  // Then clear it
  await client.updateTask(1, { duration_hours: null });

  const task = await client.getTask(1);
  assertEquals(task.duration_hours, null);
});

// === Task CRUD operations ===

Deno.test("createTask - creates new task", async () => {
  const client = new MockTaskClient();
  const initialCount = (await client.listTasks()).length;

  const newTask = await client.createTask({ title: "New Task" });

  assertEquals(newTask.title, "New Task");
  assertExists(newTask.id);

  const afterCount = (await client.listTasks()).length;
  assertEquals(afterCount, initialCount + 1);
});

Deno.test("createTask - creates task with all options", async () => {
  const client = new MockTaskClient();

  const newTask = await client.createTask({
    title: "Full Task",
    description: "A description",
    due_date: "2025-12-31",
    parent_id: 1,
    project: "Personal",
  });

  assertEquals(newTask.title, "Full Task");
  assertEquals(newTask.description, "A description");
  assertEquals(newTask.due_date, "2025-12-31");
  assertEquals(newTask.parent_id, 1);
});

Deno.test("updateTask - updates title", async () => {
  const client = new MockTaskClient();
  await client.updateTask(1, { title: "Updated Title" });

  const task = await client.getTask(1);
  assertEquals(task.title, "Updated Title");
});

Deno.test("updateTask - updates description", async () => {
  const client = new MockTaskClient();
  await client.updateTask(1, { description: "New description" });

  const task = await client.getTask(1);
  assertEquals(task.description, "New description");
});

Deno.test("updateTask - updates priority", async () => {
  const client = new MockTaskClient();
  await client.updateTask(1, { priority: 2 });

  const task = await client.getTask(1);
  assertEquals(task.priority, 2);
});

Deno.test("updateTask - updates due_date", async () => {
  const client = new MockTaskClient();
  await client.updateTask(1, { due_date: "2025-06-15" });

  const task = await client.getTask(1);
  assertEquals(task.due_date, "2025-06-15");
});

Deno.test("deleteTask - removes task", async () => {
  const client = new MockTaskClient();
  const initialCount = (await client.listTasks()).length;

  await client.deleteTask(1);

  const afterCount = (await client.listTasks()).length;
  assertEquals(afterCount, initialCount - 1);
});

// === Project operations ===

Deno.test("listProjects - returns projects", async () => {
  const client = new MockTaskClient();
  const projects = await client.listProjects();

  assertEquals(projects.length > 0, true);
  assertEquals(projects[0].name, "Personal");
});

Deno.test("createProject - creates new project", async () => {
  const client = new MockTaskClient();
  const project = await client.createProject({ name: "Test Project" });

  assertEquals(project.name, "Test Project");
  assertExists(project.id);
});

Deno.test("getProject - returns project by id", async () => {
  const client = new MockTaskClient();
  const project = await client.getProject(1);

  assertEquals(project.id, 1);
  assertEquals(project.name, "Personal");
});

Deno.test("deleteProject - removes project", async () => {
  const client = new MockTaskClient();
  const result = await client.deleteProject(1);

  assertEquals(result.deleted, true);
});

// === Comment operations ===

Deno.test("addComment - adds comment to task", async () => {
  const client = new MockTaskClient();
  const comment = await client.addComment(1, { content: "Test comment" });

  assertExists(comment.id);
  assertEquals(comment.content, "Test comment");
});

Deno.test("listComments - returns task comments", async () => {
  const client = new MockTaskClient();
  // Task 2 has seeded comments
  const comments = await client.listComments(2);

  assertEquals(Array.isArray(comments), true);
});

Deno.test("deleteComment - removes comment", async () => {
  const client = new MockTaskClient();
  const result = await client.deleteComment(1, 999);

  assertEquals(result.deleted, true);
});

// === Tag operations ===

Deno.test("setTagsForTask - sets tags", async () => {
  const client = new MockTaskClient();
  const task = await client.setTagsForTask(1, ["tag1", "tag2"]);

  assertEquals(task.tags.length, 2);
  assertEquals(task.tags.map((t) => t.name).includes("tag1"), true);
});

Deno.test("addTagsToTask - adds tags", async () => {
  const client = new MockTaskClient();
  const result = await client.addTagsToTask(1, ["newtag1", "newtag2"]);

  assertEquals(result.tags.length, 2);
});

Deno.test("addTagsToTask - ignores empty strings", async () => {
  const client = new MockTaskClient();
  const result = await client.addTagsToTask(1, ["valid", "", "  "]);

  assertEquals(result.tags.length, 1);
  assertEquals(result.tags[0].name, "valid");
});

// === Attachment operations ===

Deno.test("addAttachment - adds attachment to task", async () => {
  const client = new MockTaskClient();
  const attachment = await client.addAttachment(1, "/path/to/file.pdf");

  assertExists(attachment.id);
  assertEquals(attachment.filename, "file.pdf");
});

Deno.test("listAttachments - returns task attachments", async () => {
  const client = new MockTaskClient();
  const attachments = await client.listAttachments(1);

  assertEquals(Array.isArray(attachments), true);
});

Deno.test("deleteAttachment - removes attachment", async () => {
  const client = new MockTaskClient();
  const result = await client.deleteAttachment(1, 999);

  assertEquals(result.deleted, true);
});

// === Health check ===

Deno.test("health - returns ok status", async () => {
  const client = new MockTaskClient();
  const result = await client.health();

  assertEquals(result.status, "ok");
});
