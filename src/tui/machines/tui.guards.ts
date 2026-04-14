/**
 * TUI State Machine Guards
 *
 * Guard functions for conditional state transitions.
 */

import type { TuiContext } from "./tui.types.ts";

/** Check if a task is currently selected */
export const hasSelectedTask = ({ context }: { context: TuiContext }) =>
  context.selectedTask !== null;

/** Check if the new task title is valid (non-empty) */
export const hasValidTitle = ({ context }: { context: TuiContext }) =>
  context.newTaskTitle.trim().length > 0;

/** Check if the comment text is valid (non-empty) */
export const hasValidComment = ({ context }: { context: TuiContext }) =>
  context.commentText.trim().length > 0;

/** Check if there are any tasks */
export const hasTasks = ({ context }: { context: TuiContext }) =>
  context.tasks.length > 0;

/** Check if the selected task can have its status toggled */
export const canToggleStatus = ({ context }: { context: TuiContext }) =>
  context.tasks[context.selectedIndex] !== undefined;

/** Check if a subtask can be created (requires any selected task) */
export const canCreateSubtask = ({ context }: { context: TuiContext }) => {
  return context.tasks[context.selectedIndex] !== undefined;
};

/** Check if the new project name is valid (non-empty) */
export const hasValidProjectName = ({ context }: { context: TuiContext }) =>
  context.newProjectName.trim().length > 0;

/** Check if the selected task already has a workspace */
export const hasExistingWorkspace = ({ context }: { context: TuiContext }) =>
  context.selectedTask?.workspace != null &&
  context.selectedTask.workspace.length > 0;

/** Check if the selected task has exactly one attachment */
export const hasExactlyOneAttachment = ({ context }: { context: TuiContext }) =>
  (context.selectedTask?.attachments?.length ?? 0) === 1;

/** Check if the selected task has more than one attachment */
export const hasMultipleAttachments = ({ context }: { context: TuiContext }) =>
  (context.selectedTask?.attachments?.length ?? 0) > 1;

/** All guards for machine setup */
export const guards = {
  hasSelectedTask,
  hasValidTitle,
  hasValidComment,
  hasTasks,
  canToggleStatus,
  canCreateSubtask,
  hasValidProjectName,
  hasExistingWorkspace,
  hasExactlyOneAttachment,
  hasMultipleAttachments,
};
