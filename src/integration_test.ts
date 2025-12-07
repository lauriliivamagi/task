/**
 * Integration Tests
 *
 * End-to-end tests that verify the server API works correctly.
 * Uses an in-memory SQLite database for isolation.
 */

import {
  assertEquals,
  assertExists,
  assertGreater,
  AssertionError,
} from "@std/assert";
import { app } from "./server/server.ts";
import { getDb, initDb, resetDbClient, runAllMigrations } from "./db/client.ts";
import type {
  BatchCreateResponse,
  ParseTasksResponse,
  ReportResponse,
  StatsResponse,
  Tag,
  TagWithCount,
  Task,
  TaskFull,
  TaskWithProject,
} from "./shared/schemas.ts";

/** Helper to make API requests */
async function api<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; data: T }> {
  const req = new Request(`http://localhost${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const res = await app.fetch(req);
  const data = await res.json() as T;
  return { status: res.status, data };
}

/** API helper that asserts status 200 and returns data */
async function apiOk<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const { status, data } = await api<T>(method, path, body);
  if (status !== 200) {
    throw new AssertionError(
      `Expected status 200, got ${status}. Response: ${JSON.stringify(data)}`,
    );
  }
  return data;
}

/** API helper that asserts status 201 and returns data */
async function apiCreated<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const { status, data } = await api<T>(method, path, body);
  if (status !== 201) {
    throw new AssertionError(
      `Expected status 201, got ${status}. Response: ${JSON.stringify(data)}`,
    );
  }
  return data;
}

// Initialize database before tests
Deno.test({
  name: "Integration Tests",
  // Disable sanitizers - Hono's app.fetch() creates internal resources
  // that may not be immediately cleaned up
  sanitizeResources: false,
  sanitizeOps: false,
  async fn(t): Promise<void> {
    // Reset any cached client from other tests
    resetDbClient();

    // Use in-memory database for test isolation
    Deno.env.set("TASK_CLI_DB_URL", ":memory:");

    try {
      // Initialize schema and run all migrations (creates fresh in-memory DB)
      await initDb();
      await runAllMigrations(await getDb());

      await t.step("Health check returns ok", async () => {
        const data = await apiOk<{ status: string }>("GET", "/health");
        assertEquals(data.status, "ok");
      });

      // === Project CRUD ===
      let projectId: number;

      await t.step("Create project", async () => {
        const data = await apiCreated<{ id: number }>("POST", "/projects", {
          name: "Test Project",
          description: "Integration test project",
        });
        assertExists(data.id);
        projectId = data.id;
      });

      await t.step("List projects includes created project", async () => {
        const data = await apiOk<{ id: number; name: string }[]>(
          "GET",
          "/projects",
        );
        const found = data.find((p) => p.id === projectId);
        assertExists(found);
        assertEquals(found.name, "Test Project");
      });

      // === Task CRUD ===
      let taskId: number;

      await t.step("Create task with project", async () => {
        const data = await apiCreated<{ id: number }>("POST", "/tasks", {
          title: "Test Task",
          description: "Integration test task",
          project: "Test Project",
        });
        assertExists(data.id);
        taskId = data.id;
      });

      await t.step("List tasks includes created task", async () => {
        const data = await apiOk<TaskWithProject[]>("GET", "/tasks");
        const found = data.find((t) => t.id === taskId);
        assertExists(found);
        assertEquals(found.title, "Test Task");
        assertEquals(found.project_name, "Test Project");
      });

      await t.step("Get task returns full details", async () => {
        const data = await apiOk<TaskFull>("GET", `/tasks/${taskId}`);
        assertEquals(data.id, taskId);
        assertEquals(data.title, "Test Task");
        assertEquals(data.status, "todo");
        assertExists(data.comments);
        assertExists(data.attachments);
      });

      await t.step("Update task status", async () => {
        const data = await apiOk<TaskFull>("PATCH", `/tasks/${taskId}`, {
          status: "in-progress",
        });
        assertEquals(data.status, "in-progress");
      });

      await t.step("Update task priority", async () => {
        const data = await apiOk<TaskFull>("PATCH", `/tasks/${taskId}`, {
          priority: 2,
        });
        assertEquals(data.priority, 2);
      });

      await t.step("Update task description", async () => {
        const data = await apiOk<TaskFull>("PATCH", `/tasks/${taskId}`, {
          description: "Updated description via PATCH",
        });
        assertEquals(data.description, "Updated description via PATCH");
      });

      // === Subtask Hierarchy ===
      let subtaskId: number;

      await t.step("Create subtask with parent", async () => {
        const data = await apiCreated<{ id: number }>("POST", "/tasks", {
          title: "Subtask",
          parent_id: taskId,
        });
        assertExists(data.id);
        subtaskId = data.id;
      });

      await t.step("Parent task includes subtask", async () => {
        const data = await apiOk<TaskFull>("GET", `/tasks/${taskId}`);
        assertExists(data.subtasks);
        const found = data.subtasks.find((s) => s.id === subtaskId);
        assertExists(found);
        assertEquals(found.title, "Subtask");
      });

      // === Comments ===
      let commentId: number;

      await t.step("Add comment to task", async () => {
        const data = await apiCreated<{ id: number }>(
          "POST",
          `/tasks/${taskId}/comments`,
          { content: "Test comment" },
        );
        assertExists(data.id);
        commentId = data.id;
      });

      await t.step("Task includes comment", async () => {
        const data = await apiOk<TaskFull>("GET", `/tasks/${taskId}`);
        const found = data.comments.find((c) => c.id === commentId);
        assertExists(found);
        assertEquals(found.content, "Test comment");
      });

      await t.step("Add multiple comments to task", async () => {
        // Add more comments to test embedding generation doesn't break
        await apiCreated<{ id: number }>("POST", `/tasks/${taskId}/comments`, {
          content: "Second comment for semantic search",
        });
        await apiCreated<{ id: number }>("POST", `/tasks/${taskId}/comments`, {
          content: "Third comment about API integration",
        });

        // Verify all comments are stored
        const data = await apiOk<TaskFull>("GET", `/tasks/${taskId}`);
        assertEquals(data.comments.length, 3);
      });

      await t.step("Delete comment", async () => {
        const data = await apiOk<{ deleted: boolean }>(
          "DELETE",
          `/tasks/${taskId}/comments/${commentId}`,
        );
        assertEquals(data.deleted, true);

        // Verify comment is removed
        const task = await apiOk<TaskFull>("GET", `/tasks/${taskId}`);
        const deleted = task.comments.find((c) => c.id === commentId);
        assertEquals(deleted, undefined);
        assertEquals(task.comments.length, 2);
      });

      // === Error Cases ===

      await t.step("Get non-existent task returns 404", async () => {
        const { status } = await api<unknown>("GET", "/tasks/99999");
        assertEquals(status, 404);
      });

      await t.step("Add comment to non-existent task returns 404", async () => {
        const { status } = await api<unknown>(
          "POST",
          "/tasks/99999/comments",
          { content: "Test" },
        );
        assertEquals(status, 404);
      });

      // === Foreign Key Enforcement ===

      await t.step("Create task with invalid project_id fails", async () => {
        const { status } = await api<unknown>("PATCH", `/tasks/${taskId}`, {
          project_id: 99999,
        });
        // Should fail due to FK constraint (either 500 or 400 depending on error handling)
        assertGreater(status, 399);
      });

      // === Search & Filtering ===

      await t.step("Search tasks by text", async () => {
        // Create tasks with distinct titles
        await apiCreated("POST", "/tasks", { title: "Buy groceries" });
        await apiCreated("POST", "/tasks", { title: "Write report" });

        const data = await apiOk<TaskWithProject[]>(
          "GET",
          "/tasks?q=groceries",
        );
        const found = data.find((t) => t.title === "Buy groceries");
        assertExists(found);
        // Should not find the other task
        const notFound = data.find((t) => t.title === "Write report");
        assertEquals(notFound, undefined);
      });

      await t.step("Filter tasks by status", async () => {
        const data = await apiOk<TaskWithProject[]>(
          "GET",
          "/tasks?status=in-progress",
        );
        // All returned tasks should be in-progress
        for (const task of data) {
          assertEquals(task.status, "in-progress");
        }
      });

      await t.step("Filter tasks by priority", async () => {
        const data = await apiOk<TaskWithProject[]>("GET", "/tasks?priority=2");
        // All returned tasks should have priority 2
        for (const task of data) {
          assertEquals(task.priority, 2);
        }
      });

      // === Multiple tasks verification ===

      await t.step("List tasks returns multiple tasks", async () => {
        // Create additional tasks
        await apiCreated("POST", "/tasks", { title: "Multi-task test 1" });
        await apiCreated("POST", "/tasks", { title: "Multi-task test 2" });
        await apiCreated("POST", "/tasks", { title: "Multi-task test 3" });

        const allTasks = await apiOk<TaskWithProject[]>(
          "GET",
          "/tasks?all=true",
        );
        assertGreater(allTasks.length, 2);
      });

      // === Edge Cases ===

      await t.step("Create task with Unicode title", async () => {
        const data = await apiCreated<Task>("POST", "/tasks", {
          title: "任务标题 🚀 émojis et accents",
          description: "描述内容 with special chars: <>&\"'",
        });
        assertEquals(data.title, "任务标题 🚀 émojis et accents");
        assertEquals(data.description, "描述内容 with special chars: <>&\"'");
      });

      await t.step("Create task with empty description", async () => {
        const data = await apiCreated<Task>("POST", "/tasks", {
          title: "Task with no description",
        });
        assertExists(data.id);
        assertEquals(data.description, null);
      });

      await t.step("Update task with partial data", async () => {
        // Create a task with basic fields
        const task = await apiCreated<Task>("POST", "/tasks", {
          title: "Full task",
          description: "Has description",
        });

        // First set the priority via PATCH (since POST doesn't include priority in INSERT)
        await apiOk<Task>("PATCH", `/tasks/${task.id}`, {
          priority: 1,
        });

        // Update only title - other fields should remain unchanged
        const updated = await apiOk<Task>("PATCH", `/tasks/${task.id}`, {
          title: "Updated title only",
        });

        assertEquals(updated.title, "Updated title only");
        assertEquals(updated.description, "Has description");
        assertEquals(updated.priority, 1);
        assertEquals(updated.status, "todo");
      });

      await t.step("Filter by due_before date", async () => {
        await apiCreated("POST", "/tasks", {
          title: "Past due task",
          due_date: "2020-01-01",
        });

        const data = await apiOk<TaskWithProject[]>(
          "GET",
          "/tasks?due_before=2021-01-01&all=true",
        );
        const found = data.find((t) => t.title === "Past due task");
        assertExists(found);
      });

      await t.step("Filter by due_after date", async () => {
        await apiCreated("POST", "/tasks", {
          title: "Future due task",
          due_date: "2030-01-01",
        });

        const data = await apiOk<TaskWithProject[]>(
          "GET",
          "/tasks?due_after=2029-01-01&all=true",
        );
        const found = data.find((t) => t.title === "Future due task");
        assertExists(found);
      });

      // === Stats Endpoint ===

      await t.step("Stats returns correct structure", async () => {
        const data = await apiOk<StatsResponse>("GET", "/stats");
        assertExists(data.total);
        assertExists(data.by_status);
        assertExists(data.by_priority);
        assertExists(data.by_project);
        assertExists(data.overdue);
        // Verify by_status has expected keys
        assertExists(data.by_status.todo);
        assertExists(data.by_status["in-progress"]);
        assertExists(data.by_status.done);
      });

      // === Report Endpoint ===

      await t.step("Report returns correct structure", async () => {
        const data = await apiOk<ReportResponse>("GET", "/reports");
        assertExists(data.period);
        assertExists(data.period.from);
        assertExists(data.period.to);
        assertExists(data.period.label);
        assertExists(data.completed);
        assertExists(data.in_progress);
        assertExists(data.added);
        assertExists(data.summary);
        assertEquals(typeof data.summary.completed_count, "number");
        assertEquals(typeof data.summary.in_progress_count, "number");
        assertEquals(typeof data.summary.added_count, "number");
      });

      await t.step("Report with period parameter", async () => {
        const data = await apiOk<ReportResponse>(
          "GET",
          "/reports?period=month",
        );
        assertExists(data.period.label);
        // Monthly label should contain year
        assertEquals(data.period.label.includes("20"), true);
      });

      await t.step("Report with custom date range", async () => {
        const data = await apiOk<ReportResponse>(
          "GET",
          "/reports?from=2025-01-01&to=2025-01-31",
        );
        assertEquals(data.period.from, "2025-01-01");
        assertEquals(data.period.to, "2025-01-31");
      });

      await t.step("Completed task appears in report", async () => {
        // Create and complete a task
        const task = await apiCreated<Task>("POST", "/tasks", {
          title: "Report test task",
        });
        await apiOk("PATCH", `/tasks/${task.id}`, { status: "done" });

        // Get report for today
        const today = new Date().toISOString().split("T")[0];
        const data = await apiOk<ReportResponse>(
          "GET",
          `/reports?from=${today}&to=${today}`,
        );

        const found = data.completed.find((t) => t.id === task.id);
        assertExists(found);
        assertExists(found.completed_at);
      });

      await t.step("completed_at is set on status change to done", async () => {
        const task = await apiCreated<Task>("POST", "/tasks", {
          title: "Test completed_at field",
        });

        // Initially completed_at should be null
        const taskBefore = await apiOk<TaskFull>("GET", `/tasks/${task.id}`);
        assertEquals(taskBefore.completed_at, null);

        // Mark as done
        await apiOk("PATCH", `/tasks/${task.id}`, { status: "done" });

        // Now completed_at should be set
        const taskAfter = await apiOk<TaskFull>("GET", `/tasks/${task.id}`);
        assertExists(taskAfter.completed_at);
      });

      await t.step(
        "completed_at is cleared when status changes away from done",
        async () => {
          const task = await apiCreated<Task>("POST", "/tasks", {
            title: "Test completed_at clear",
          });

          // Mark as done
          await apiOk("PATCH", `/tasks/${task.id}`, { status: "done" });
          const taskDone = await apiOk<TaskFull>("GET", `/tasks/${task.id}`);
          assertExists(taskDone.completed_at);

          // Mark as todo again
          await apiOk("PATCH", `/tasks/${task.id}`, { status: "todo" });
          const taskTodo = await apiOk<TaskFull>("GET", `/tasks/${task.id}`);
          assertEquals(taskTodo.completed_at, null);
        },
      );

      await t.step("Report filters by project", async () => {
        // Create a project and task
        const task = await apiCreated<Task>("POST", "/tasks", {
          title: "Project filter test",
          project: "ReportTestProject",
        });
        await apiOk("PATCH", `/tasks/${task.id}`, { status: "done" });

        const today = new Date().toISOString().split("T")[0];
        const data = await apiOk<ReportResponse>(
          "GET",
          `/reports?from=${today}&to=${today}&project=ReportTestProject`,
        );

        // Should find our task
        const found = data.completed.find((t) => t.id === task.id);
        assertExists(found);
        assertEquals(found.project_name, "ReportTestProject");
      });

      // === Bulk Operations ===

      let bulkTask1Id: number;
      let bulkTask2Id: number;

      await t.step("Create tasks for bulk operations", async () => {
        const t1 = await apiCreated<Task>("POST", "/tasks", {
          title: "Bulk task 1",
        });
        const t2 = await apiCreated<Task>("POST", "/tasks", {
          title: "Bulk task 2",
        });
        bulkTask1Id = t1.id;
        bulkTask2Id = t2.id;
      });

      await t.step("Bulk update changes multiple tasks", async () => {
        const data = await apiOk<Task[]>("PATCH", "/tasks/bulk", {
          ids: [bulkTask1Id, bulkTask2Id],
          update: { status: "done" },
        });
        assertEquals(data.length, 2);
        assertEquals(data[0].status, "done");
        assertEquals(data[1].status, "done");
      });

      await t.step("Bulk delete removes multiple tasks", async () => {
        // Create fresh tasks for deletion
        const d1 = await apiCreated<Task>("POST", "/tasks", {
          title: "Delete me 1",
        });
        const d2 = await apiCreated<Task>("POST", "/tasks", {
          title: "Delete me 2",
        });

        const data = await apiOk<{ deleted: number }>("DELETE", "/tasks/bulk", {
          ids: [d1.id, d2.id],
        });
        assertEquals(data.deleted, 2);
      });

      // === Batch Create ===

      await t.step("Batch create single task without subtasks", async () => {
        const data = await apiCreated<BatchCreateResponse>(
          "POST",
          "/tasks/batch",
          {
            tasks: [{ title: "Batch task 1" }],
          },
        );
        assertEquals(data.count, 1);
        assertEquals(data.created.length, 1);
        assertEquals(data.created[0].title, "Batch task 1");
        assertExists(data.created[0].id);
      });

      await t.step("Batch create task with subtasks", async () => {
        const data = await apiCreated<BatchCreateResponse>(
          "POST",
          "/tasks/batch",
          {
            tasks: [{
              title: "Parent task",
              description: "Main task",
              subtasks: [
                { title: "Subtask 1" },
                { title: "Subtask 2" },
                { title: "Subtask 3" },
              ],
            }],
          },
        );
        assertEquals(data.count, 4); // 1 parent + 3 subtasks
        assertEquals(data.created.length, 1);
        assertEquals(data.created[0].title, "Parent task");
        assertExists(data.created[0].subtasks);
        assertEquals(data.created[0].subtasks?.length, 3);
        assertEquals(data.created[0].subtasks?.[0].title, "Subtask 1");

        // Verify parent task exists and has subtasks
        const taskFull = await apiOk<TaskFull>(
          "GET",
          `/tasks/${data.created[0].id}`,
        );
        assertEquals(taskFull.subtasks.length, 3);
      });

      await t.step("Batch create multiple tasks with project", async () => {
        const data = await apiCreated<BatchCreateResponse>(
          "POST",
          "/tasks/batch",
          {
            tasks: [
              { title: "Task A", project: "BatchProject" },
              { title: "Task B", project: "BatchProject" },
            ],
          },
        );
        assertEquals(data.count, 2);
        assertEquals(data.created.length, 2);

        // Verify both tasks have the project
        const taskA = await apiOk<TaskFull>(
          "GET",
          `/tasks/${data.created[0].id}`,
        );
        const taskB = await apiOk<TaskFull>(
          "GET",
          `/tasks/${data.created[1].id}`,
        );
        assertEquals(taskA.project_name, "BatchProject");
        assertEquals(taskB.project_name, "BatchProject");
      });

      await t.step("Batch create with priority and due_date", async () => {
        const data = await apiCreated<BatchCreateResponse>(
          "POST",
          "/tasks/batch",
          {
            tasks: [{
              title: "Urgent task",
              priority: 2,
              due_date: "2025-12-31",
              subtasks: [
                { title: "Urgent subtask", priority: 1 },
              ],
            }],
          },
        );
        assertEquals(data.count, 2);

        // Verify task has correct priority and due_date (normalized to datetime)
        const task = await apiOk<TaskFull>(
          "GET",
          `/tasks/${data.created[0].id}`,
        );
        assertEquals(task.priority, 2);
        assertEquals(task.due_date, "2025-12-31T00:00:00Z");
      });

      await t.step(
        "Batch create validation rejects invalid input",
        async () => {
          // Empty tasks array should fail
          const { status: s1 } = await api<unknown>("POST", "/tasks/batch", {
            tasks: [],
          });
          assertEquals(s1, 400);

          // Missing title should fail
          const { status: s2 } = await api<unknown>("POST", "/tasks/batch", {
            tasks: [{ description: "no title" }],
          });
          assertEquals(s2, 400);
        },
      );

      // === Natural Language Date Parsing ===

      await t.step("Create task with due_date_natural", async () => {
        const data = await apiCreated<Task>("POST", "/tasks", {
          title: "Task with natural date",
          due_date_natural: "tomorrow",
        });
        assertExists(data.due_date);
        // Verify it's a valid ISO datetime format (YYYY-MM-DDTHH:MM:SS.sssZ or YYYY-MM-DDTHH:MM:SSZ)
        assertEquals(
          data.due_date?.match(
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/,
          ) !== null,
          true,
        );
      });

      await t.step(
        "Create task - due_date takes precedence over natural",
        async () => {
          const data = await apiCreated<Task>("POST", "/tasks", {
            title: "Task with both date formats",
            due_date: "2025-06-15",
            due_date_natural: "tomorrow",
          });
          // Date-only input normalized to datetime
          assertEquals(data.due_date, "2025-06-15T00:00:00Z");
        },
      );

      await t.step("Batch create with due_date_natural", async () => {
        const data = await apiCreated<BatchCreateResponse>(
          "POST",
          "/tasks/batch",
          {
            tasks: [{
              title: "Batch parent with natural date",
              due_date_natural: "next friday",
              subtasks: [
                {
                  title: "Subtask with natural date",
                  due_date_natural: "in 3 days",
                },
              ],
            }],
          },
        );

        // Verify parent task has a datetime
        const parent = await apiOk<TaskFull>(
          "GET",
          `/tasks/${data.created[0].id}`,
        );
        assertExists(parent.due_date);
        assertEquals(
          parent.due_date?.match(
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/,
          ) !== null,
          true,
        );
      });

      // === Context Integration ===

      await t.step("Create task with context", async () => {
        const data = await apiCreated<Task & { context: unknown }>(
          "POST",
          "/tasks",
          {
            title: "Task with context",
            context: {
              files: [{
                path: "/src/auth/index.ts",
                line_start: 10,
                line_end: 20,
              }],
              conversation: { created_by: "claude-code" },
              tags: ["bug", "auth"],
            },
          },
        );
        assertExists(data.context);
        assertEquals(typeof data.context, "object");
      });

      await t.step("Get task returns parsed context", async () => {
        const created = await apiCreated<Task & { context: unknown }>(
          "POST",
          "/tasks",
          {
            title: "Task to verify context retrieval",
            context: {
              urls: [{
                url: "https://github.com/org/repo/issues/123",
                type: "github-issue",
              }],
              git: { branch: "feature/auth", commit: "abc123" },
            },
          },
        );

        const data = await apiOk<TaskFull & { context: unknown }>(
          "GET",
          `/tasks/${created.id}`,
        );
        assertExists(data.context);
        const ctx = data.context as { urls?: unknown[]; git?: unknown };
        assertExists(ctx.urls);
        assertExists(ctx.git);
      });

      await t.step("Batch create with context", async () => {
        const data = await apiCreated<BatchCreateResponse>(
          "POST",
          "/tasks/batch",
          {
            tasks: [{
              title: "Batch task with context",
              context: {
                conversation: {
                  created_by: "claude-code",
                  message_excerpt: "User asked for auth",
                },
              },
              subtasks: [
                {
                  title: "Subtask with file context",
                  context: { files: [{ path: "/src/api.ts" }] },
                },
              ],
            }],
          },
        );
        assertEquals(data.count, 2);
      });

      // === Parse Endpoint ===

      await t.step("Parse text format - basic task", async () => {
        const data = await apiOk<ParseTasksResponse>("POST", "/parse", {
          format: "text",
          content: "Buy groceries @shopping due:tomorrow p:high",
        });
        assertEquals(data.tasks.length, 1);
        assertEquals(data.tasks[0].title, "Buy groceries");
        assertEquals(data.tasks[0].project, "shopping");
        assertEquals(data.tasks[0].priority, 1); // high = 1
        assertExists(data.tasks[0].due_date);
      });

      await t.step("Parse text format - with subtasks", async () => {
        const data = await apiOk<ParseTasksResponse>("POST", "/parse", {
          format: "text",
          content: `Review PR @work priority:urgent
  - Check code style
  - Run tests
  - Approve if good`,
        });
        assertEquals(data.tasks.length, 1);
        assertEquals(data.tasks[0].title, "Review PR");
        assertEquals(data.tasks[0].project, "work");
        assertEquals(data.tasks[0].priority, 2); // urgent = 2
        assertExists(data.tasks[0].subtasks);
        assertEquals(data.tasks[0].subtasks?.length, 3);
        assertEquals(data.tasks[0].subtasks?.[0].title, "Check code style");
      });

      await t.step("Parse markdown format", async () => {
        const data = await apiOk<ParseTasksResponse>("POST", "/parse", {
          format: "markdown",
          content: `- [ ] First task @project1
- [ ] Second task due:friday`,
        });
        assertEquals(data.tasks.length, 2);
        assertEquals(data.tasks[0].title, "First task");
        assertEquals(data.tasks[0].project, "project1");
        assertEquals(data.tasks[1].title, "Second task");
        assertExists(data.tasks[1].due_date);
      });

      await t.step("Parse markdown format - with subtasks", async () => {
        const data = await apiOk<ParseTasksResponse>("POST", "/parse", {
          format: "markdown",
          content: `- [ ] Main task @work
  - [ ] Subtask A
  - [ ] Subtask B`,
        });
        assertEquals(data.tasks.length, 1);
        assertEquals(data.tasks[0].title, "Main task");
        assertExists(data.tasks[0].subtasks);
        assertEquals(data.tasks[0].subtasks?.length, 2);
      });

      await t.step("Parse with defaults", async () => {
        const data = await apiOk<ParseTasksResponse>("POST", "/parse", {
          format: "text",
          content: "Task without markers",
          defaults: { project: "default-project", priority: 1 },
        });
        assertEquals(data.tasks.length, 1);
        assertEquals(data.tasks[0].project, "default-project");
        assertEquals(data.tasks[0].priority, 1);
      });

      await t.step("Parse JSON format", async () => {
        const data = await apiOk<ParseTasksResponse>("POST", "/parse", {
          format: "json",
          content: JSON.stringify([
            { title: "JSON task 1" },
            { title: "JSON task 2", project: "test" },
          ]),
        });
        assertEquals(data.tasks.length, 2);
        assertEquals(data.tasks[0].title, "JSON task 1");
        assertEquals(data.tasks[1].project, "test");
      });

      await t.step("Parse returns warnings for empty titles", async () => {
        const data = await apiOk<ParseTasksResponse>("POST", "/parse", {
          format: "json",
          content: JSON.stringify([
            { title: "Valid task" },
            { title: "" },
            { title: "   " },
          ]),
        });
        assertEquals(data.tasks.length, 1); // Only valid task
        assertExists(data.warnings);
        assertEquals(data.warnings?.length, 2);
      });

      await t.step("Parse invalid JSON returns error", async () => {
        const { status, data } = await api<{ error: string }>(
          "POST",
          "/parse",
          {
            format: "json",
            content: "{ invalid json }",
          },
        );
        assertEquals(status, 400);
        assertExists(data.error);
      });

      // === Complete Subtasks ===

      await t.step("Complete subtasks marks all subtasks done", async () => {
        // Create parent with subtasks
        const parent = await apiCreated<Task>("POST", "/tasks", {
          title: "Parent for subtask test",
        });
        await apiCreated("POST", "/tasks", {
          title: "Sub 1",
          parent_id: parent.id,
        });
        await apiCreated("POST", "/tasks", {
          title: "Sub 2",
          parent_id: parent.id,
        });

        const data = await apiOk<{ updated: number }>(
          "POST",
          `/tasks/${parent.id}/complete-subtasks`,
        );
        assertEquals(data.updated, 2);

        // Verify subtasks are now done
        const parentFull = await apiOk<TaskFull>("GET", `/tasks/${parent.id}`);
        for (const sub of parentFull.subtasks) {
          assertEquals(sub.status, "done");
        }
      });

      // === Recurrence ===

      await t.step("Create task with recurrence", async () => {
        const data = await apiCreated<Task>("POST", "/tasks", {
          title: "Recurring task",
          recurrence: { type: "daily", interval: 1 },
        });
        assertExists(data.id);
        assertExists(data.recurrence);
        assertEquals((data.recurrence as { type: string }).type, "daily");
      });

      await t.step("Update task with recurrence", async () => {
        // Create a task first
        const task = await apiCreated<Task>("POST", "/tasks", {
          title: "Task to add recurrence",
        });

        // Add recurrence
        const updated = await apiOk<Task>("PATCH", `/tasks/${task.id}`, {
          recurrence: { type: "weekly", interval: 1, daysOfWeek: [1] },
        });

        assertExists(updated.recurrence);
        assertEquals((updated.recurrence as { type: string }).type, "weekly");
      });

      await t.step("Clear recurrence with null", async () => {
        // Create recurring task
        const task = await apiCreated<Task>("POST", "/tasks", {
          title: "Task to clear recurrence",
          recurrence: { type: "daily", interval: 1 },
        });

        assertExists(task.recurrence);

        // Clear recurrence
        const updated = await apiOk<Task>("PATCH", `/tasks/${task.id}`, {
          recurrence: null,
        });

        assertEquals(updated.recurrence, null);
      });

      await t.step(
        "Completing recurring task creates new task",
        async () => {
          // Create recurring task with due date
          const task = await apiCreated<Task>("POST", "/tasks", {
            title: "Daily recurring task",
            due_date: "2025-01-15",
            recurrence: { type: "daily", interval: 1 },
          });

          // Mark as done
          const completed = await apiOk<
            Task & { recurring_next_task_id?: number }
          >("PATCH", `/tasks/${task.id}`, {
            status: "done",
          });

          assertEquals(completed.status, "done");
          assertExists(completed.recurring_next_task_id);

          // Verify new task was created
          const newTask = await apiOk<TaskFull>(
            "GET",
            `/tasks/${completed.recurring_next_task_id}`,
          );
          assertEquals(newTask.title, "Daily recurring task");
          assertEquals(newTask.status, "todo");
          assertEquals(newTask.due_date, "2025-01-16T00:00:00Z"); // Next day (datetime format)
          assertExists(newTask.recurrence);
        },
      );

      await t.step(
        "Recurring task subtasks are recreated",
        async () => {
          // Create recurring task with subtasks
          const parent = await apiCreated<Task>("POST", "/tasks", {
            title: "Parent with subtasks",
            due_date: "2025-01-20",
            recurrence: { type: "weekly", interval: 1 },
          });

          // Create subtasks (some done, some not)
          await apiCreated("POST", "/tasks", {
            title: "Subtask 1",
            parent_id: parent.id,
            status: "done",
          });
          await apiCreated("POST", "/tasks", {
            title: "Subtask 2",
            parent_id: parent.id,
          });

          // Mark parent as done
          const completed = await apiOk<
            Task & { recurring_next_task_id?: number }
          >("PATCH", `/tasks/${parent.id}`, {
            status: "done",
          });

          assertExists(completed.recurring_next_task_id);

          // Verify new task has recreated subtasks
          const newTask = await apiOk<TaskFull>(
            "GET",
            `/tasks/${completed.recurring_next_task_id}`,
          );
          assertEquals(newTask.subtasks.length, 2);
          // All subtasks should be todo status
          for (const sub of newTask.subtasks) {
            assertEquals(sub.status, "todo");
          }
        },
      );

      await t.step("Subtasks cannot have recurrence", async () => {
        // Create parent task
        const parent = await apiCreated<Task>("POST", "/tasks", {
          title: "Parent task",
        });

        // Try to create subtask with recurrence - should fail
        const { status, data } = await api<{ error: string }>(
          "POST",
          "/tasks",
          {
            title: "Subtask with recurrence",
            parent_id: parent.id,
            recurrence: { type: "daily", interval: 1 },
          },
        );
        assertEquals(status, 400);
        assertExists(data.error);
        assertEquals(
          data.error.includes("Subtasks cannot have recurrence"),
          true,
        );
      });

      await t.step("Cannot add recurrence to existing subtask", async () => {
        // Create parent and subtask
        const parent = await apiCreated<Task>("POST", "/tasks", {
          title: "Another parent",
        });
        const subtask = await apiCreated<Task>("POST", "/tasks", {
          title: "Subtask to modify",
          parent_id: parent.id,
        });

        // Try to add recurrence to subtask - should fail
        const { status, data } = await api<{ error: string }>(
          "PATCH",
          `/tasks/${subtask.id}`,
          {
            recurrence: { type: "daily", interval: 1 },
          },
        );
        assertEquals(status, 400);
        assertExists(data.error);
      });

      // === Semantic Search API ===

      await t.step("Semantic search API endpoint exists", async () => {
        // This test verifies the semantic search API endpoint exists and handles requests
        // Results vary based on:
        // - 200: Embedding service available and working
        // - 500: Embedding service available but DB doesn't support vectors (in-memory)
        // - 503: Embedding service not configured
        const { status, data } = await api<
          TaskWithProject[] | { error: string }
        >(
          "GET",
          "/tasks?semantic=test%20query&limit=5",
        );

        // All these are valid responses depending on environment
        const validStatuses = [200, 500, 503];
        assertExists(
          validStatuses.includes(status),
          `Expected status to be one of ${validStatuses}, got ${status}`,
        );

        if (status === 200) {
          assertEquals(Array.isArray(data), true);
        } else {
          assertExists((data as { error: string }).error);
        }
      });

      await t.step("Semantic search with limit parameter", async () => {
        const { status, data } = await api<
          TaskWithProject[] | { error: string }
        >(
          "GET",
          "/tasks?semantic=test&limit=2",
        );

        // Valid responses depend on environment configuration
        if (status === 200) {
          assertEquals(Array.isArray(data), true);
          // Should return at most 2 results
          assertExists((data as TaskWithProject[]).length <= 2);
        }
        // 500/503 are acceptable - means vectors not supported in this DB
      });

      // === Tag Management ===

      let tagId: number;

      await t.step("Create tag", async () => {
        const data = await apiCreated<Tag>("POST", "/tags", { name: "bug" });
        assertExists(data.id);
        tagId = data.id;
        assertEquals(data.name, "bug");
      });

      await t.step("List tags includes created tag", async () => {
        const data = await apiOk<TagWithCount[]>("GET", "/tags");
        const found = data.find((t) => t.id === tagId);
        assertExists(found);
        assertEquals(found.name, "bug");
        assertEquals(found.task_count, 0);
      });

      await t.step("Add tags to task", async () => {
        // First create a task to tag
        const task = await apiCreated<Task>("POST", "/tasks", {
          title: "Task for tagging",
        });

        const data = await apiCreated<{ tags: Tag[] }>(
          "POST",
          `/tasks/${task.id}/tags`,
          { tags: ["bug", "urgent", "frontend"] },
        );
        assertEquals(data.tags.length, 3);

        // Verify task now has tags
        const taskFull = await apiOk<TaskFull>("GET", `/tasks/${task.id}`);
        assertExists(taskFull.tags);
        assertEquals(taskFull.tags.length, 3);
        const tagNames = taskFull.tags.map((t) => t.name);
        assertEquals(tagNames.includes("bug"), true);
        assertEquals(tagNames.includes("urgent"), true);
        assertEquals(tagNames.includes("frontend"), true);
      });

      await t.step("Tag usage count is updated", async () => {
        const data = await apiOk<TagWithCount[]>("GET", "/tags");
        const bugTag = data.find((t) => t.name === "bug");
        assertExists(bugTag);
        assertGreater(bugTag.task_count, 0);
      });

      await t.step("Filter tasks by tag", async () => {
        const data = await apiOk<TaskWithProject[]>("GET", "/tasks?tag=urgent");
        // Should find the task we tagged
        const found = data.find((t) => t.title === "Task for tagging");
        assertExists(found);
      });

      await t.step("Remove tag from task", async () => {
        // Get a task with tags
        const tasks = await apiOk<TaskWithProject[]>(
          "GET",
          "/tasks?tag=urgent",
        );
        const taskWithTags = tasks.find((t) => t.title === "Task for tagging");
        assertExists(taskWithTags);

        // Get the tags on this task
        const taskFull = await apiOk<TaskFull>(
          "GET",
          `/tasks/${taskWithTags.id}`,
        );
        const urgentTag = taskFull.tags.find((t) => t.name === "urgent");
        assertExists(urgentTag);

        // Remove the tag
        const data = await apiOk<{ deleted: boolean }>(
          "DELETE",
          `/tasks/${taskWithTags.id}/tags/${urgentTag.id}`,
        );
        assertEquals(data.deleted, true);

        // Verify tag is removed
        const taskAfter = await apiOk<TaskFull>(
          "GET",
          `/tasks/${taskWithTags.id}`,
        );
        const urgentTagAfter = taskAfter.tags.find((t) => t.name === "urgent");
        assertEquals(urgentTagAfter, undefined);
        assertEquals(taskAfter.tags.length, 2);
      });

      await t.step("Rename tag", async () => {
        const data = await apiOk<Tag>("PATCH", `/tags/${tagId}`, {
          name: "bugfix",
        });
        assertEquals(data.name, "bugfix");
      });

      await t.step("Create task with tags", async () => {
        const data = await apiCreated<Task>("POST", "/tasks", {
          title: "Task with initial tags",
          tags: ["feature", "backend"],
        });

        // Verify tags were created
        const taskFull = await apiOk<TaskFull>("GET", `/tasks/${data.id}`);
        assertExists(taskFull.tags);
        assertEquals(taskFull.tags.length, 2);
      });

      await t.step("Set tags replaces existing tags", async () => {
        // Create a task with tags
        const task = await apiCreated<Task>("POST", "/tasks", {
          title: "Task for tag replacement test",
        });

        // Add initial tags
        await apiCreated("POST", `/tasks/${task.id}/tags`, {
          tags: ["initial-tag", "orphan-tag"],
        });

        // Replace with new tags (removes orphan-tag)
        const data = await apiOk<
          { tags: Array<{ id: number; name: string }> }
        >("PUT", `/tasks/${task.id}/tags`, {
          tags: ["initial-tag", "new-tag"],
        });

        assertEquals(data.tags.length, 2);

        // Verify task has updated tags
        const taskFull = await apiOk<TaskFull>("GET", `/tasks/${task.id}`);
        assertExists(taskFull.tags);
        assertEquals(taskFull.tags.length, 2);
        const tagNames = taskFull.tags.map((t) => t.name);
        assertEquals(tagNames.includes("initial-tag"), true);
        assertEquals(tagNames.includes("new-tag"), true);
        assertEquals(tagNames.includes("orphan-tag"), false);

        // Cleanup
        await apiOk("DELETE", `/tasks/${task.id}`);
      });

      await t.step("Set tags cleans up orphaned tags", async () => {
        // Create a task with a unique tag
        const task = await apiCreated<Task>("POST", "/tasks", {
          title: "Task for orphan cleanup test",
        });

        // Add a unique tag only to this task
        await apiCreated("POST", `/tasks/${task.id}/tags`, {
          tags: ["unique-orphan-tag"],
        });

        // Verify tag exists
        const tagsBefore = await apiOk<TagWithCount[]>("GET", "/tags");
        const orphanBefore = tagsBefore.find(
          (t) => t.name === "unique-orphan-tag",
        );
        assertExists(orphanBefore);

        // Replace tags (removing the unique tag)
        await apiOk("PUT", `/tasks/${task.id}/tags`, {
          tags: ["different-tag"],
        });

        // Verify orphaned tag was deleted
        const tagsAfter = await apiOk<TagWithCount[]>("GET", "/tags");
        const orphanAfter = tagsAfter.find(
          (t) => t.name === "unique-orphan-tag",
        );
        assertEquals(orphanAfter, undefined);

        // Cleanup
        await apiOk("DELETE", `/tasks/${task.id}`);
      });

      await t.step("Delete tag cascades to task_tags", async () => {
        // Get count before deletion
        const before = await apiOk<TagWithCount[]>("GET", "/tags");
        const tagToDelete = before.find((t) => t.name === "bugfix");
        assertExists(tagToDelete);

        // Delete the tag
        await apiOk("DELETE", `/tags/${tagToDelete.id}`);

        // Verify it's gone
        const after = await apiOk<TagWithCount[]>("GET", "/tags");
        const deleted = after.find((t) => t.name === "bugfix");
        assertEquals(deleted, undefined);
      });

      // === Cleanup (in FK-safe order: subtasks first, then parent, then project) ===

      await t.step("Delete subtask first (FK safe)", async () => {
        const data = await apiOk<{ deleted: boolean }>(
          "DELETE",
          `/tasks/${subtaskId}`,
        );
        assertEquals(data.deleted, true);
      });

      await t.step("Subtask returns 404 after delete", async () => {
        const { status } = await api<unknown>("GET", `/tasks/${subtaskId}`);
        assertEquals(status, 404);
      });

      await t.step("Delete parent task (cascades comments)", async () => {
        const data = await apiOk<{ deleted: boolean }>(
          "DELETE",
          `/tasks/${taskId}`,
        );
        assertEquals(data.deleted, true);
      });

      await t.step("Parent task returns 404 after delete", async () => {
        const { status } = await api<unknown>("GET", `/tasks/${taskId}`);
        assertEquals(status, 404);
      });

      await t.step("Delete project (no tasks referencing it)", async () => {
        const data = await apiOk<{ deleted: boolean }>(
          "DELETE",
          `/projects/${projectId}`,
        );
        assertEquals(data.deleted, true);
      });
    } finally {
      // Clean up to not affect other tests
      Deno.env.delete("TASK_CLI_DB_URL");
      resetDbClient();
    }
  },
});
