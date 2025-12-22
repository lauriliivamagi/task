/**
 * Actor exports for TUI state machine
 *
 * Actors are organized into two categories:
 * - Data actors (data.actors.ts): Read-only operations (loadTasks, loadTaskDetail, toggleStatus)
 * - Editing actors (editing.actors.ts): Mutation operations (create, update, add)
 *
 * The main machine uses the combined `actors` export.
 * The detail-editing child machine imports `editingActors` directly.
 *
 * @see ./data.actors.ts
 * @see ./editing.actors.ts
 */

import {
  createWorkspaceActor,
  dataActors,
  deleteTaskActor,
  gcalSyncActor,
  loadTaskDetailActor,
  loadTasksActor,
  reorderTaskActor,
  switchDatabaseActor,
  syncPullActor,
  syncPushActor,
  toggleProgressActor,
  toggleStatusActor,
  updateDurationActor,
} from "./data.actors.ts";

import {
  addAttachmentActor,
  addCommentActor,
  createProjectAndAssignActor,
  createTaskActor,
  editingActors,
  loadProjectsActor,
  updateDescriptionActor,
  updateDueDateActor,
  updatePriorityActor,
  updateProjectActor,
  updateStatusActor,
  updateTitleActor,
} from "./editing.actors.ts";

// Re-export individual actors
export {
  addAttachmentActor,
  addCommentActor,
  createProjectAndAssignActor,
  createTaskActor,
  createWorkspaceActor,
  dataActors,
  deleteTaskActor,
  editingActors,
  gcalSyncActor,
  loadProjectsActor,
  loadTaskDetailActor,
  loadTasksActor,
  reorderTaskActor,
  switchDatabaseActor,
  syncPullActor,
  syncPushActor,
  toggleProgressActor,
  toggleStatusActor,
  updateDescriptionActor,
  updateDueDateActor,
  updateDurationActor,
  updatePriorityActor,
  updateProjectActor,
  updateStatusActor,
  updateTitleActor,
};

/** Combined actors for main machine setup */
export const actors = {
  // Data actors
  loadTasks: loadTasksActor,
  loadTaskDetail: loadTaskDetailActor,
  toggleStatus: toggleStatusActor,
  toggleProgress: toggleProgressActor,
  reorderTask: reorderTaskActor,
  createWorkspace: createWorkspaceActor,
  syncPull: syncPullActor,
  syncPush: syncPushActor,
  switchDatabase: switchDatabaseActor,
  gcalSync: gcalSyncActor,
  updateDuration: updateDurationActor,
  deleteTask: deleteTaskActor,
  // Editing actors (used by child machine, but kept here for backward compatibility)
  createTask: createTaskActor,
  addComment: addCommentActor,
  updateDescription: updateDescriptionActor,
  updateStatus: updateStatusActor,
  updatePriority: updatePriorityActor,
  updateProject: updateProjectActor,
  updateDueDate: updateDueDateActor,
  updateTitle: updateTitleActor,
  addAttachment: addAttachmentActor,
  loadProjects: loadProjectsActor,
  createProjectAndAssign: createProjectAndAssignActor,
};
