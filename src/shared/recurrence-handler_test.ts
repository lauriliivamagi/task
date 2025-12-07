import { assertEquals, assertExists } from "@std/assert";
import type { Client } from "@libsql/client/node";
import { createClient } from "@libsql/client/node";
import {
  contextMigration,
  durationMigration,
  gcalEventMigration,
  orderMigration,
  recurrenceMigration,
  schema,
  tagsMigration,
} from "../db/schema.ts";
import { handleRecurringTaskCompletion } from "./recurrence-handler.ts";

/**
 * Create an in-memory test database with schema and all required migrations.
 */
async function createTestDb(): Promise<Client> {
  const client = createClient({ url: ":memory:" });
  await client.executeMultiple(schema);
  // Apply required migrations for recurrence tests
  await client.execute(contextMigration);
  await client.execute(orderMigration);
  await client.executeMultiple(tagsMigration);
  await client.execute(recurrenceMigration);
  await client.execute(gcalEventMigration);
  await client.execute(durationMigration);
  return client;
}

/**
 * Helper to create a task in the test database.
 */
async function createTask(
  db: Client,
  opts: {
    title: string;
    description?: string;
    priority?: number;
    status?: string;
    due_date?: string;
    project_id?: number;
    parent_id?: number;
    recurrence?: string;
    order?: number;
    context?: string;
  },
): Promise<number> {
  const result = await db.execute({
    sql: `
      INSERT INTO tasks (
        title, description, priority, status, due_date, project_id,
        parent_id, recurrence, \`order\`, context
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `,
    args: [
      opts.title,
      opts.description ?? null,
      opts.priority ?? 0,
      opts.status ?? "todo",
      opts.due_date ?? null,
      opts.project_id ?? null,
      opts.parent_id ?? null,
      opts.recurrence ?? null,
      opts.order ?? 0,
      opts.context ?? null,
    ],
  });
  return result.rows[0].id as number;
}

/**
 * Helper to create a tag and return its ID.
 */
async function createTag(
  db: Client,
  name: string,
): Promise<number> {
  const result = await db.execute({
    sql: "INSERT INTO tags (name) VALUES (?) RETURNING id",
    args: [name],
  });
  return result.rows[0].id as number;
}

/**
 * Helper to link a tag to a task.
 */
async function addTagToTask(
  db: Client,
  taskId: number,
  tagId: number,
): Promise<void> {
  await db.execute({
    sql: "INSERT INTO task_tags (task_id, tag_id) VALUES (?, ?)",
    args: [taskId, tagId],
  });
}

/**
 * Helper to get task by ID.
 */
async function getTask(
  db: Client,
  taskId: number,
  // deno-lint-ignore no-explicit-any
): Promise<Record<string, any>> {
  const result = await db.execute({
    sql: "SELECT * FROM tasks WHERE id = ?",
    args: [taskId],
  });
  return result.rows[0];
}

/**
 * Helper to get tags for a task.
 */
async function getTaskTags(
  db: Client,
  taskId: number,
): Promise<string[]> {
  const result = await db.execute({
    sql: `
      SELECT t.name FROM tags t
      INNER JOIN task_tags tt ON t.id = tt.tag_id
      WHERE tt.task_id = ?
    `,
    args: [taskId],
  });
  return result.rows.map((r) => r.name as string);
}

/**
 * Helper to get subtasks for a task.
 */
async function getSubtasks(
  db: Client,
  parentId: number,
  // deno-lint-ignore no-explicit-any
): Promise<Record<string, any>[]> {
  const result = await db.execute({
    sql: "SELECT * FROM tasks WHERE parent_id = ? ORDER BY `order` ASC",
    args: [parentId],
  });
  return result.rows;
}

// ============================================================================
// Non-recurring task tests
// ============================================================================

Deno.test("handleRecurringTaskCompletion - non-recurring task", async (t) => {
  await t.step("returns null for task without recurrence", async () => {
    const db = await createTestDb();
    const taskId = await createTask(db, { title: "Non-recurring task" });

    const result = await handleRecurringTaskCompletion(db, taskId);

    assertEquals(result.newTaskId, null);
    assertEquals(result.error, undefined);
  });

  await t.step(
    "returns null for subtask even with recurrence set",
    async () => {
      const db = await createTestDb();
      const parentId = await createTask(db, { title: "Parent task" });
      const subtaskId = await createTask(db, {
        title: "Subtask with recurrence",
        parent_id: parentId,
        recurrence: JSON.stringify({ type: "daily", interval: 1 }),
      });

      const result = await handleRecurringTaskCompletion(db, subtaskId);

      assertEquals(result.newTaskId, null);
      assertEquals(result.error, undefined);
    },
  );

  await t.step("returns error for non-existent task", async () => {
    const db = await createTestDb();

    const result = await handleRecurringTaskCompletion(db, 99999);

    assertEquals(result.newTaskId, null);
    assertEquals(result.error, "Task not found");
  });
});

// ============================================================================
// Basic recurring task tests
// ============================================================================

Deno.test("handleRecurringTaskCompletion - basic recurrence", async (t) => {
  await t.step("creates new task with same title and description", async () => {
    const db = await createTestDb();
    const taskId = await createTask(db, {
      title: "Daily standup",
      description: "Team standup meeting",
      due_date: "2025-01-15T09:00:00Z",
      recurrence: JSON.stringify({ type: "daily", interval: 1 }),
    });

    const result = await handleRecurringTaskCompletion(db, taskId);

    assertExists(result.newTaskId);
    const newTask = await getTask(db, result.newTaskId);
    assertEquals(newTask.title, "Daily standup");
    assertEquals(newTask.description, "Team standup meeting");
  });

  await t.step("new task has 'todo' status", async () => {
    const db = await createTestDb();
    const taskId = await createTask(db, {
      title: "Recurring task",
      status: "done", // Original is done
      due_date: "2025-01-15T00:00:00Z",
      recurrence: JSON.stringify({ type: "daily", interval: 1 }),
    });

    const result = await handleRecurringTaskCompletion(db, taskId);

    assertExists(result.newTaskId);
    const newTask = await getTask(db, result.newTaskId);
    assertEquals(newTask.status, "todo");
  });

  await t.step("new task has calculated next due date", async () => {
    const db = await createTestDb();
    const taskId = await createTask(db, {
      title: "Daily task",
      due_date: "2025-01-15T09:00:00Z",
      recurrence: JSON.stringify({ type: "daily", interval: 1 }),
    });

    const result = await handleRecurringTaskCompletion(db, taskId);

    assertExists(result.newTaskId);
    const newTask = await getTask(db, result.newTaskId);
    assertEquals(newTask.due_date, "2025-01-16T09:00:00Z");
  });

  await t.step("new task inherits priority", async () => {
    const db = await createTestDb();
    const taskId = await createTask(db, {
      title: "High priority recurring",
      priority: 2,
      due_date: "2025-01-15T00:00:00Z",
      recurrence: JSON.stringify({ type: "daily", interval: 1 }),
    });

    const result = await handleRecurringTaskCompletion(db, taskId);

    assertExists(result.newTaskId);
    const newTask = await getTask(db, result.newTaskId);
    assertEquals(newTask.priority, 2);
  });

  await t.step("new task inherits recurrence rule", async () => {
    const db = await createTestDb();
    const rule = { type: "weekly", interval: 2, daysOfWeek: [1, 3, 5] };
    const taskId = await createTask(db, {
      title: "Biweekly task",
      due_date: "2025-01-15T00:00:00Z",
      recurrence: JSON.stringify(rule),
    });

    const result = await handleRecurringTaskCompletion(db, taskId);

    assertExists(result.newTaskId);
    const newTask = await getTask(db, result.newTaskId);
    const newRule = JSON.parse(newTask.recurrence as string);
    assertEquals(newRule.type, "weekly");
    assertEquals(newRule.interval, 2);
    assertEquals(newRule.daysOfWeek, [1, 3, 5]);
  });
});

// ============================================================================
// Project and context inheritance tests
// ============================================================================

Deno.test("handleRecurringTaskCompletion - project inheritance", async (t) => {
  await t.step("new task inherits project_id", async () => {
    const db = await createTestDb();

    // Create a project
    const projectResult = await db.execute({
      sql: "INSERT INTO projects (name) VALUES (?) RETURNING id",
      args: ["Work Project"],
    });
    const projectId = projectResult.rows[0].id as number;

    const taskId = await createTask(db, {
      title: "Project recurring task",
      project_id: projectId,
      due_date: "2025-01-15T00:00:00Z",
      recurrence: JSON.stringify({ type: "daily", interval: 1 }),
    });

    const result = await handleRecurringTaskCompletion(db, taskId);

    assertExists(result.newTaskId);
    const newTask = await getTask(db, result.newTaskId);
    assertEquals(newTask.project_id, projectId);
  });

  await t.step("new task inherits context", async () => {
    const db = await createTestDb();
    const taskId = await createTask(db, {
      title: "Task with context",
      context: JSON.stringify({ notes: "Important context" }),
      due_date: "2025-01-15T00:00:00Z",
      recurrence: JSON.stringify({ type: "daily", interval: 1 }),
    });

    const result = await handleRecurringTaskCompletion(db, taskId);

    assertExists(result.newTaskId);
    const newTask = await getTask(db, result.newTaskId);
    assertEquals(
      newTask.context,
      JSON.stringify({ notes: "Important context" }),
    );
  });
});

// ============================================================================
// Tag inheritance tests
// ============================================================================

Deno.test("handleRecurringTaskCompletion - tag inheritance", async (t) => {
  await t.step("copies tags to new task", async () => {
    const db = await createTestDb();

    const taskId = await createTask(db, {
      title: "Tagged recurring task",
      due_date: "2025-01-15T00:00:00Z",
      recurrence: JSON.stringify({ type: "daily", interval: 1 }),
    });

    const tag1 = await createTag(db, "urgent");
    const tag2 = await createTag(db, "work");
    await addTagToTask(db, taskId, tag1);
    await addTagToTask(db, taskId, tag2);

    const result = await handleRecurringTaskCompletion(db, taskId);

    assertExists(result.newTaskId);
    const newTags = await getTaskTags(db, result.newTaskId);
    assertEquals(newTags.sort(), ["urgent", "work"].sort());
  });

  await t.step("handles task with no tags", async () => {
    const db = await createTestDb();
    const taskId = await createTask(db, {
      title: "No tags task",
      due_date: "2025-01-15T00:00:00Z",
      recurrence: JSON.stringify({ type: "daily", interval: 1 }),
    });

    const result = await handleRecurringTaskCompletion(db, taskId);

    assertExists(result.newTaskId);
    const newTags = await getTaskTags(db, result.newTaskId);
    assertEquals(newTags.length, 0);
  });
});

// ============================================================================
// Subtask recreation tests
// ============================================================================

Deno.test("handleRecurringTaskCompletion - subtask recreation", async (t) => {
  await t.step("recreates subtasks with 'todo' status", async () => {
    const db = await createTestDb();
    const parentId = await createTask(db, {
      title: "Parent with subtasks",
      due_date: "2025-01-15T00:00:00Z",
      recurrence: JSON.stringify({ type: "daily", interval: 1 }),
    });

    // Create subtasks with various statuses
    await createTask(db, {
      title: "Subtask 1",
      parent_id: parentId,
      status: "done",
      order: 0,
    });
    await createTask(db, {
      title: "Subtask 2",
      parent_id: parentId,
      status: "in-progress",
      order: 1,
    });
    await createTask(db, {
      title: "Subtask 3",
      parent_id: parentId,
      status: "todo",
      order: 2,
    });

    const result = await handleRecurringTaskCompletion(db, parentId);

    assertExists(result.newTaskId);
    const newSubtasks = await getSubtasks(db, result.newTaskId);
    assertEquals(newSubtasks.length, 3);
    assertEquals(newSubtasks[0].status, "todo");
    assertEquals(newSubtasks[1].status, "todo");
    assertEquals(newSubtasks[2].status, "todo");
  });

  await t.step("preserves subtask order", async () => {
    const db = await createTestDb();
    const parentId = await createTask(db, {
      title: "Parent",
      due_date: "2025-01-15T00:00:00Z",
      recurrence: JSON.stringify({ type: "daily", interval: 1 }),
    });

    await createTask(db, {
      title: "First",
      parent_id: parentId,
      order: 0,
    });
    await createTask(db, {
      title: "Second",
      parent_id: parentId,
      order: 1,
    });
    await createTask(db, {
      title: "Third",
      parent_id: parentId,
      order: 2,
    });

    const result = await handleRecurringTaskCompletion(db, parentId);

    assertExists(result.newTaskId);
    const newSubtasks = await getSubtasks(db, result.newTaskId);
    assertEquals(newSubtasks[0].title, "First");
    assertEquals(newSubtasks[1].title, "Second");
    assertEquals(newSubtasks[2].title, "Third");
  });

  await t.step("copies subtask tags", async () => {
    const db = await createTestDb();
    const parentId = await createTask(db, {
      title: "Parent",
      due_date: "2025-01-15T00:00:00Z",
      recurrence: JSON.stringify({ type: "daily", interval: 1 }),
    });

    const subtaskId = await createTask(db, {
      title: "Subtask with tags",
      parent_id: parentId,
      order: 0,
    });

    const tag = await createTag(db, "subtask-tag");
    await addTagToTask(db, subtaskId, tag);

    const result = await handleRecurringTaskCompletion(db, parentId);

    assertExists(result.newTaskId);
    const newSubtasks = await getSubtasks(db, result.newTaskId);
    const subtaskTags = await getTaskTags(db, newSubtasks[0].id as number);
    assertEquals(subtaskTags, ["subtask-tag"]);
  });

  await t.step("preserves subtask due_date as-is", async () => {
    const db = await createTestDb();
    const parentId = await createTask(db, {
      title: "Parent",
      due_date: "2025-01-15T00:00:00Z",
      recurrence: JSON.stringify({ type: "daily", interval: 1 }),
    });

    await createTask(db, {
      title: "Subtask with due date",
      parent_id: parentId,
      due_date: "2025-01-20T12:00:00Z",
      order: 0,
    });

    const result = await handleRecurringTaskCompletion(db, parentId);

    assertExists(result.newTaskId);
    const newSubtasks = await getSubtasks(db, result.newTaskId);
    assertEquals(newSubtasks[0].due_date, "2025-01-20T12:00:00Z");
  });

  await t.step("handles task with no subtasks", async () => {
    const db = await createTestDb();
    const taskId = await createTask(db, {
      title: "No subtasks task",
      due_date: "2025-01-15T00:00:00Z",
      recurrence: JSON.stringify({ type: "daily", interval: 1 }),
    });

    const result = await handleRecurringTaskCompletion(db, taskId);

    assertExists(result.newTaskId);
    const newSubtasks = await getSubtasks(db, result.newTaskId);
    assertEquals(newSubtasks.length, 0);
  });
});

// ============================================================================
// Order calculation tests
// ============================================================================

Deno.test("handleRecurringTaskCompletion - order calculation", async (t) => {
  await t.step("new task gets next available order", async () => {
    const db = await createTestDb();

    // Create some existing tasks
    await createTask(db, { title: "Task 1", order: 0 });
    await createTask(db, { title: "Task 2", order: 1 });
    await createTask(db, { title: "Task 3", order: 2 });

    const recurringTaskId = await createTask(db, {
      title: "Recurring",
      due_date: "2025-01-15T00:00:00Z",
      recurrence: JSON.stringify({ type: "daily", interval: 1 }),
      order: 3,
    });

    const result = await handleRecurringTaskCompletion(db, recurringTaskId);

    assertExists(result.newTaskId);
    const newTask = await getTask(db, result.newTaskId);
    assertEquals(newTask.order, 4);
  });
});

// ============================================================================
// Error handling tests
// ============================================================================

Deno.test("handleRecurringTaskCompletion - error handling", async (t) => {
  await t.step("returns error for invalid recurrence JSON", async () => {
    const db = await createTestDb();

    // Insert task with invalid JSON directly
    const result = await db.execute({
      sql: `
        INSERT INTO tasks (title, due_date, recurrence)
        VALUES (?, ?, ?)
        RETURNING id
      `,
      args: ["Bad recurrence", "2025-01-15T00:00:00Z", "not valid json"],
    });
    const taskId = result.rows[0].id as number;

    const handlerResult = await handleRecurringTaskCompletion(db, taskId);

    assertEquals(handlerResult.newTaskId, null);
    assertEquals(handlerResult.error, "Invalid recurrence rule");
  });
});

// ============================================================================
// Weekly recurrence tests
// ============================================================================

Deno.test("handleRecurringTaskCompletion - weekly recurrence", async (t) => {
  await t.step("calculates next due date for weekly pattern", async () => {
    const db = await createTestDb();
    const taskId = await createTask(db, {
      title: "Weekly meeting",
      due_date: "2025-01-15T10:00:00Z", // Wednesday
      recurrence: JSON.stringify({ type: "weekly", interval: 1 }),
    });

    const result = await handleRecurringTaskCompletion(db, taskId);

    assertExists(result.newTaskId);
    const newTask = await getTask(db, result.newTaskId);
    assertEquals(newTask.due_date, "2025-01-22T10:00:00Z"); // Next Wednesday
  });
});

// ============================================================================
// Monthly recurrence tests
// ============================================================================

Deno.test("handleRecurringTaskCompletion - monthly recurrence", async (t) => {
  await t.step("calculates next due date for monthly pattern", async () => {
    const db = await createTestDb();
    const taskId = await createTask(db, {
      title: "Monthly report",
      due_date: "2025-01-15T00:00:00Z",
      recurrence: JSON.stringify({ type: "monthly", interval: 1 }),
    });

    const result = await handleRecurringTaskCompletion(db, taskId);

    assertExists(result.newTaskId);
    const newTask = await getTask(db, result.newTaskId);
    assertEquals(newTask.due_date, "2025-02-15T00:00:00Z");
  });
});

// ============================================================================
// Null due date tests
// ============================================================================

Deno.test("handleRecurringTaskCompletion - null due date", async (t) => {
  await t.step("handles recurring task with no due date", async () => {
    const db = await createTestDb();
    const taskId = await createTask(db, {
      title: "No due date recurring",
      due_date: undefined, // null
      recurrence: JSON.stringify({ type: "daily", interval: 1 }),
    });

    const result = await handleRecurringTaskCompletion(db, taskId);

    // Should still create new task (calculator uses reference date)
    assertExists(result.newTaskId);
    const newTask = await getTask(db, result.newTaskId);
    assertExists(newTask.due_date); // Should have a calculated due date
  });
});
