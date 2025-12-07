/**
 * Tests for TUI State Persistence
 *
 * Uses filesystem abstractions (MemoryFS and AgentFS) to test the tui-state
 * module without touching the real filesystem.
 */

import { assertEquals } from "@std/assert";
import { AgentFileSystem, MemoryFS } from "../shared/fs-abstraction.ts";
import {
  DEFAULT_STATE,
  getLastSelectedTaskId,
  loadTuiState,
  saveLastSelectedTaskId,
  saveTuiState,
} from "./tui-state.ts";

// === MemoryFS Tests ===

Deno.test("tui-state with MemoryFS - loadTuiState returns default when file doesn't exist", async () => {
  const fs = new MemoryFS();
  const stateFile = "/test/tui-state.json";

  const state = await loadTuiState(fs, stateFile);

  assertEquals(state, DEFAULT_STATE);
  assertEquals(state.lastSelectedTaskId, null);
});

Deno.test("tui-state with MemoryFS - saveTuiState creates file with state", async () => {
  const fs = new MemoryFS();
  const stateFile = "/test/tui-state.json";

  await saveTuiState({ lastSelectedTaskId: 42 }, fs, stateFile);

  const files = fs.getFiles();
  assertEquals(files.has(stateFile), true);

  const content = await fs.readTextFile(stateFile);
  const parsed = JSON.parse(content);
  assertEquals(parsed.lastSelectedTaskId, 42);
});

Deno.test("tui-state with MemoryFS - loadTuiState reads saved state", async () => {
  const fs = new MemoryFS();
  const stateFile = "/test/tui-state.json";

  // Save state
  await saveTuiState({ lastSelectedTaskId: 123 }, fs, stateFile);

  // Load it back
  const state = await loadTuiState(fs, stateFile);

  assertEquals(state.lastSelectedTaskId, 123);
});

Deno.test("tui-state with MemoryFS - saveTuiState merges with existing state", async () => {
  const fs = new MemoryFS();
  const stateFile = "/test/tui-state.json";

  // Save initial state
  await saveTuiState({ lastSelectedTaskId: 100 }, fs, stateFile);

  // Save updated state (should merge)
  await saveTuiState({ lastSelectedTaskId: 200 }, fs, stateFile);

  const state = await loadTuiState(fs, stateFile);
  assertEquals(state.lastSelectedTaskId, 200);
});

Deno.test("tui-state with MemoryFS - loadTuiState handles invalid JSON", async () => {
  const fs = new MemoryFS();
  const stateFile = "/test/tui-state.json";

  // Write invalid JSON
  await fs.writeTextFile(stateFile, "not valid json {{{");

  // Should return default state without throwing
  const state = await loadTuiState(fs, stateFile);
  assertEquals(state, DEFAULT_STATE);
});

Deno.test("tui-state with MemoryFS - loadTuiState handles missing lastSelectedTaskId", async () => {
  const fs = new MemoryFS();
  const stateFile = "/test/tui-state.json";

  // Write JSON without lastSelectedTaskId
  await fs.writeTextFile(
    stateFile,
    JSON.stringify({ someOtherField: "value" }),
  );

  const state = await loadTuiState(fs, stateFile);
  assertEquals(state.lastSelectedTaskId, null);
});

Deno.test("tui-state with MemoryFS - loadTuiState handles non-number lastSelectedTaskId", async () => {
  const fs = new MemoryFS();
  const stateFile = "/test/tui-state.json";

  // Write JSON with string lastSelectedTaskId
  await fs.writeTextFile(
    stateFile,
    JSON.stringify({ lastSelectedTaskId: "not a number" }),
  );

  const state = await loadTuiState(fs, stateFile);
  assertEquals(state.lastSelectedTaskId, null);
});

Deno.test("tui-state with MemoryFS - getLastSelectedTaskId returns null by default", async () => {
  const fs = new MemoryFS();
  const stateFile = "/test/tui-state.json";

  const taskId = await getLastSelectedTaskId(fs, stateFile);
  assertEquals(taskId, null);
});

Deno.test("tui-state with MemoryFS - getLastSelectedTaskId returns saved task ID", async () => {
  const fs = new MemoryFS();
  const stateFile = "/test/tui-state.json";

  await saveTuiState({ lastSelectedTaskId: 999 }, fs, stateFile);

  const taskId = await getLastSelectedTaskId(fs, stateFile);
  assertEquals(taskId, 999);
});

Deno.test("tui-state with MemoryFS - saveLastSelectedTaskId saves task ID", async () => {
  const fs = new MemoryFS();
  const stateFile = "/test/tui-state.json";

  saveLastSelectedTaskId(777, fs, stateFile);

  // Wait a bit for fire-and-forget to complete
  await new Promise((resolve) => setTimeout(resolve, 50));

  const taskId = await getLastSelectedTaskId(fs, stateFile);
  assertEquals(taskId, 777);
});

Deno.test("tui-state with MemoryFS - saveLastSelectedTaskId can save null", async () => {
  const fs = new MemoryFS();
  const stateFile = "/test/tui-state.json";

  // First save a task ID
  await saveTuiState({ lastSelectedTaskId: 555 }, fs, stateFile);

  // Then clear it
  saveLastSelectedTaskId(null, fs, stateFile);
  await new Promise((resolve) => setTimeout(resolve, 50));

  const taskId = await getLastSelectedTaskId(fs, stateFile);
  assertEquals(taskId, null);
});

Deno.test("tui-state with MemoryFS - saveTuiState creates nested directories", async () => {
  const fs = new MemoryFS();
  const stateFile = "/deeply/nested/path/tui-state.json";

  await saveTuiState({ lastSelectedTaskId: 1 }, fs, stateFile);

  const exists = await fs.exists(stateFile);
  assertEquals(exists, true);
});

// === AgentFS Tests ===

Deno.test("tui-state with AgentFS - loadTuiState returns default when file doesn't exist", async () => {
  const fs = new AgentFileSystem();
  const stateFile = "/agent-test/tui-state.json";

  try {
    const state = await loadTuiState(fs, stateFile);
    assertEquals(state, DEFAULT_STATE);
  } finally {
    await fs.close();
  }
});

Deno.test("tui-state with AgentFS - saveTuiState and loadTuiState roundtrip", async () => {
  const fs = new AgentFileSystem();
  const stateFile = "/agent-test/tui-state.json";

  try {
    await saveTuiState({ lastSelectedTaskId: 42 }, fs, stateFile);
    const state = await loadTuiState(fs, stateFile);

    assertEquals(state.lastSelectedTaskId, 42);
  } finally {
    await fs.close();
  }
});

Deno.test("tui-state with AgentFS - multiple saves and loads", async () => {
  const fs = new AgentFileSystem();
  const stateFile = "/agent-test/state.json";

  try {
    // Save first state
    await saveTuiState({ lastSelectedTaskId: 1 }, fs, stateFile);
    let state = await loadTuiState(fs, stateFile);
    assertEquals(state.lastSelectedTaskId, 1);

    // Update state
    await saveTuiState({ lastSelectedTaskId: 2 }, fs, stateFile);
    state = await loadTuiState(fs, stateFile);
    assertEquals(state.lastSelectedTaskId, 2);

    // Update again
    await saveTuiState({ lastSelectedTaskId: 3 }, fs, stateFile);
    state = await loadTuiState(fs, stateFile);
    assertEquals(state.lastSelectedTaskId, 3);
  } finally {
    await fs.close();
  }
});

Deno.test("tui-state with AgentFS - getLastSelectedTaskId and saveLastSelectedTaskId", async () => {
  const fs = new AgentFileSystem();
  const stateFile = "/agent-test/selected.json";

  try {
    // Initially null
    let taskId = await getLastSelectedTaskId(fs, stateFile);
    assertEquals(taskId, null);

    // Save a task ID
    saveLastSelectedTaskId(888, fs, stateFile);
    await new Promise((resolve) => setTimeout(resolve, 50));

    taskId = await getLastSelectedTaskId(fs, stateFile);
    assertEquals(taskId, 888);

    // Clear it
    saveLastSelectedTaskId(null, fs, stateFile);
    await new Promise((resolve) => setTimeout(resolve, 50));

    taskId = await getLastSelectedTaskId(fs, stateFile);
    assertEquals(taskId, null);
  } finally {
    await fs.close();
  }
});

Deno.test("tui-state with AgentFS - handles corrupted state file", async () => {
  const fs = new AgentFileSystem();
  const stateFile = "/agent-test/corrupt.json";

  try {
    // Write garbage
    await fs.writeTextFile(stateFile, "{{{{not json}}}}");

    // Should return default state
    const state = await loadTuiState(fs, stateFile);
    assertEquals(state, DEFAULT_STATE);
  } finally {
    await fs.close();
  }
});

Deno.test("tui-state with AgentFS - isolation between instances", async () => {
  // Each AgentFileSystem gets its own in-memory database
  const fs1 = new AgentFileSystem();
  const fs2 = new AgentFileSystem();
  const stateFile = "/shared/state.json";

  try {
    // Save in fs1
    await saveTuiState({ lastSelectedTaskId: 111 }, fs1, stateFile);

    // fs1 should have the state
    const state1 = await loadTuiState(fs1, stateFile);
    assertEquals(state1.lastSelectedTaskId, 111);

    // fs2 should NOT have the state (separate database)
    const state2 = await loadTuiState(fs2, stateFile);
    assertEquals(state2.lastSelectedTaskId, null);
  } finally {
    await fs1.close();
    await fs2.close();
  }
});

// === MemoryFS Unit Tests ===

Deno.test("MemoryFS - readTextFile throws for non-existent file", async () => {
  const fs = new MemoryFS();

  let threw = false;
  try {
    await fs.readTextFile("/nonexistent.txt");
  } catch (e) {
    threw = true;
    assertEquals(e instanceof Deno.errors.NotFound, true);
  }

  assertEquals(threw, true);
});

Deno.test("MemoryFS - writeTextFile and readTextFile roundtrip", async () => {
  const fs = new MemoryFS();

  await fs.writeTextFile("/test.txt", "Hello, World!");
  const content = await fs.readTextFile("/test.txt");

  assertEquals(content, "Hello, World!");
});

Deno.test("MemoryFS - exists returns false for non-existent paths", async () => {
  const fs = new MemoryFS();

  assertEquals(await fs.exists("/nonexistent"), false);
});

Deno.test("MemoryFS - exists returns true for files", async () => {
  const fs = new MemoryFS();

  await fs.writeTextFile("/file.txt", "content");
  assertEquals(await fs.exists("/file.txt"), true);
});

Deno.test("MemoryFS - exists returns true for directories", async () => {
  const fs = new MemoryFS();

  await fs.ensureDir("/mydir");
  assertEquals(await fs.exists("/mydir"), true);
});

Deno.test("MemoryFS - ensureDir creates nested directories", async () => {
  const fs = new MemoryFS();

  await fs.ensureDir("/a/b/c/d");

  assertEquals(await fs.exists("/a"), true);
  assertEquals(await fs.exists("/a/b"), true);
  assertEquals(await fs.exists("/a/b/c"), true);
  assertEquals(await fs.exists("/a/b/c/d"), true);
});

Deno.test("MemoryFS - clear removes all files and directories", async () => {
  const fs = new MemoryFS();

  await fs.writeTextFile("/file1.txt", "a");
  await fs.writeTextFile("/file2.txt", "b");
  await fs.ensureDir("/dir");

  fs.clear();

  assertEquals(await fs.exists("/file1.txt"), false);
  assertEquals(await fs.exists("/file2.txt"), false);
  assertEquals(await fs.exists("/dir"), false);
  // Root should still exist
  assertEquals(await fs.exists("/"), true);
});

Deno.test("MemoryFS - getFiles returns all files", async () => {
  const fs = new MemoryFS();

  await fs.writeTextFile("/a.txt", "A");
  await fs.writeTextFile("/b.txt", "B");
  await fs.writeTextFile("/nested/c.txt", "C");

  const files = fs.getFiles();

  assertEquals(files.size, 3);
  assertEquals(files.get("/a.txt"), "A");
  assertEquals(files.get("/b.txt"), "B");
  assertEquals(files.get("/nested/c.txt"), "C");
});

Deno.test("MemoryFS - handles paths without leading slash", async () => {
  const fs = new MemoryFS();

  await fs.writeTextFile("test.txt", "content");

  // Should normalize to /test.txt
  assertEquals(await fs.exists("/test.txt"), true);
  assertEquals(await fs.readTextFile("test.txt"), "content");
});

// === AgentFileSystem Unit Tests ===

Deno.test("AgentFileSystem - basic file operations", async () => {
  const fs = new AgentFileSystem();

  try {
    await fs.writeTextFile("/test.txt", "Hello AgentFS!");
    const content = await fs.readTextFile("/test.txt");
    assertEquals(content, "Hello AgentFS!");

    const exists = await fs.exists("/test.txt");
    assertEquals(exists, true);
  } finally {
    await fs.close();
  }
});

Deno.test("AgentFileSystem - readTextFile throws for non-existent", async () => {
  const fs = new AgentFileSystem();

  try {
    let threw = false;
    try {
      await fs.readTextFile("/nonexistent.txt");
    } catch (e) {
      threw = true;
      assertEquals(e instanceof Deno.errors.NotFound, true);
    }
    assertEquals(threw, true);
  } finally {
    await fs.close();
  }
});

Deno.test("AgentFileSystem - exists returns false for non-existent", async () => {
  const fs = new AgentFileSystem();

  try {
    const exists = await fs.exists("/does/not/exist");
    assertEquals(exists, false);
  } finally {
    await fs.close();
  }
});

Deno.test("AgentFileSystem - multiple files", async () => {
  const fs = new AgentFileSystem();

  try {
    await fs.writeTextFile("/file1.txt", "Content 1");
    await fs.writeTextFile("/file2.txt", "Content 2");
    await fs.writeTextFile("/nested/file3.txt", "Content 3");

    assertEquals(await fs.readTextFile("/file1.txt"), "Content 1");
    assertEquals(await fs.readTextFile("/file2.txt"), "Content 2");
    assertEquals(await fs.readTextFile("/nested/file3.txt"), "Content 3");
  } finally {
    await fs.close();
  }
});

Deno.test("AgentFileSystem - overwrite file", async () => {
  const fs = new AgentFileSystem();

  try {
    await fs.writeTextFile("/file.txt", "Original");
    assertEquals(await fs.readTextFile("/file.txt"), "Original");

    await fs.writeTextFile("/file.txt", "Updated");
    assertEquals(await fs.readTextFile("/file.txt"), "Updated");
  } finally {
    await fs.close();
  }
});

Deno.test("AgentFileSystem - JSON roundtrip", async () => {
  const fs = new AgentFileSystem();

  try {
    const data = {
      name: "Test",
      count: 42,
      nested: { value: true },
      list: [1, 2, 3],
    };

    await fs.writeTextFile("/data.json", JSON.stringify(data, null, 2));
    const content = await fs.readTextFile("/data.json");
    const parsed = JSON.parse(content);

    assertEquals(parsed, data);
  } finally {
    await fs.close();
  }
});
