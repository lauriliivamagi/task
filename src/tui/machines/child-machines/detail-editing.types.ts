/**
 * Type definitions for the Detail Editing child machine
 *
 * This child machine handles all task detail editing operations.
 * It receives input from the parent machine and communicates back
 * via sendParent events.
 *
 * Input: client, selectedTask, initialMode, descriptionText, dueDateText
 * Output: EDITING_COMPLETE, EDITING_COMPLETE_WITH_REFRESH, EDITING_CANCELLED,
 *         PROJECTS_LOADED, PROJECT_CREATED (sent to parent)
 *
 * @see ../tui.machine.ts for parent machine integration
 */

import type { Project, TaskFull, TaskStatus } from "../../../shared/schemas.ts";
import type { ITaskClient } from "../tui.types.ts";

// === Initial Mode Types ===

export type DetailEditingMode =
  | "addingComment"
  | "editingDescription"
  | "editingTitle"
  | "changingStatus"
  | "changingPriority"
  | "loadingProjects"
  | "changingDueDate"
  | "addingAttachment"
  | "changingTags"
  | "changingRecurrence";

// === Child Machine Context ===

export interface DetailEditingContext {
  client: ITaskClient;
  selectedTask: TaskFull;
  commentText: string;
  descriptionText: string;
  titleText: string;
  dueDateText: string;
  tagsText: string;
  recurrenceText: string;
  newProjectName: string;
  projects: Project[];
  error: string | null;
}

// === Input from Parent ===

export interface DetailEditingInput {
  client: ITaskClient;
  selectedTask: TaskFull;
  initialMode: DetailEditingMode;
  descriptionText?: string; // Pre-populate from parent
  titleText?: string; // Pre-populate from parent
  dueDateText?: string; // Pre-populate from parent
  tagsText?: string; // Pre-populate from parent
  recurrenceText?: string; // Pre-populate from parent
}

// === Child Machine Events ===

export type DetailEditingEvent =
  | { type: "CANCEL" }
  | { type: "SUBMIT" }
  | { type: "UPDATE_COMMENT"; value: string }
  | { type: "UPDATE_DESCRIPTION"; value: string }
  | { type: "UPDATE_TITLE"; value: string }
  | { type: "UPDATE_DUE_DATE"; value: string }
  | { type: "UPDATE_TAGS"; value: string }
  | { type: "UPDATE_RECURRENCE"; value: string }
  | { type: "UPDATE_PROJECT_NAME"; value: string }
  | { type: "SELECT_STATUS"; value: TaskStatus }
  | { type: "SELECT_PRIORITY"; value: number }
  | { type: "SELECT_PROJECT"; value: number | null }
  | { type: "SELECT_CREATE_PROJECT" }
  | { type: "SELECT_FILE"; filepath: string };

// === Events Sent to Parent (via sendParent) ===

export type DetailEditingParentEvent =
  | { type: "EDITING_COMPLETE"; task: TaskFull }
  | { type: "EDITING_COMPLETE_WITH_REFRESH"; task: TaskFull }
  | { type: "EDITING_CANCELLED" }
  | { type: "PROJECTS_LOADED"; projects: Project[] }
  | { type: "PROJECT_CREATED"; project: Project };

// === Actor Input Types (for child machine invocations) ===

export interface AddCommentInput {
  client: ITaskClient;
  taskId: number;
  content: string;
}

export interface UpdateDescriptionInput {
  client: ITaskClient;
  taskId: number;
  description: string;
}

export interface UpdateStatusInput {
  client: ITaskClient;
  taskId: number;
  status: TaskStatus;
}

export interface UpdatePriorityInput {
  client: ITaskClient;
  taskId: number;
  priority: number;
}

export interface LoadProjectsInput {
  client: ITaskClient;
}

export interface UpdateProjectInput {
  client: ITaskClient;
  taskId: number;
  projectId: number | null;
}

export interface CreateProjectAndAssignInput {
  client: ITaskClient;
  name: string;
  taskId: number;
}

export interface UpdateDueDateInput {
  client: ITaskClient;
  taskId: number;
  dueDate: string;
}

export interface AddAttachmentInput {
  client: ITaskClient;
  taskId: number;
  filepath: string;
}

export interface UpdateTagsInput {
  client: ITaskClient;
  taskId: number;
  tags: string[];
}

export interface UpdateTitleInput {
  client: ITaskClient;
  taskId: number;
  title: string;
}

export interface UpdateRecurrenceInput {
  client: ITaskClient;
  taskId: number;
  recurrence: string; // Natural language like "every day", "every Monday"
}
