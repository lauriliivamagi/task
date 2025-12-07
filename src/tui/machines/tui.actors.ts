/**
 * TUI State Machine Actors
 *
 * Re-exports actors from split modules for backward compatibility.
 * New code should import from actors/index.ts directly.
 */

export {
  actors,
  addAttachmentActor,
  addCommentActor,
  createProjectAndAssignActor,
  createTaskActor,
  createWorkspaceActor,
  dataActors,
  editingActors,
  loadProjectsActor,
  loadTaskDetailActor,
  loadTasksActor,
  reorderTaskActor,
  switchDatabaseActor,
  syncPullActor,
  syncPushActor,
  toggleStatusActor,
  updateDescriptionActor,
  updateDueDateActor,
  updatePriorityActor,
  updateProjectActor,
  updateStatusActor,
  updateTitleActor,
} from "./actors/index.ts";
