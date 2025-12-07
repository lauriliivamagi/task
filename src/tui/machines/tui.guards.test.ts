/**
 * Tests for TUI State Machine Guards
 */

import { assertEquals } from "@std/assert";
import {
  canCreateSubtask,
  canToggleStatus,
  guards,
  hasSelectedTask,
  hasTasks,
  hasValidComment,
  hasValidProjectName,
  hasValidTitle,
} from "./tui.guards.ts";
import type { TuiContext } from "./tui.types.ts";
import type { TaskFull, TaskWithProject } from "../../shared/schemas.ts";
import { MockTaskClient } from "../mock_client.ts";

// Helper to create a minimal context for testing
function createTestContext(overrides: Partial<TuiContext> = {}): TuiContext {
  return {
    client: new MockTaskClient(),
    tasks: [],
    selectedTask: null,
    selectedIndex: 0,
    projects: [],
    newTaskTitle: "",
    newTaskParentId: null,
    newProjectName: "",
    commentText: "",
    descriptionText: "",
    dueDateText: "",
    tagsText: "",
    recurrenceText: "",
    fileBrowserPath: "",
    editingTitleText: "",
    titleText: "",
    gcalDurationText: "1",
    durationText: "",
    pendingSelectTaskId: null,
    lastSelectedTaskId: null,
    paletteFilter: "",
    paletteSelectedIndex: 0,
    searchQuery: "",
    currentEditingMode: null,
    error: null,
    status: null,
    ...overrides,
  };
}

function createTestTask(
  overrides: { parent_id?: number | null } = {},
): TaskWithProject {
  return {
    id: 1,
    title: "Test Task",
    description: null,
    status: "todo" as const,
    priority: 0,
    project_id: null,
    project_name: null,
    parent_id: overrides.parent_id ?? null,
    parent_title: null,
    due_date: null,
    order: 0,
    completed_at: null,
    recurrence: null,
    gcal_event_id: null,
    gcal_event_url: null,
    duration_hours: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function createFullTask(): TaskFull {
  return {
    id: 1,
    title: "Test",
    description: null,
    status: "todo",
    priority: 0,
    project_id: null,
    project_name: null,
    parent_id: null,
    parent_title: null,
    due_date: null,
    order: 0,
    created_at: "",
    updated_at: "",
    completed_at: null,
    recurrence: null,
    gcal_event_id: null,
    gcal_event_url: null,
    duration_hours: null,
    subtasks: [],
    comments: [],
    attachments: [],
    tags: [],
  };
}

Deno.test("hasSelectedTask - returns true when task is selected", () => {
  const context = createTestContext({
    selectedTask: createFullTask(),
  });

  assertEquals(hasSelectedTask({ context }), true);
});

Deno.test("hasSelectedTask - returns false when no task selected", () => {
  const context = createTestContext({ selectedTask: null });

  assertEquals(hasSelectedTask({ context }), false);
});

Deno.test("hasValidTitle - returns true for non-empty title", () => {
  const context = createTestContext({ newTaskTitle: "My Task" });

  assertEquals(hasValidTitle({ context }), true);
});

Deno.test("hasValidTitle - returns false for empty title", () => {
  const context = createTestContext({ newTaskTitle: "" });

  assertEquals(hasValidTitle({ context }), false);
});

Deno.test("hasValidTitle - returns false for whitespace-only title", () => {
  const context = createTestContext({ newTaskTitle: "   " });

  assertEquals(hasValidTitle({ context }), false);
});

Deno.test("hasValidComment - returns true for non-empty comment", () => {
  const context = createTestContext({ commentText: "A comment" });

  assertEquals(hasValidComment({ context }), true);
});

Deno.test("hasValidComment - returns false for empty comment", () => {
  const context = createTestContext({ commentText: "" });

  assertEquals(hasValidComment({ context }), false);
});

Deno.test("hasValidComment - returns false for whitespace-only comment", () => {
  const context = createTestContext({ commentText: "  \t\n  " });

  assertEquals(hasValidComment({ context }), false);
});

Deno.test("hasTasks - returns true when tasks exist", () => {
  const context = createTestContext({
    tasks: [createTestTask()],
  });

  assertEquals(hasTasks({ context }), true);
});

Deno.test("hasTasks - returns false when no tasks", () => {
  const context = createTestContext({ tasks: [] });

  assertEquals(hasTasks({ context }), false);
});

Deno.test("canToggleStatus - returns true when task at selectedIndex exists", () => {
  const context = createTestContext({
    tasks: [createTestTask()],
    selectedIndex: 0,
  });

  assertEquals(canToggleStatus({ context }), true);
});

Deno.test("canToggleStatus - returns false when selectedIndex is out of bounds", () => {
  const context = createTestContext({
    tasks: [createTestTask()],
    selectedIndex: 5,
  });

  assertEquals(canToggleStatus({ context }), false);
});

Deno.test("canToggleStatus - returns false when tasks array is empty", () => {
  const context = createTestContext({
    tasks: [],
    selectedIndex: 0,
  });

  assertEquals(canToggleStatus({ context }), false);
});

Deno.test("canCreateSubtask - returns true for root task", () => {
  const context = createTestContext({
    tasks: [createTestTask({ parent_id: null })],
    selectedIndex: 0,
  });

  assertEquals(canCreateSubtask({ context }), true);
});

Deno.test("canCreateSubtask - returns false for subtask (has parent_id)", () => {
  const context = createTestContext({
    tasks: [createTestTask({ parent_id: 1 })],
    selectedIndex: 0,
  });

  assertEquals(canCreateSubtask({ context }), false);
});

Deno.test("canCreateSubtask - returns false when no task at index", () => {
  const context = createTestContext({
    tasks: [],
    selectedIndex: 0,
  });

  assertEquals(canCreateSubtask({ context }), false);
});

Deno.test("hasValidProjectName - returns true for non-empty name", () => {
  const context = createTestContext({ newProjectName: "My Project" });

  assertEquals(hasValidProjectName({ context }), true);
});

Deno.test("hasValidProjectName - returns false for empty name", () => {
  const context = createTestContext({ newProjectName: "" });

  assertEquals(hasValidProjectName({ context }), false);
});

Deno.test("hasValidProjectName - returns false for whitespace-only name", () => {
  const context = createTestContext({ newProjectName: "   " });

  assertEquals(hasValidProjectName({ context }), false);
});

Deno.test("guards object exports all guards", () => {
  assertEquals(typeof guards.hasSelectedTask, "function");
  assertEquals(typeof guards.hasValidTitle, "function");
  assertEquals(typeof guards.hasValidComment, "function");
  assertEquals(typeof guards.hasTasks, "function");
  assertEquals(typeof guards.canToggleStatus, "function");
  assertEquals(typeof guards.canCreateSubtask, "function");
  assertEquals(typeof guards.hasValidProjectName, "function");
});
