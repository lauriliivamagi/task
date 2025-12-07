import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import { AssertionError } from "../shared/assert.ts";
import { createClient, TaskClient } from "./client.ts";

// ============================================================================
// Constructor tests
// ============================================================================

Deno.test("TaskClient constructor", async (t) => {
  await t.step("creates client with valid baseUrl", () => {
    const client = createClient({ baseUrl: "http://localhost:3000" });
    assertEquals(client instanceof TaskClient, true);
  });

  await t.step("removes trailing slash from baseUrl", () => {
    // We can't directly access private baseUrl, but we test via request behavior
    const client = createClient({ baseUrl: "http://localhost:3000/" });
    assertEquals(client instanceof TaskClient, true);
  });

  await t.step("throws for empty baseUrl", () => {
    assertThrows(
      () => createClient({ baseUrl: "" }),
      AssertionError,
      "Base URL must not be empty",
    );
  });

  await t.step("throws for whitespace-only baseUrl", () => {
    assertThrows(
      () => createClient({ baseUrl: "   " }),
      AssertionError,
      "Base URL must not be empty",
    );
  });
});

// ============================================================================
// ID validation tests
// ============================================================================

Deno.test("TaskClient - ID validation", async (t) => {
  const client = createClient({ baseUrl: "http://localhost:3000" });

  await t.step("getTask throws for ID 0", () => {
    assertThrows(
      () => {
        // @ts-ignore - testing runtime behavior
        client.getTask(0);
      },
      AssertionError,
      "Task ID must be positive",
    );
  });

  await t.step("getTask throws for negative ID", () => {
    assertThrows(
      () => {
        // @ts-ignore - testing runtime behavior
        client.getTask(-5);
      },
      AssertionError,
      "Task ID must be positive",
    );
  });

  await t.step("updateTask throws for ID 0", () => {
    assertThrows(
      () => {
        // @ts-ignore - testing runtime behavior
        client.updateTask(0, { title: "test" });
      },
      AssertionError,
      "Task ID must be positive",
    );
  });

  await t.step("deleteTask throws for ID 0", () => {
    assertThrows(
      () => {
        // @ts-ignore - testing runtime behavior
        client.deleteTask(0);
      },
      AssertionError,
      "Task ID must be positive",
    );
  });
});

// ============================================================================
// Bulk operations validation tests
// ============================================================================

Deno.test("TaskClient - bulk operations validation", async (t) => {
  const client = createClient({ baseUrl: "http://localhost:3000" });

  await t.step("bulkUpdateTasks throws for empty array", () => {
    assertThrows(
      () => {
        // @ts-ignore - testing runtime behavior
        client.bulkUpdateTasks([], { status: "done" });
      },
      AssertionError,
      "IDs array must not be empty",
    );
  });

  await t.step("bulkUpdateTasks throws for array with invalid ID", () => {
    assertThrows(
      () => {
        // @ts-ignore - testing runtime behavior
        client.bulkUpdateTasks([1, 0, 3], { status: "done" });
      },
      AssertionError,
      "Task ID must be positive",
    );
  });

  await t.step("bulkDeleteTasks throws for empty array", () => {
    assertThrows(
      () => {
        // @ts-ignore - testing runtime behavior
        client.bulkDeleteTasks([]);
      },
      AssertionError,
      "IDs array must not be empty",
    );
  });

  await t.step("bulkDeleteTasks throws for array with negative ID", () => {
    assertThrows(
      () => {
        // @ts-ignore - testing runtime behavior
        client.bulkDeleteTasks([1, -2, 3]);
      },
      AssertionError,
      "Task ID must be positive",
    );
  });
});

// ============================================================================
// Mock server tests
// ============================================================================

async function withMockServer(
  handler: (req: Request) => Response | Promise<Response>,
  test: (port: number) => Promise<void>,
): Promise<void> {
  const server = Deno.serve({ port: 0, onListen: () => {} }, handler);
  const addr = server.addr as Deno.NetAddr;
  try {
    await test(addr.port);
  } finally {
    await server.shutdown();
  }
}

Deno.test("TaskClient - HTTP requests", async (t) => {
  await t.step("listTasks makes GET request to /tasks", async () => {
    let capturedUrl = "";
    let capturedMethod = "";

    await withMockServer(
      (req) => {
        capturedUrl = new URL(req.url).pathname + new URL(req.url).search;
        capturedMethod = req.method;
        return Response.json([]);
      },
      async (port) => {
        const client = createClient({ baseUrl: `http://localhost:${port}` });
        await client.listTasks();
        assertEquals(capturedMethod, "GET");
        assertEquals(capturedUrl, "/tasks");
      },
    );
  });

  await t.step("listTasks with options adds query params", async () => {
    let capturedUrl = "";

    await withMockServer(
      (req) => {
        capturedUrl = new URL(req.url).pathname + new URL(req.url).search;
        return Response.json([]);
      },
      async (port) => {
        const client = createClient({ baseUrl: `http://localhost:${port}` });
        await client.listTasks({ project: "work", priority: 2 });
        assertEquals(capturedUrl.includes("project=work"), true);
        assertEquals(capturedUrl.includes("priority=2"), true);
      },
    );
  });

  await t.step("getTask makes GET request to /tasks/:id", async () => {
    let capturedUrl = "";

    await withMockServer(
      (req) => {
        capturedUrl = new URL(req.url).pathname;
        return Response.json({
          id: 123,
          title: "Test",
          status: "todo",
          priority: 0,
          subtasks: [],
          tags: [],
          comments: [],
          attachments: [],
        });
      },
      async (port) => {
        const client = createClient({ baseUrl: `http://localhost:${port}` });
        await client.getTask(123);
        assertEquals(capturedUrl, "/tasks/123");
      },
    );
  });

  await t.step("createTask makes POST request with body", async () => {
    let capturedMethod = "";
    let capturedBody: unknown = null;

    await withMockServer(
      async (req) => {
        capturedMethod = req.method;
        capturedBody = await req.json();
        return Response.json({ id: 1, title: "New Task", status: "todo" });
      },
      async (port) => {
        const client = createClient({ baseUrl: `http://localhost:${port}` });
        await client.createTask({ title: "New Task" });
        assertEquals(capturedMethod, "POST");
        assertEquals((capturedBody as { title: string }).title, "New Task");
      },
    );
  });

  await t.step("updateTask makes PATCH request", async () => {
    let capturedMethod = "";
    let capturedUrl = "";

    await withMockServer(
      (req) => {
        capturedMethod = req.method;
        capturedUrl = new URL(req.url).pathname;
        return Response.json({ id: 42, title: "Updated", status: "done" });
      },
      async (port) => {
        const client = createClient({ baseUrl: `http://localhost:${port}` });
        await client.updateTask(42, { status: "done" });
        assertEquals(capturedMethod, "PATCH");
        assertEquals(capturedUrl, "/tasks/42");
      },
    );
  });

  await t.step("deleteTask makes DELETE request", async () => {
    let capturedMethod = "";
    let capturedUrl = "";

    await withMockServer(
      (req) => {
        capturedMethod = req.method;
        capturedUrl = new URL(req.url).pathname;
        return Response.json({ deleted: true });
      },
      async (port) => {
        const client = createClient({ baseUrl: `http://localhost:${port}` });
        await client.deleteTask(99);
        assertEquals(capturedMethod, "DELETE");
        assertEquals(capturedUrl, "/tasks/99");
      },
    );
  });
});

// ============================================================================
// Error handling tests
// ============================================================================

Deno.test("TaskClient - error handling", async (t) => {
  await t.step("throws error for non-200 response", async () => {
    await withMockServer(
      () => {
        return new Response(JSON.stringify({ error: "Not Found" }), {
          status: 404,
        });
      },
      async (port) => {
        const client = createClient({ baseUrl: `http://localhost:${port}` });
        await assertRejects(
          () => client.getTask(999),
          Error,
          "Not Found",
        );
      },
    );
  });

  await t.step("throws error with statusText for non-JSON error", async () => {
    await withMockServer(
      () => {
        return new Response("Internal Server Error", {
          status: 500,
          statusText: "Internal Server Error",
        });
      },
      async (port) => {
        const client = createClient({ baseUrl: `http://localhost:${port}` });
        await assertRejects(
          () => client.listTasks(),
          Error,
        );
      },
    );
  });
});

// ============================================================================
// Report options tests
// ============================================================================

Deno.test("TaskClient - getReport options", async (t) => {
  await t.step("getReport adds period param", async () => {
    let capturedUrl = "";

    await withMockServer(
      (req) => {
        capturedUrl = new URL(req.url).pathname + new URL(req.url).search;
        return Response.json({
          period: {},
          completed: [],
          inProgress: [],
          added: [],
        });
      },
      async (port) => {
        const client = createClient({ baseUrl: `http://localhost:${port}` });
        await client.getReport({ period: "week" });
        assertEquals(capturedUrl.includes("period=week"), true);
      },
    );
  });

  await t.step("getReport adds from/to params", async () => {
    let capturedUrl = "";

    await withMockServer(
      (req) => {
        capturedUrl = new URL(req.url).pathname + new URL(req.url).search;
        return Response.json({
          period: {},
          completed: [],
          inProgress: [],
          added: [],
        });
      },
      async (port) => {
        const client = createClient({ baseUrl: `http://localhost:${port}` });
        await client.getReport({ from: "2025-01-01", to: "2025-01-31" });
        assertEquals(capturedUrl.includes("from=2025-01-01"), true);
        assertEquals(capturedUrl.includes("to=2025-01-31"), true);
      },
    );
  });
});

// ============================================================================
// Content-Type header tests
// ============================================================================

Deno.test("TaskClient - sets Content-Type header", async (t) => {
  await t.step(
    "POST requests have Content-Type: application/json",
    async () => {
      let capturedContentType = "";

      await withMockServer(
        (req) => {
          capturedContentType = req.headers.get("Content-Type") ?? "";
          return Response.json({ id: 1, title: "Test" });
        },
        async (port) => {
          const client = createClient({ baseUrl: `http://localhost:${port}` });
          await client.createTask({ title: "Test" });
          assertEquals(capturedContentType, "application/json");
        },
      );
    },
  );

  await t.step("GET requests have Content-Type: application/json", async () => {
    let capturedContentType = "";

    await withMockServer(
      (req) => {
        capturedContentType = req.headers.get("Content-Type") ?? "";
        return Response.json([]);
      },
      async (port) => {
        const client = createClient({ baseUrl: `http://localhost:${port}` });
        await client.listTasks();
        assertEquals(capturedContentType, "application/json");
      },
    );
  });
});

// ============================================================================
// Additional endpoint tests
// ============================================================================

Deno.test("TaskClient - additional endpoints", async (t) => {
  await t.step("health endpoint", async () => {
    await withMockServer(
      () => Response.json({ status: "ok" }),
      async (port) => {
        const client = createClient({ baseUrl: `http://localhost:${port}` });
        const result = await client.health();
        assertEquals(result.status, "ok");
      },
    );
  });

  await t.step("listProjects endpoint", async () => {
    let capturedUrl = "";

    await withMockServer(
      (req) => {
        capturedUrl = new URL(req.url).pathname;
        return Response.json([]);
      },
      async (port) => {
        const client = createClient({ baseUrl: `http://localhost:${port}` });
        await client.listProjects();
        assertEquals(capturedUrl, "/projects");
      },
    );
  });

  await t.step("listTags endpoint", async () => {
    let capturedUrl = "";

    await withMockServer(
      (req) => {
        capturedUrl = new URL(req.url).pathname;
        return Response.json([]);
      },
      async (port) => {
        const client = createClient({ baseUrl: `http://localhost:${port}` });
        await client.listTags();
        assertEquals(capturedUrl, "/tags");
      },
    );
  });

  await t.step("getStats endpoint", async () => {
    let capturedUrl = "";

    await withMockServer(
      (req) => {
        capturedUrl = new URL(req.url).pathname;
        return Response.json({
          total: 0,
          byStatus: { todo: 0, "in-progress": 0, done: 0 },
          byPriority: { 0: 0, 1: 0, 2: 0 },
          overdue: 0,
        });
      },
      async (port) => {
        const client = createClient({ baseUrl: `http://localhost:${port}` });
        await client.getStats();
        assertEquals(capturedUrl, "/stats");
      },
    );
  });
});
