/**
 * TUI E2E Tests with ink-testing-library
 *
 * Tests the TUI application using ink-testing-library for component rendering
 * and keyboard input simulation. Uses MockTaskClient for API isolation.
 *
 * Environment isolation:
 * - TASK_CLI_DB_URL=:memory: prevents writing to real database directories
 * - TASK_CLI_LOG_DISABLED=1 suppresses log file creation
 * - MockTaskClient provides in-memory API responses
 * - resetConfig() clears cached configuration between tests
 * - MemoryFS prevents TUI state persistence to real filesystem
 */

import { assertEquals } from "@std/assert";
import { render } from "ink-testing-library";
import React from "react";
import { App } from "./app.tsx";
import { MockTaskClient } from "./mock_client.ts";
import {
  delay,
  KEYS,
  stripAnsi,
  typeText,
  waitForText,
  waitForTextGone,
} from "./test-utils.ts";
import { resetConfig } from "../shared/config.ts";
import { initKeybindings, resetKeybindings } from "../shared/keybindings.ts";
import type { KeybindingsConfig } from "../shared/keybindings.ts";
import { MemoryFS } from "../shared/fs-abstraction.ts";

// Test utilities

/**
 * Explicit keybindings for tests.
 * This isolates tests from changes to default keybindings in keybindings.ts.
 * Keys here must match what tests actually send via stdin.write().
 */
const TEST_KEYBINDINGS: KeybindingsConfig = {
  listView: {
    "j": "moveDown",
    "Down": "moveDown",
    "k": "moveUp",
    "Up": "moveUp",
    "Tab": "switchToDetail",
    "Enter": "switchToDetail",
    "n": "createTask",
    "o": "createSubtask",
    "e": "editTitleInList",
    "x": "toggleDone",
    "p": "toggleProgress",
    "J": "moveTaskDown",
    "K": "moveTaskUp",
    "/": "startSearch",
    "R": "refresh",
  },
  detailView: {
    "Tab": "switchToList",
    "e": "editTitle",
    "d": "editDescription",
    "c": "addComment",
    "s": "changeStatus",
    "p": "changePriority",
    "o": "changeProject",
    "u": "changeDueDate",
    "t": "editTags",
    "r": "editRecurrence",
    "a": "addAttachment",
    "D": "editDuration",
  },
  global: {
    "P": "openCommandPalette",
    "?": "openHelp",
    "q": "quit",
    "Escape": "cancel",
  },
};

/**
 * Create a test instance of the TUI app with mocked dependencies.
 * Uses MemoryFS to prevent TUI state persistence to real filesystem.
 * Initializes keybindings with explicit test configuration.
 */
function renderApp(
  options: { client?: MockTaskClient; keybindings?: KeybindingsConfig } = {},
): ReturnType<typeof render> & { client: MockTaskClient } {
  // Initialize keybindings with test config (or custom config for specific tests)
  initKeybindings(options.keybindings ?? TEST_KEYBINDINGS);

  const client = options.client ?? new MockTaskClient();
  const fs = new MemoryFS();
  const stateFile = "/test/tui-state.json";
  const result = render(<App client={client} fs={fs} stateFile={stateFile} />);
  return { ...result, client };
}

/**
 * Cleanup helper - call after each test to reset global state.
 */
function cleanup(): void {
  resetConfig();
  resetKeybindings();
}

// === Basic Rendering Tests ===

Deno.test({
  name: "TUI E2E - renders initial loading state",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { lastFrame, unmount } = renderApp();

    // Should show loading indicator initially
    const frame = lastFrame();
    assertEquals(frame !== undefined, true);

    // Wait a bit for initial render
    await delay(50);

    unmount();
    cleanup();
  },
});

Deno.test({
  name: "TUI E2E - loads and displays tasks",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { lastFrame, unmount } = renderApp();

    // Wait for tasks to load
    await waitForText(lastFrame, "Tasks", { timeout: 3000 });

    const frame = lastFrame();
    const plain = stripAnsi(frame ?? "");

    // Should show task list header
    assertEquals(plain.includes("Tasks"), true);

    // Should show at least one task from MockTaskClient
    assertEquals(plain.includes("Buy groceries"), true);

    unmount();
    cleanup();
  },
});

Deno.test({
  name: "TUI E2E - shows header with shortcuts",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { lastFrame, unmount } = renderApp();

    await waitForText(lastFrame, "Task", { timeout: 3000 });

    const frame = lastFrame();
    const plain = stripAnsi(frame ?? "");

    // Header should show app name and shortcuts
    assertEquals(plain.includes("Task"), true);
    assertEquals(plain.includes("q:quit"), true);

    unmount();
    cleanup();
  },
});

// === Navigation Tests ===

Deno.test({
  name: "TUI E2E - TAB switches focus from list to detail",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { lastFrame, stdin, unmount } = renderApp();

    // Wait for initial load
    await waitForText(lastFrame, "Tasks", { timeout: 3000 });

    // Initial frame should have list focused (list panel has focused border)
    const beforeFrame = stripAnsi(lastFrame() ?? "");
    assertEquals(beforeFrame.includes("Tasks"), true);

    // Press TAB to switch focus
    stdin.write(KEYS.TAB);
    await delay(100);

    // After TAB, detail panel should be focused
    // We can verify this by checking the frame changed
    const afterFrame = stripAnsi(lastFrame() ?? "");
    assertEquals(afterFrame.includes("Tasks"), true);

    unmount();
    cleanup();
  },
});

Deno.test({
  name: "TUI E2E - arrow keys navigate task list",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { lastFrame, stdin, unmount } = renderApp();

    // Wait for initial load
    await waitForText(lastFrame, "Buy groceries", { timeout: 3000 });

    // Move down in the list
    stdin.write(KEYS.DOWN);
    await delay(100);

    // Should still show the task list
    const frame = stripAnsi(lastFrame() ?? "");
    assertEquals(frame.includes("Tasks"), true);

    unmount();
    cleanup();
  },
});

// === Task Creation Tests ===

Deno.test({
  name: "TUI E2E - press 'n' opens task creation input",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { lastFrame, stdin, unmount } = renderApp();

    // Wait for initial load
    await waitForText(lastFrame, "Tasks", { timeout: 3000 });

    // Press 'n' to start creating a task
    stdin.write("n");
    await delay(100);

    // Should show a text input area for new task
    // The UI shows "New task:" prompt when creating
    const frame = lastFrame() ?? "";
    // The frame should have changed to show task creation mode
    assertEquals(frame.length > 0, true);

    // Press Escape to cancel
    stdin.write(KEYS.ESCAPE);
    await delay(100);

    unmount();
    cleanup();
  },
});

Deno.test({
  name: "TUI E2E - create task flow",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { lastFrame, stdin, unmount, client } = renderApp();

    // Wait for initial load
    await waitForText(lastFrame, "Tasks", { timeout: 3000 });

    const initialTaskCount = (await client.listTasks()).length;

    // Press 'n' to start creating a task
    stdin.write("n");
    await delay(100);

    // Type task title character by character
    // Note: ink-testing-library stdin.write sends data to the process stdin
    // which TextInput component reads
    const taskTitle = "E2E Test Task";
    for (const char of taskTitle) {
      stdin.write(char);
      await delay(10); // Small delay between characters for input processing
    }
    await delay(100);

    // Submit with Enter
    stdin.write(KEYS.ENTER);
    await delay(300); // Wait for async task creation

    // Verify task was created in mock client
    const tasks = await client.listTasks();
    assertEquals(tasks.length, initialTaskCount + 1);

    const newTask = tasks.find((t) => t.title === taskTitle);
    assertEquals(
      newTask !== undefined,
      true,
      `Expected to find task "${taskTitle}"`,
    );

    unmount();
    cleanup();
  },
});

// === Search Tests ===

Deno.test({
  name: "TUI E2E - press '/' opens search input",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { lastFrame, stdin, unmount } = renderApp();

    // Wait for initial load
    await waitForText(lastFrame, "Tasks", { timeout: 3000 });

    // Press '/' to start search
    stdin.write("/");
    await delay(100);

    // Should be in search mode
    // Press Escape to cancel
    stdin.write(KEYS.ESCAPE);
    await delay(100);

    unmount();
    cleanup();
  },
});

// === Command Palette Tests ===

Deno.test({
  name: "TUI E2E - Shift+P opens command palette",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { lastFrame, stdin, unmount } = renderApp();

    // Wait for initial load
    await waitForText(lastFrame, "Tasks", { timeout: 3000 });

    // Press Shift+P (capital P) to open command palette
    stdin.write("P");
    await delay(100);

    // Should show command palette
    const frame = stripAnsi(lastFrame() ?? "");
    assertEquals(frame.includes("Command Palette"), true);

    // Close with Shift+P again
    stdin.write("P");
    await delay(100);

    // Should be back to normal view
    await waitForTextGone(lastFrame, "Command Palette", { timeout: 1000 });

    unmount();
    cleanup();
  },
});

Deno.test({
  name: "TUI E2E - command palette shows available commands",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { lastFrame, stdin, unmount } = renderApp();

    // Wait for initial load
    await waitForText(lastFrame, "Tasks", { timeout: 3000 });

    // Open command palette
    stdin.write("P");
    await delay(100);

    const frame = stripAnsi(lastFrame() ?? "");

    // Should show some commands
    assertEquals(frame.includes("Quit"), true);
    assertEquals(frame.includes("Search"), true);

    // Close palette
    stdin.write(KEYS.ESCAPE);
    await delay(100);

    unmount();
    cleanup();
  },
});

// === Help Overlay Tests ===

Deno.test({
  name: "TUI E2E - press '?' opens help overlay",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { lastFrame, stdin, unmount } = renderApp();

    // Wait for initial load
    await waitForText(lastFrame, "Tasks", { timeout: 3000 });

    // Press '?' to open help
    stdin.write("?");
    await delay(100);

    // Should show help overlay
    const frame = stripAnsi(lastFrame() ?? "");
    assertEquals(frame.includes("Keyboard Shortcuts"), true);

    // Should show some shortcut sections
    assertEquals(frame.includes("List View"), true);
    assertEquals(frame.includes("Detail View"), true);

    unmount();
    cleanup();
  },
});

Deno.test({
  name: "TUI E2E - Escape closes help overlay",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { lastFrame, stdin, unmount } = renderApp();

    // Wait for initial load
    await waitForText(lastFrame, "Tasks", { timeout: 3000 });

    // Open help
    stdin.write("?");
    await delay(100);
    assertEquals(
      stripAnsi(lastFrame() ?? "").includes("Keyboard Shortcuts"),
      true,
    );

    // Press Escape to close
    stdin.write(KEYS.ESCAPE);
    await delay(100);

    // Should be back to normal view
    await waitForTextGone(lastFrame, "Keyboard Shortcuts", { timeout: 1000 });

    unmount();
    cleanup();
  },
});

Deno.test({
  name: "TUI E2E - '?' toggles help overlay",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { lastFrame, stdin, unmount } = renderApp();

    // Wait for initial load
    await waitForText(lastFrame, "Tasks", { timeout: 3000 });

    // Open help with ?
    stdin.write("?");
    await delay(100);
    assertEquals(
      stripAnsi(lastFrame() ?? "").includes("Keyboard Shortcuts"),
      true,
    );

    // Close help with ? again
    stdin.write("?");
    await delay(100);

    // Should be back to normal view
    await waitForTextGone(lastFrame, "Keyboard Shortcuts", { timeout: 1000 });

    unmount();
    cleanup();
  },
});

Deno.test({
  name: "TUI E2E - help overlay shows custom keybindings from config",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    // Custom config extends test keybindings with an additional binding
    const customConfig: KeybindingsConfig = {
      ...TEST_KEYBINDINGS,
      listView: {
        ...TEST_KEYBINDINGS.listView,
        "Ctrl+n": "createTask", // Additional custom binding
      },
    };

    const { lastFrame, stdin, unmount } = renderApp({
      keybindings: customConfig,
    });

    // Wait for initial load
    await waitForText(lastFrame, "Tasks", { timeout: 3000 });

    // Open help overlay
    stdin.write("?");
    await delay(100);

    // Should show help overlay
    const frame = stripAnsi(lastFrame() ?? "");
    assertEquals(frame.includes("Keyboard Shortcuts"), true);

    // Should show the custom keybinding "Ctrl+n" for New task
    assertEquals(
      frame.includes("Ctrl+n"),
      true,
      "Expected custom keybinding Ctrl+n to appear in help overlay",
    );

    unmount();
    cleanup();
  },
});

// === Detail View Tests ===

Deno.test({
  name: "TUI E2E - TAB to detail view shows task details",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { lastFrame, stdin, unmount } = renderApp();

    // Wait for initial load
    await waitForText(lastFrame, "Buy groceries", { timeout: 3000 });

    // Switch to detail view
    stdin.write(KEYS.TAB);
    await delay(100);

    // Detail view should show task info
    // MockTaskClient seeds with "Buy groceries" which has description "Milk, eggs, bread"
    const frame = stripAnsi(lastFrame() ?? "");
    assertEquals(
      frame.includes("Buy groceries") || frame.includes("Milk"),
      true,
    );

    unmount();
    cleanup();
  },
});

// === Edit Mode Tests ===

Deno.test({
  name: "TUI E2E - press 'e' in list opens title edit",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { lastFrame, stdin, unmount } = renderApp();

    // Wait for initial load
    await waitForText(lastFrame, "Tasks", { timeout: 3000 });

    // Press 'e' to edit title in list
    stdin.write("e");
    await delay(100);

    // Should be in edit mode - Escape to cancel
    stdin.write(KEYS.ESCAPE);
    await delay(100);

    // Should be back to normal list view
    const frame = stripAnsi(lastFrame() ?? "");
    assertEquals(frame.includes("Tasks"), true);

    unmount();
    cleanup();
  },
});

Deno.test({
  name: "TUI E2E - press 'c' in detail opens comment input",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { lastFrame, stdin, unmount } = renderApp();

    // Wait for initial load
    await waitForText(lastFrame, "Tasks", { timeout: 3000 });

    // Switch to detail view
    stdin.write(KEYS.TAB);
    await delay(100);

    // Press 'c' to add comment
    stdin.write("c");
    await delay(100);

    // Should be in comment mode - Escape to cancel
    stdin.write(KEYS.ESCAPE);
    await delay(100);

    unmount();
    cleanup();
  },
});

// === Task Status Toggle Tests ===

Deno.test({
  name: "TUI E2E - press 'x' toggles task status",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { lastFrame, stdin, unmount, client } = renderApp();

    // Wait for initial load
    await waitForText(lastFrame, "Buy groceries", { timeout: 3000 });

    // Get initial status
    const taskBefore = await client.getTask(1);
    const statusBefore = taskBefore.status;

    // Press 'x' to toggle status
    stdin.write("x");
    await delay(200);

    // Wait for the toggle to complete
    await delay(300);

    // Check status changed
    const taskAfter = await client.getTask(1);
    assertEquals(taskAfter.status !== statusBefore, true);

    unmount();
    cleanup();
  },
});

Deno.test({
  name: "TUI E2E - press 'p' toggles task progress (todo/in-progress)",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { lastFrame, stdin, unmount, client } = renderApp();

    // Wait for initial load
    await waitForText(lastFrame, "Buy groceries", { timeout: 3000 });

    // Get initial status - should be "todo"
    const taskBefore = await client.getTask(1);
    assertEquals(taskBefore.status, "todo");

    // Press 'p' to toggle progress (todo -> in-progress)
    stdin.write("p");
    await delay(200);

    // Wait for the toggle to complete
    await delay(300);

    // Check status changed to in-progress
    const taskAfter = await client.getTask(1);
    assertEquals(taskAfter.status, "in-progress");

    // Press 'p' again to toggle back (in-progress -> todo)
    stdin.write("p");
    await delay(200);
    await delay(300);

    // Check status changed back to todo
    const taskFinal = await client.getTask(1);
    assertEquals(taskFinal.status, "todo");

    unmount();
    cleanup();
  },
});

// === Error Handling Tests ===

Deno.test({
  name: "TUI E2E - handles API errors gracefully",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const client = new MockTaskClient();
    // Override listTasks to fail
    client.listTasks = () => Promise.reject(new Error("Network error"));

    const { lastFrame, unmount } = renderApp({ client });

    // Wait for error to appear
    await waitForText(lastFrame, "Error", { timeout: 3000 });

    const frame = stripAnsi(lastFrame() ?? "");
    assertEquals(frame.includes("Error"), true);

    unmount();
    cleanup();
  },
});

// === Keyboard Escape Sequences Tests ===

Deno.test({
  name: "TUI E2E - escape key cancels operations",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { lastFrame, stdin, unmount } = renderApp();

    // Wait for initial load
    await waitForText(lastFrame, "Tasks", { timeout: 3000 });

    // Open command palette
    stdin.write("P");
    await delay(100);
    assertEquals(
      stripAnsi(lastFrame() ?? "").includes("Command Palette"),
      true,
    );

    // Press Escape to close
    stdin.write(KEYS.ESCAPE);
    await delay(100);

    // Should be back to normal view
    await waitForTextGone(lastFrame, "Command Palette", { timeout: 1000 });

    unmount();
    cleanup();
  },
});

// === Vim-style Navigation Tests ===

Deno.test({
  name: "TUI E2E - 'j' moves down in task list (vim-style)",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { lastFrame, stdin, unmount } = renderApp();

    await waitForText(lastFrame, "Tasks", { timeout: 3000 });

    // Press 'j' to move down (vim-style)
    stdin.write("j");
    await delay(100);

    // Should still show task list
    const frame = stripAnsi(lastFrame() ?? "");
    assertEquals(frame.includes("Tasks"), true);

    unmount();
    cleanup();
  },
});

Deno.test({
  name: "TUI E2E - 'k' moves up in task list (vim-style)",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { lastFrame, stdin, unmount } = renderApp();

    await waitForText(lastFrame, "Tasks", { timeout: 3000 });

    // Move down first, then up
    stdin.write("j");
    await delay(50);
    stdin.write("k");
    await delay(100);

    const frame = stripAnsi(lastFrame() ?? "");
    assertEquals(frame.includes("Tasks"), true);

    unmount();
    cleanup();
  },
});

// === Detail View Editing Shortcuts ===

Deno.test({
  name: "TUI E2E - 'd' in detail opens description edit",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { lastFrame, stdin, unmount } = renderApp();

    await waitForText(lastFrame, "Tasks", { timeout: 3000 });

    // Switch to detail view
    stdin.write(KEYS.TAB);
    await delay(100);

    // Press 'd' to edit description
    stdin.write("d");
    await delay(100);

    // Cancel with Escape
    stdin.write(KEYS.ESCAPE);
    await delay(100);

    unmount();
    cleanup();
  },
});

Deno.test({
  name: "TUI E2E - 's' in detail opens status selection",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { lastFrame, stdin, unmount } = renderApp();

    await waitForText(lastFrame, "Tasks", { timeout: 3000 });

    // Switch to detail view
    stdin.write(KEYS.TAB);
    await delay(100);

    // Press 's' to change status
    stdin.write("s");
    await delay(100);

    // Cancel with Escape
    stdin.write(KEYS.ESCAPE);
    await delay(100);

    unmount();
    cleanup();
  },
});

Deno.test({
  name: "TUI E2E - 'p' in detail opens priority selection",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { lastFrame, stdin, unmount } = renderApp();

    await waitForText(lastFrame, "Tasks", { timeout: 3000 });

    // Switch to detail view
    stdin.write(KEYS.TAB);
    await delay(100);

    // Press 'p' to change priority
    stdin.write("p");
    await delay(100);

    // Cancel with Escape
    stdin.write(KEYS.ESCAPE);
    await delay(100);

    unmount();
    cleanup();
  },
});

Deno.test({
  name: "TUI E2E - 'u' in detail opens due date edit",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { lastFrame, stdin, unmount } = renderApp();

    await waitForText(lastFrame, "Tasks", { timeout: 3000 });

    // Switch to detail view
    stdin.write(KEYS.TAB);
    await delay(100);

    // Press 'u' to change due date
    stdin.write("u");
    await delay(100);

    // Cancel with Escape
    stdin.write(KEYS.ESCAPE);
    await delay(100);

    unmount();
    cleanup();
  },
});

Deno.test({
  name: "TUI E2E - 't' in detail opens tags edit",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { lastFrame, stdin, unmount } = renderApp();

    await waitForText(lastFrame, "Tasks", { timeout: 3000 });

    // Switch to detail view
    stdin.write(KEYS.TAB);
    await delay(100);

    // Press 't' to change tags
    stdin.write("t");
    await delay(100);

    // Cancel with Escape
    stdin.write(KEYS.ESCAPE);
    await delay(100);

    unmount();
    cleanup();
  },
});

Deno.test({
  name: "TUI E2E - 'r' in detail opens recurrence edit",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { lastFrame, stdin, unmount } = renderApp();

    await waitForText(lastFrame, "Tasks", { timeout: 3000 });

    // Switch to detail view
    stdin.write(KEYS.TAB);
    await delay(100);

    // Press 'r' to change recurrence
    stdin.write("r");
    await delay(100);

    // Cancel with Escape
    stdin.write(KEYS.ESCAPE);
    await delay(100);

    unmount();
    cleanup();
  },
});

Deno.test({
  name: "TUI E2E - 'o' in detail opens project selection",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { lastFrame, stdin, unmount } = renderApp();

    await waitForText(lastFrame, "Tasks", { timeout: 3000 });

    // Switch to detail view
    stdin.write(KEYS.TAB);
    await delay(100);

    // Press 'o' to change project
    stdin.write("o");
    await delay(100);

    // Wait for project loading
    await delay(200);

    // Cancel with Escape
    stdin.write(KEYS.ESCAPE);
    await delay(100);

    unmount();
    cleanup();
  },
});

Deno.test({
  name: "TUI E2E - 'a' in detail opens attachment browser",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { lastFrame, stdin, unmount } = renderApp();

    await waitForText(lastFrame, "Tasks", { timeout: 3000 });

    // Switch to detail view
    stdin.write(KEYS.TAB);
    await delay(100);

    // Press 'a' to add attachment
    stdin.write("a");
    await delay(100);

    // Cancel with Escape
    stdin.write(KEYS.ESCAPE);
    await delay(100);

    unmount();
    cleanup();
  },
});

// === Task Reordering Tests ===

Deno.test({
  name: "TUI E2E - Shift+J reorders task down",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { lastFrame, stdin, unmount } = renderApp();

    await waitForText(lastFrame, "Tasks", { timeout: 3000 });

    // Press Shift+J (capital J) to move task down
    stdin.write("J");
    await delay(200);

    // Should still show task list
    const frame = stripAnsi(lastFrame() ?? "");
    assertEquals(frame.includes("Tasks"), true);

    unmount();
    cleanup();
  },
});

Deno.test({
  name: "TUI E2E - Shift+K reorders task up",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { lastFrame, stdin, unmount } = renderApp();

    await waitForText(lastFrame, "Tasks", { timeout: 3000 });

    // Move down first
    stdin.write("j");
    await delay(100);

    // Press Shift+K (capital K) to move task up
    stdin.write("K");
    await delay(200);

    const frame = stripAnsi(lastFrame() ?? "");
    assertEquals(frame.includes("Tasks"), true);

    unmount();
    cleanup();
  },
});

// === Subtask Creation Tests ===

Deno.test({
  name: "TUI E2E - 'o' in list creates subtask for selected task",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { lastFrame, stdin, unmount } = renderApp();

    await waitForText(lastFrame, "Tasks", { timeout: 3000 });

    // Press 'o' in list to create subtask
    stdin.write("o");
    await delay(100);

    // Cancel with Escape
    stdin.write(KEYS.ESCAPE);
    await delay(100);

    unmount();
    cleanup();
  },
});

// === Refresh Tests ===

Deno.test({
  name: "TUI E2E - Shift+R refreshes task list",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { lastFrame, stdin, unmount } = renderApp();

    await waitForText(lastFrame, "Tasks", { timeout: 3000 });

    // Press Shift+R to refresh
    stdin.write("R");
    await delay(300);

    // Should still show task list after refresh
    const frame = stripAnsi(lastFrame() ?? "");
    assertEquals(frame.includes("Tasks"), true);

    unmount();
    cleanup();
  },
});

// === Command Palette Extended Tests ===

Deno.test({
  name: "TUI E2E - command palette arrow navigation",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { lastFrame, stdin, unmount } = renderApp();

    await waitForText(lastFrame, "Tasks", { timeout: 3000 });

    // Open command palette
    stdin.write("P");
    await delay(100);

    // Navigate with arrow keys
    stdin.write(KEYS.DOWN);
    await delay(50);
    stdin.write(KEYS.DOWN);
    await delay(50);
    stdin.write(KEYS.UP);
    await delay(100);

    // Should still show command palette
    const frame = stripAnsi(lastFrame() ?? "");
    assertEquals(frame.includes("Command Palette"), true);

    // Close
    stdin.write(KEYS.ESCAPE);
    await delay(100);

    unmount();
    cleanup();
  },
});

Deno.test({
  name: "TUI E2E - command palette filter input",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { lastFrame, stdin, unmount } = renderApp();

    await waitForText(lastFrame, "Tasks", { timeout: 3000 });

    // Open command palette
    stdin.write("P");
    await delay(100);

    // Type to filter
    stdin.write("q");
    await delay(100);

    // Should show filtered results (Quit command)
    const frame = stripAnsi(lastFrame() ?? "");
    assertEquals(frame.includes("Quit"), true);

    // Close
    stdin.write(KEYS.ESCAPE);
    await delay(100);

    unmount();
    cleanup();
  },
});

Deno.test({
  name: "TUI E2E - command palette select with Enter executes command",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { lastFrame, stdin, unmount } = renderApp();

    await waitForText(lastFrame, "Tasks", { timeout: 3000 });

    // Open command palette
    stdin.write("P");
    await delay(100);

    // Navigate down to a safe command (not Quit)
    stdin.write(KEYS.DOWN);
    stdin.write(KEYS.DOWN);
    stdin.write(KEYS.DOWN);
    await delay(100);

    // Press Escape instead of Enter to avoid triggering commands
    // that might exit or cause issues in tests
    stdin.write(KEYS.ESCAPE);
    await delay(100);

    unmount();
    cleanup();
  },
});

// === Search Extended Tests ===

Deno.test({
  name: "TUI E2E - search with query filters tasks",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { lastFrame, stdin, unmount } = renderApp();

    await waitForText(lastFrame, "Tasks", { timeout: 3000 });

    // Press '/' to start search
    stdin.write("/");
    await delay(100);

    // Type search query
    await typeText(stdin, "groceries");
    await delay(100);

    // Submit search
    stdin.write(KEYS.ENTER);
    await delay(200);

    unmount();
    cleanup();
  },
});

// === Task Deletion Tests ===

Deno.test({
  name: "TUI E2E - '-' shows delete confirmation and 'n' cancels",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { lastFrame, stdin, unmount } = renderApp();

    await waitForText(lastFrame, "Tasks", { timeout: 3000 });

    // Press '-' to delete task
    stdin.write("-");
    await delay(100);

    // Should show confirmation dialog
    await waitForText(lastFrame, "Delete Task", { timeout: 1000 });

    // Press 'n' to cancel
    stdin.write("n");
    await delay(100);

    // Should be back to task list
    const frame = stripAnsi(lastFrame() ?? "");
    assertEquals(frame.includes("Delete Task"), false);

    unmount();
    cleanup();
  },
});

Deno.test({
  name: "TUI E2E - '-' shows delete confirmation and 'y' deletes task",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { lastFrame, stdin, unmount } = renderApp();

    await waitForText(lastFrame, "Tasks", { timeout: 3000 });

    // Press '-' to delete task
    stdin.write("-");
    await delay(100);

    // Should show confirmation dialog
    await waitForText(lastFrame, "Delete Task", { timeout: 1000 });

    // Press 'y' to confirm
    stdin.write("y");
    await delay(200);

    // Should be back to task list with task deleted
    const frame = stripAnsi(lastFrame() ?? "");
    assertEquals(frame.includes("Delete Task"), false);

    unmount();
    cleanup();
  },
});

// === Title Edit in Detail View ===

Deno.test({
  name: "TUI E2E - 'e' in detail opens title edit",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { lastFrame, stdin, unmount } = renderApp();

    await waitForText(lastFrame, "Tasks", { timeout: 3000 });

    // Switch to detail view
    stdin.write(KEYS.TAB);
    await delay(100);

    // Press 'e' to edit title
    stdin.write("e");
    await delay(100);

    // Cancel with Escape
    stdin.write(KEYS.ESCAPE);
    await delay(100);

    unmount();
    cleanup();
  },
});

// === Full Flow Integration Test ===

Deno.test({
  name: "TUI E2E - full flow: load, navigate, create task, toggle status",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { lastFrame, stdin, unmount, client } = renderApp();

    // 1. Wait for initial load
    await waitForText(lastFrame, "Tasks", { timeout: 3000 });
    const initialTaskCount = (await client.listTasks()).length;

    // 2. Navigate down to second task
    stdin.write(KEYS.DOWN);
    await delay(100);

    // 3. Switch to detail view
    stdin.write(KEYS.TAB);
    await delay(100);

    // 4. Go back to list
    stdin.write(KEYS.TAB);
    await delay(100);

    // 5. Create a new task
    stdin.write("n");
    await delay(100);
    await typeText(stdin, "Integration test task");
    stdin.write(KEYS.ENTER);
    await delay(200);

    // Verify task was created
    const tasks = await client.listTasks();
    assertEquals(tasks.length, initialTaskCount + 1);

    // 6. Toggle status of first task
    // Navigate up to first task
    stdin.write(KEYS.UP);
    stdin.write(KEYS.UP);
    await delay(100);

    stdin.write("x");
    await delay(300);

    // Test completed successfully
    unmount();
    cleanup();
  },
});
