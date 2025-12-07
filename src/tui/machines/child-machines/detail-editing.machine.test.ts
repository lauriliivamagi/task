/**
 * Tests for Detail Editing Child Machine Guards and Context
 *
 * The detail-editing machine is designed to be invoked by a parent machine
 * and uses sendParent for communication. Testing it in isolation is limited
 * because sendParent throws errors without a parent.
 *
 * These tests focus on:
 * - Initial routing based on initialMode
 * - Context initialization with provided input
 * - Guards (hasValidComment, hasValidProjectName, etc.)
 *
 * Full flow testing is done via the parent TUI machine tests.
 */

import { assertEquals } from "@std/assert";
import { createActor } from "xstate";
import { detailEditingMachine } from "./detail-editing.machine.ts";
import { MockTaskClient } from "../../mock_client.ts";
import type { TaskFull } from "../../../shared/schemas.ts";

// === Test Utilities ===

function createTestTask(): TaskFull {
  return {
    id: 1,
    title: "Test Task",
    description: "Test description",
    status: "todo",
    priority: 0,
    project_id: null,
    project_name: null,
    parent_id: null,
    parent_title: null,
    due_date: null,
    order: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
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

function createTestActor(
  initialMode:
    | "addingComment"
    | "editingDescription"
    | "editingTitle"
    | "changingStatus"
    | "changingPriority"
    | "loadingProjects"
    | "changingDueDate"
    | "changingTags"
    | "changingRecurrence"
    | "addingAttachment",
  overrides?: {
    client?: MockTaskClient;
    task?: TaskFull;
    descriptionText?: string;
    titleText?: string;
    dueDateText?: string;
    tagsText?: string;
    recurrenceText?: string;
  },
): ReturnType<typeof createActor<typeof detailEditingMachine>> {
  const client = overrides?.client ?? new MockTaskClient();
  const task = overrides?.task ?? createTestTask();

  return createActor(detailEditingMachine, {
    input: {
      client,
      selectedTask: task,
      initialMode,
      descriptionText: overrides?.descriptionText,
      titleText: overrides?.titleText,
      dueDateText: overrides?.dueDateText,
      tagsText: overrides?.tagsText,
      recurrenceText: overrides?.recurrenceText,
    },
  });
}

// === Routing Tests ===

Deno.test({
  name: "Detail Editing - routes to addingComment",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: () => {
    const actor = createTestActor("addingComment");
    actor.start();

    assertEquals(actor.getSnapshot().matches("addingComment"), true);
    assertEquals(actor.getSnapshot().context.commentText, "");

    actor.stop();
  },
});

Deno.test({
  name: "Detail Editing - routes to editingDescription with pre-populated text",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: () => {
    const actor = createTestActor("editingDescription", {
      descriptionText: "Existing description",
    });
    actor.start();

    assertEquals(actor.getSnapshot().matches("editingDescription"), true);
    assertEquals(
      actor.getSnapshot().context.descriptionText,
      "Existing description",
    );

    actor.stop();
  },
});

Deno.test({
  name: "Detail Editing - routes to editingTitle with pre-populated text",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: () => {
    const actor = createTestActor("editingTitle", {
      titleText: "Original Title",
    });
    actor.start();

    assertEquals(actor.getSnapshot().matches("editingTitle"), true);
    assertEquals(actor.getSnapshot().context.titleText, "Original Title");

    actor.stop();
  },
});

Deno.test({
  name: "Detail Editing - routes to changingStatus",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: () => {
    const actor = createTestActor("changingStatus");
    actor.start();

    assertEquals(actor.getSnapshot().matches("changingStatus"), true);

    actor.stop();
  },
});

Deno.test({
  name: "Detail Editing - routes to changingPriority",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: () => {
    const actor = createTestActor("changingPriority");
    actor.start();

    assertEquals(actor.getSnapshot().matches("changingPriority"), true);

    actor.stop();
  },
});

Deno.test({
  name: "Detail Editing - routes to loadingProjects",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: () => {
    const actor = createTestActor("loadingProjects");
    actor.start();

    assertEquals(actor.getSnapshot().matches("loadingProjects"), true);

    actor.stop();
  },
});

Deno.test({
  name: "Detail Editing - routes to changingDueDate with pre-populated text",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: () => {
    const actor = createTestActor("changingDueDate", {
      dueDateText: "2025-12-31",
    });
    actor.start();

    assertEquals(actor.getSnapshot().matches("changingDueDate"), true);
    assertEquals(actor.getSnapshot().context.dueDateText, "2025-12-31");

    actor.stop();
  },
});

Deno.test({
  name: "Detail Editing - routes to changingTags with pre-populated text",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: () => {
    const actor = createTestActor("changingTags", {
      tagsText: "bug, feature",
    });
    actor.start();

    assertEquals(actor.getSnapshot().matches("changingTags"), true);
    assertEquals(actor.getSnapshot().context.tagsText, "bug, feature");

    actor.stop();
  },
});

Deno.test({
  name: "Detail Editing - routes to changingRecurrence with pre-populated text",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: () => {
    const actor = createTestActor("changingRecurrence", {
      recurrenceText: "every Monday",
    });
    actor.start();

    assertEquals(actor.getSnapshot().matches("changingRecurrence"), true);
    assertEquals(actor.getSnapshot().context.recurrenceText, "every Monday");

    actor.stop();
  },
});

Deno.test({
  name: "Detail Editing - routes to addingAttachment",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: () => {
    const actor = createTestActor("addingAttachment");
    actor.start();

    assertEquals(actor.getSnapshot().matches("addingAttachment"), true);

    actor.stop();
  },
});

// === Context Update Tests ===

Deno.test({
  name: "Detail Editing - UPDATE_COMMENT updates commentText",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: () => {
    const actor = createTestActor("addingComment");
    actor.start();

    actor.send({ type: "UPDATE_COMMENT", value: "New comment" });

    assertEquals(actor.getSnapshot().context.commentText, "New comment");

    actor.stop();
  },
});

Deno.test({
  name: "Detail Editing - UPDATE_DESCRIPTION updates descriptionText",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: () => {
    const actor = createTestActor("editingDescription");
    actor.start();

    actor.send({ type: "UPDATE_DESCRIPTION", value: "New description" });

    assertEquals(
      actor.getSnapshot().context.descriptionText,
      "New description",
    );

    actor.stop();
  },
});

Deno.test({
  name: "Detail Editing - UPDATE_TITLE updates titleText",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: () => {
    const actor = createTestActor("editingTitle");
    actor.start();

    actor.send({ type: "UPDATE_TITLE", value: "New Title" });

    assertEquals(actor.getSnapshot().context.titleText, "New Title");

    actor.stop();
  },
});

Deno.test({
  name: "Detail Editing - UPDATE_DUE_DATE updates dueDateText",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: () => {
    const actor = createTestActor("changingDueDate");
    actor.start();

    actor.send({ type: "UPDATE_DUE_DATE", value: "tomorrow" });

    assertEquals(actor.getSnapshot().context.dueDateText, "tomorrow");

    actor.stop();
  },
});

Deno.test({
  name: "Detail Editing - UPDATE_TAGS updates tagsText",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: () => {
    const actor = createTestActor("changingTags");
    actor.start();

    actor.send({ type: "UPDATE_TAGS", value: "#urgent #important" });

    assertEquals(actor.getSnapshot().context.tagsText, "#urgent #important");

    actor.stop();
  },
});

Deno.test({
  name: "Detail Editing - UPDATE_RECURRENCE updates recurrenceText",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: () => {
    const actor = createTestActor("changingRecurrence");
    actor.start();

    actor.send({ type: "UPDATE_RECURRENCE", value: "daily" });

    assertEquals(actor.getSnapshot().context.recurrenceText, "daily");

    actor.stop();
  },
});

// === Guard Tests ===

Deno.test({
  name: "Detail Editing - SUBMIT with empty comment does not transition",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: () => {
    const actor = createTestActor("addingComment");
    actor.start();

    actor.send({ type: "SUBMIT" });

    // Should still be in addingComment due to guard
    assertEquals(actor.getSnapshot().matches("addingComment"), true);

    actor.stop();
  },
});

Deno.test({
  name:
    "Detail Editing - SUBMIT with whitespace-only comment does not transition",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: () => {
    const actor = createTestActor("addingComment");
    actor.start();

    actor.send({ type: "UPDATE_COMMENT", value: "   " });
    actor.send({ type: "SUBMIT" });

    // Should still be in addingComment due to guard
    assertEquals(actor.getSnapshot().matches("addingComment"), true);

    actor.stop();
  },
});

Deno.test({
  name: "Detail Editing - SUBMIT with valid comment transitions to submitting",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: () => {
    const actor = createTestActor("addingComment");
    actor.start();

    actor.send({ type: "UPDATE_COMMENT", value: "Valid comment" });
    actor.send({ type: "SUBMIT" });

    // Should transition to submittingComment
    assertEquals(actor.getSnapshot().matches("submittingComment"), true);

    actor.stop();
  },
});

Deno.test({
  name: "Detail Editing - SUBMIT with empty title does not transition",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: () => {
    const actor = createTestActor("editingTitle", { titleText: "" });
    actor.start();

    actor.send({ type: "SUBMIT" });

    // Should still be in editingTitle due to guard
    assertEquals(actor.getSnapshot().matches("editingTitle"), true);

    actor.stop();
  },
});

Deno.test({
  name:
    "Detail Editing - SUBMIT with whitespace-only title does not transition",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: () => {
    const actor = createTestActor("editingTitle");
    actor.start();

    actor.send({ type: "UPDATE_TITLE", value: "   " });
    actor.send({ type: "SUBMIT" });

    // Should still be in editingTitle due to guard
    assertEquals(actor.getSnapshot().matches("editingTitle"), true);

    actor.stop();
  },
});

Deno.test({
  name: "Detail Editing - SUBMIT with valid title transitions to submitting",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: () => {
    const actor = createTestActor("editingTitle");
    actor.start();

    actor.send({ type: "UPDATE_TITLE", value: "Valid Title" });
    actor.send({ type: "SUBMIT" });

    // Should transition to submittingTitle
    assertEquals(actor.getSnapshot().matches("submittingTitle"), true);

    actor.stop();
  },
});

// === Selection Events ===

Deno.test({
  name: "Detail Editing - SELECT_STATUS transitions to submitting",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: () => {
    const actor = createTestActor("changingStatus");
    actor.start();

    actor.send({ type: "SELECT_STATUS", value: "in-progress" });

    assertEquals(actor.getSnapshot().matches("submittingStatus"), true);

    actor.stop();
  },
});

Deno.test({
  name: "Detail Editing - SELECT_PRIORITY transitions to submitting",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: () => {
    const actor = createTestActor("changingPriority");
    actor.start();

    actor.send({ type: "SELECT_PRIORITY", value: 2 });

    assertEquals(actor.getSnapshot().matches("submittingPriority"), true);

    actor.stop();
  },
});

Deno.test({
  name: "Detail Editing - SELECT_FILE transitions to submitting",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: () => {
    const actor = createTestActor("addingAttachment");
    actor.start();

    actor.send({ type: "SELECT_FILE", filepath: "/path/to/file.pdf" });

    assertEquals(actor.getSnapshot().matches("submittingAttachment"), true);

    actor.stop();
  },
});

// === Description/Due Date/Tags/Recurrence SUBMIT ===

Deno.test({
  name: "Detail Editing - SUBMIT description transitions to submitting",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: () => {
    const actor = createTestActor("editingDescription");
    actor.start();

    actor.send({ type: "UPDATE_DESCRIPTION", value: "New description" });
    actor.send({ type: "SUBMIT" });

    assertEquals(actor.getSnapshot().matches("submittingDescription"), true);

    actor.stop();
  },
});

Deno.test({
  name: "Detail Editing - SUBMIT due date transitions to submitting",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: () => {
    const actor = createTestActor("changingDueDate");
    actor.start();

    actor.send({ type: "UPDATE_DUE_DATE", value: "2025-06-15" });
    actor.send({ type: "SUBMIT" });

    assertEquals(actor.getSnapshot().matches("submittingDueDate"), true);

    actor.stop();
  },
});

Deno.test({
  name: "Detail Editing - SUBMIT tags transitions to submitting",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: () => {
    const actor = createTestActor("changingTags");
    actor.start();

    actor.send({ type: "UPDATE_TAGS", value: "tag1, tag2" });
    actor.send({ type: "SUBMIT" });

    assertEquals(actor.getSnapshot().matches("submittingTags"), true);

    actor.stop();
  },
});

Deno.test({
  name: "Detail Editing - SUBMIT recurrence transitions to submitting",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: () => {
    const actor = createTestActor("changingRecurrence");
    actor.start();

    actor.send({ type: "UPDATE_RECURRENCE", value: "every week" });
    actor.send({ type: "SUBMIT" });

    assertEquals(actor.getSnapshot().matches("submittingRecurrence"), true);

    actor.stop();
  },
});

// === Context Initialization ===

Deno.test({
  name: "Detail Editing - initializes context from input",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: () => {
    const task = createTestTask();
    const actor = createTestActor("editingDescription", {
      task,
      descriptionText: "Pre-filled description",
    });
    actor.start();

    const context = actor.getSnapshot().context;

    assertEquals(context.selectedTask.id, task.id);
    assertEquals(context.descriptionText, "Pre-filled description");
    assertEquals(context.commentText, "");
    assertEquals(context.error, null);

    actor.stop();
  },
});
