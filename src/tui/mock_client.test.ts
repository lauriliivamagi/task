/**
 * Tests for MockTaskClient
 *
 * Verifies the mock client works correctly for testing purposes.
 */

import { assertEquals, assertNotEquals } from "@std/assert";
import { MockTaskClient } from "./mock_client.ts";

Deno.test("MockTaskClient - listTasks returns seeded tasks", async () => {
  const client = new MockTaskClient();
  const tasks = await client.listTasks();

  assertNotEquals(tasks.length, 0);
  assertEquals(tasks[0].title, "Buy groceries");
});

Deno.test("MockTaskClient - getTask returns task by id", async () => {
  const client = new MockTaskClient();
  const task = await client.getTask(1);

  assertEquals(task.id, 1);
  assertEquals(task.title, "Buy groceries");
  assertEquals(task.description, "Milk, eggs, bread");
});

Deno.test("MockTaskClient - createTask adds new task", async () => {
  const client = new MockTaskClient();
  const initialTasks = await client.listTasks();
  const initialCount = initialTasks.length;

  const newTask = await client.createTask({ title: "New Test Task" });

  assertEquals(newTask.title, "New Test Task");
  assertNotEquals(newTask.id, undefined);

  const afterTasks = await client.listTasks();
  assertEquals(afterTasks.length, initialCount + 1);
});

Deno.test("MockTaskClient - createTask with all options", async () => {
  const client = new MockTaskClient();

  const newTask = await client.createTask({
    title: "Full Task",
    description: "A description",
    due_date: "2025-12-31",
    parent_id: 1,
  });

  assertEquals(newTask.title, "Full Task");
  assertEquals(newTask.description, "A description");
  assertEquals(newTask.due_date, "2025-12-31");
  assertEquals(newTask.parent_id, 1);
});

Deno.test("MockTaskClient - updateTask modifies task", async () => {
  const client = new MockTaskClient();

  const updated = await client.updateTask(1, {
    title: "Updated Title",
    status: "in-progress",
  });

  assertEquals(updated.title, "Updated Title");
  assertEquals(updated.status, "in-progress");
});

Deno.test("MockTaskClient - deleteTask removes task", async () => {
  const client = new MockTaskClient();
  const initialTasks = await client.listTasks();
  const initialCount = initialTasks.length;

  await client.deleteTask(1);

  const afterTasks = await client.listTasks();
  assertEquals(afterTasks.length, initialCount - 1);
});

Deno.test("MockTaskClient - listProjects returns seeded projects", async () => {
  const client = new MockTaskClient();
  const projects = await client.listProjects();

  assertNotEquals(projects.length, 0);
  assertEquals(projects[0].name, "Personal");
});

Deno.test("MockTaskClient - createProject adds new project", async () => {
  const client = new MockTaskClient();

  const project = await client.createProject({ name: "New Project" });

  assertEquals(project.name, "New Project");
  assertNotEquals(project.id, undefined);
});

Deno.test("MockTaskClient - addComment adds comment to task", async () => {
  const client = new MockTaskClient();

  const comment = await client.addComment(1, { content: "Test comment" });

  assertNotEquals(comment.id, undefined);
  assertEquals(comment.content, "Test comment");
});

Deno.test("MockTaskClient - reorderTask swaps task order", async () => {
  const client = new MockTaskClient();

  const result = await client.reorderTask(1, "down");

  assertEquals(result.swapped, true);
  assertNotEquals(result.task, undefined);
});

Deno.test("MockTaskClient - reorderTask returns false at boundary", async () => {
  const client = new MockTaskClient();

  // Task 1 is at order 0, can't go up
  const result = await client.reorderTask(1, "up");

  assertEquals(result.swapped, false);
});

Deno.test("MockTaskClient - setTagsForTask updates tags", async () => {
  const client = new MockTaskClient();

  const task = await client.setTagsForTask(1, ["tag1", "tag2"]);

  assertEquals(task.tags.length, 2);
  assertEquals(task.tags.map((t) => t.name).includes("tag1"), true);
  assertEquals(task.tags.map((t) => t.name).includes("tag2"), true);
});

Deno.test("MockTaskClient - addAttachment adds attachment", async () => {
  const client = new MockTaskClient();

  const attachment = await client.addAttachment(1, "/path/to/file.pdf");

  assertNotEquals(attachment.id, undefined);
  assertEquals(attachment.filename, "file.pdf");
});

Deno.test("MockTaskClient - getGcalStatus returns status", async () => {
  const client = new MockTaskClient();

  const status = await client.getGcalStatus();

  assertEquals(typeof status.authenticated, "boolean");
});

Deno.test("MockTaskClient - syncToCalendar returns result", async () => {
  const client = new MockTaskClient();

  const result = await client.syncToCalendar(1, { durationHours: 2 });

  assertEquals(result.success, true);
  assertNotEquals(result.eventId, undefined);
});

Deno.test("MockTaskClient - health returns ok", async () => {
  const client = new MockTaskClient();

  const result = await client.health();

  assertEquals(result.status, "ok");
});

Deno.test("MockTaskClient - listComments returns task comments", async () => {
  const client = new MockTaskClient();

  const comments = await client.listComments(2);

  assertEquals(Array.isArray(comments), true);
  assertEquals(comments.length > 0, true);
});

Deno.test("MockTaskClient - deleteComment removes comment", async () => {
  const client = new MockTaskClient();

  // Add a comment first
  await client.addComment(1, { content: "Test comment" });

  const result = await client.deleteComment(1, 999);

  assertEquals(result.deleted, true);
});

Deno.test("MockTaskClient - listAttachments returns task attachments", async () => {
  const client = new MockTaskClient();

  const attachments = await client.listAttachments(1);

  assertEquals(Array.isArray(attachments), true);
});

Deno.test("MockTaskClient - deleteAttachment removes attachment", async () => {
  const client = new MockTaskClient();

  const result = await client.deleteAttachment(1, 999);

  assertEquals(result.deleted, true);
});

Deno.test("MockTaskClient - addTagsToTask adds tags", async () => {
  const client = new MockTaskClient();

  const result = await client.addTagsToTask(1, ["newtag1", "newtag2"]);

  assertEquals(result.tags.length, 2);
});

Deno.test("MockTaskClient - addTagsToTask ignores empty strings", async () => {
  const client = new MockTaskClient();

  const result = await client.addTagsToTask(1, ["valid", "", "  "]);

  assertEquals(result.tags.length, 1);
  assertEquals(result.tags[0].name, "valid");
});

Deno.test("MockTaskClient - createWorkspace returns workspace info", async () => {
  const client = new MockTaskClient();

  const result = await client.createWorkspace(1);

  assertNotEquals(result.path, undefined);
  assertNotEquals(result.name, undefined);
  assertEquals(result.opened, true);
});

Deno.test("MockTaskClient - getProject returns project by id", async () => {
  const client = new MockTaskClient();

  const project = await client.getProject(1);

  assertEquals(project.id, 1);
  assertEquals(project.name, "Personal");
});

Deno.test("MockTaskClient - deleteProject removes project", async () => {
  const client = new MockTaskClient();

  const result = await client.deleteProject(1);

  assertEquals(result.deleted, true);
});
