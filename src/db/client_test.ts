import { assertEquals, assertExists } from "@std/assert";
import { createClient } from "@libsql/client/node";
import { schema } from "./schema.ts";

async function createTestDb(): Promise<ReturnType<typeof createClient>> {
  const client = createClient({
    url: ":memory:",
  });
  await client.executeMultiple(schema);
  return client;
}

Deno.test("database schema creates all tables", async () => {
  const db = await createTestDb();

  const tables = await db.execute(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
  );

  const tableNames = tables.rows.map((r) =>
    (r as unknown as { name: string }).name
  );
  assertEquals(tableNames.includes("projects"), true);
  assertEquals(tableNames.includes("tasks"), true);
  assertEquals(tableNames.includes("comments"), true);
  assertEquals(tableNames.includes("attachments"), true);
});

Deno.test("can create a project", async () => {
  const db = await createTestDb();

  const result = await db.execute({
    sql:
      "INSERT INTO projects (name, description) VALUES (?, ?) RETURNING id, name",
    args: ["Test Project", "A test project"],
  });

  assertEquals(result.rows.length, 1);
  assertEquals(result.rows[0].name, "Test Project");
  assertExists(result.rows[0].id);
});

Deno.test("can create a task", async () => {
  const db = await createTestDb();

  const result = await db.execute({
    sql:
      "INSERT INTO tasks (title, description, status, priority) VALUES (?, ?, ?, ?) RETURNING *",
    args: ["Test Task", "A test task description", "todo", 0],
  });

  assertEquals(result.rows.length, 1);
  assertEquals(result.rows[0].title, "Test Task");
  assertEquals(result.rows[0].status, "todo");
  assertEquals(result.rows[0].priority, 0);
});

Deno.test("can create task with project", async () => {
  const db = await createTestDb();

  // Create project
  const projectResult = await db.execute({
    sql: "INSERT INTO projects (name) VALUES (?) RETURNING id",
    args: ["My Project"],
  });
  const projectId = projectResult.rows[0].id;

  // Create task with project
  const taskResult = await db.execute({
    sql: "INSERT INTO tasks (title, project_id) VALUES (?, ?) RETURNING *",
    args: ["Task in project", projectId],
  });

  assertEquals(taskResult.rows[0].project_id, projectId);
});

Deno.test("can create subtask with parent", async () => {
  const db = await createTestDb();

  // Create parent task
  const parentResult = await db.execute({
    sql: "INSERT INTO tasks (title) VALUES (?) RETURNING id",
    args: ["Parent Task"],
  });
  const parentId = parentResult.rows[0].id;

  // Create subtask
  const subtaskResult = await db.execute({
    sql: "INSERT INTO tasks (title, parent_id) VALUES (?, ?) RETURNING *",
    args: ["Subtask", parentId],
  });

  assertEquals(subtaskResult.rows[0].parent_id, parentId);
});

Deno.test("can update task status", async () => {
  const db = await createTestDb();

  // Create task
  const createResult = await db.execute({
    sql: "INSERT INTO tasks (title) VALUES (?) RETURNING id",
    args: ["Task to update"],
  });
  const taskId = createResult.rows[0].id;

  // Update status
  await db.execute({
    sql:
      "UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    args: ["in-progress", taskId],
  });

  // Verify
  const verifyResult = await db.execute({
    sql: "SELECT status FROM tasks WHERE id = ?",
    args: [taskId],
  });

  assertEquals(verifyResult.rows[0].status, "in-progress");
});

Deno.test("can add comment to task", async () => {
  const db = await createTestDb();

  // Create task
  const taskResult = await db.execute({
    sql: "INSERT INTO tasks (title) VALUES (?) RETURNING id",
    args: ["Task with comment"],
  });
  const taskId = taskResult.rows[0].id;

  // Add comment
  const commentResult = await db.execute({
    sql: "INSERT INTO comments (task_id, content) VALUES (?, ?) RETURNING *",
    args: [taskId, "This is a comment"],
  });

  assertEquals(commentResult.rows[0].content, "This is a comment");
  assertEquals(commentResult.rows[0].task_id, taskId);
});

Deno.test("can add attachment to task", async () => {
  const db = await createTestDb();

  // Create task
  const taskResult = await db.execute({
    sql: "INSERT INTO tasks (title) VALUES (?) RETURNING id",
    args: ["Task with attachment"],
  });
  const taskId = taskResult.rows[0].id;

  // Add attachment
  const attachResult = await db.execute({
    sql:
      "INSERT INTO attachments (task_id, filename, path) VALUES (?, ?, ?) RETURNING *",
    args: [taskId, "test.pdf", "/path/to/test.pdf"],
  });

  assertEquals(attachResult.rows[0].filename, "test.pdf");
  assertEquals(attachResult.rows[0].task_id, taskId);
});

Deno.test("can list tasks with project join", async () => {
  const db = await createTestDb();

  // Create project
  const projectResult = await db.execute({
    sql: "INSERT INTO projects (name) VALUES (?) RETURNING id",
    args: ["Project A"],
  });
  const projectId = projectResult.rows[0].id;

  // Create tasks
  await db.execute({
    sql: "INSERT INTO tasks (title, project_id, priority) VALUES (?, ?, ?)",
    args: ["High priority task", projectId, 2],
  });
  await db.execute({
    sql: "INSERT INTO tasks (title, priority) VALUES (?, ?)",
    args: ["Normal task", 0],
  });

  // List with join
  const result = await db.execute({
    sql: `SELECT t.id, t.title, t.status, t.priority, p.name as project_name
              FROM tasks t
              LEFT JOIN projects p ON t.project_id = p.id
              ORDER BY t.priority DESC`,
    args: [],
  });

  assertEquals(result.rows.length, 2);
  assertEquals(result.rows[0].title, "High priority task");
  assertEquals(result.rows[0].project_name, "Project A");
  assertEquals(result.rows[1].title, "Normal task");
  assertEquals(result.rows[1].project_name, null);
});

Deno.test("filtering done tasks works", async () => {
  const db = await createTestDb();

  // Create tasks with different statuses
  await db.execute({
    sql: "INSERT INTO tasks (title, status) VALUES (?, ?)",
    args: ["Todo task", "todo"],
  });
  await db.execute({
    sql: "INSERT INTO tasks (title, status) VALUES (?, ?)",
    args: ["Done task", "done"],
  });

  // List without done
  const activeResult = await db.execute({
    sql: "SELECT * FROM tasks WHERE status != 'done'",
    args: [],
  });
  assertEquals(activeResult.rows.length, 1);

  // List all
  const allResult = await db.execute({
    sql: "SELECT * FROM tasks",
    args: [],
  });
  assertEquals(allResult.rows.length, 2);
});
