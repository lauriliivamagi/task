/**
 * Type definitions for the TUI state machine
 */

import type {
  Project,
  ReorderDirection,
  TaskFull,
  TaskStatus,
  TaskWithProject,
} from "../../shared/schemas.ts";
import type {
  CreateCommentInput,
  CreateTaskInput as CreateTaskInputSchema,
  UpdateTaskInput,
} from "../../shared/schemas.ts";
import type { FileSystem } from "../../shared/fs-abstraction.ts";

// Interface for the client methods we use (allows MockTaskClient to work)
export interface ITaskClient {
  listTasks(
    options?: {
      all?: boolean;
      project?: string;
      q?: string;
      semantic?: string;
    },
  ): Promise<TaskWithProject[]>;
  getTask(id: number): Promise<TaskFull>;
  createTask(input: CreateTaskInputSchema): Promise<unknown>;
  updateTask(id: number, input: UpdateTaskInput): Promise<unknown>;
  addComment(taskId: number, input: CreateCommentInput): Promise<unknown>;
  addAttachment(taskId: number, filepath: string): Promise<unknown>;
  listProjects(): Promise<Project[]>;
  createProject(
    input: { name: string; description?: string },
  ): Promise<Project>;
  reorderTask(
    taskId: number,
    direction: ReorderDirection,
  ): Promise<{
    swapped: boolean;
    message?: string;
    task?: { id: number; order: number };
    swappedWith?: { id: number; order: number };
  }>;
  addTagsToTask(
    taskId: number,
    tags: string[],
  ): Promise<{ tags: Array<{ id: number; name: string }> }>;
  setTagsForTask(
    taskId: number,
    tags: string[],
  ): Promise<{ tags: Array<{ id: number; name: string }> }>;
  createWorkspace(
    taskId: number,
    input?: { template?: string; name?: string; noOpen?: boolean },
  ): Promise<
    { path: string; name: string; opened: boolean; existed?: boolean }
  >;
  syncToCalendar(
    taskId: number,
    options?: { durationHours?: number; calendarId?: string },
  ): Promise<{
    success: boolean;
    eventId?: string;
    eventUrl?: string;
    action: "created" | "updated" | "skipped";
    error?: string;
  }>;
  getGcalStatus(): Promise<{ authenticated: boolean; calendarId?: string }>;
  health(): Promise<{ status: string }>;
  deleteTask(id: number): Promise<{ deleted: boolean }>;
}

// === Machine Input ===
export interface TuiMachineInput {
  client: ITaskClient;
  lastSelectedTaskId?: number | null;
  /** Optional filesystem for TUI state persistence (defaults to real FS) */
  fs?: FileSystem;
  /** Optional path to state file (defaults to database dir) */
  stateFile?: string;
}

// === Machine Context ===
export interface TuiContext {
  // Data
  tasks: TaskWithProject[];
  selectedTask: TaskFull | null;
  selectedIndex: number;
  projects: Project[];

  // Form state (kept in context for persistence across transitions)
  newTaskTitle: string;
  newTaskParentId: number | null; // For creating subtasks
  newProjectName: string; // For creating new projects
  commentText: string;
  descriptionText: string;
  dueDateText: string;
  tagsText: string;
  recurrenceText: string;
  fileBrowserPath: string;
  editingTitleText: string; // For inline title editing
  titleText: string; // For detail view title editing
  gcalDurationText: string; // For gcal sync duration input
  durationText: string; // For task duration editing

  // Task to select after refresh (for newly created tasks)
  pendingSelectTaskId: number | null;

  // Last selected task ID (for restoring selection on TUI restart)
  lastSelectedTaskId: number | null;

  // Command palette state
  paletteFilter: string;
  paletteSelectedIndex: number;

  // Search state
  searchQuery: string;

  // Child machine state (tracks current editing mode for selectors)
  currentEditingMode: string | null;

  // Error handling
  error: string | null;

  // Status messages (non-error, e.g., "Pushing...")
  status: string | null;

  // Dependencies (injected)
  client: ITaskClient;

  // Optional filesystem for TUI state persistence (defaults to real FS)
  fs?: FileSystem;
  stateFile?: string;
}

// === Machine Events ===
export type TuiEvent =
  // Navigation
  | { type: "TAB" }
  | { type: "HIGHLIGHT_TASK"; task: TaskWithProject }
  | { type: "SELECT_TASK"; taskId: number }
  // Data operations
  | { type: "LOAD_TASKS" }
  | { type: "REFRESH" }
  | { type: "TOGGLE_STATUS" }
  | { type: "TOGGLE_PROGRESS" }
  | { type: "MOVE_TASK_UP" }
  | { type: "MOVE_TASK_DOWN" }
  | { type: "START_WORK" }
  | { type: "QUIT" }
  // Mode transitions
  | { type: "OPEN_COMMAND_PALETTE" }
  | { type: "OPEN_HELP" }
  | { type: "START_SEARCH" }
  | { type: "START_CREATE_TASK" }
  | { type: "START_CREATE_SUBTASK" }
  | { type: "START_ADD_COMMENT" }
  | { type: "START_EDIT_DESCRIPTION" }
  | { type: "START_CHANGE_STATUS" }
  | { type: "START_CHANGE_PRIORITY" }
  | { type: "START_CHANGE_PROJECT" }
  | { type: "START_CHANGE_DUE_DATE" }
  | { type: "START_ADD_ATTACHMENT" }
  | { type: "START_CHANGE_TAGS" }
  | { type: "START_CHANGE_RECURRENCE" }
  | { type: "START_EDIT_TITLE" } // Detail view title editing
  | { type: "START_EDIT_TITLE_IN_LIST" } // List view inline title editing
  | { type: "START_CHANGE_DURATION" } // Duration editing
  | { type: "START_DELETE_TASK" } // Delete task confirmation
  | { type: "CONFIRM_DELETE" } // Confirm task deletion
  | { type: "CANCEL" }
  // Form input
  | { type: "UPDATE_TITLE"; value: string }
  | { type: "UPDATE_EDITING_TITLE"; value: string } // List view inline title editing
  | { type: "UPDATE_COMMENT"; value: string }
  | { type: "UPDATE_DESCRIPTION"; value: string }
  | { type: "UPDATE_DUE_DATE"; value: string }
  | { type: "UPDATE_TAGS"; value: string }
  | { type: "UPDATE_RECURRENCE"; value: string }
  | { type: "UPDATE_DURATION"; value: string }
  | { type: "CONFIRM_DURATION" }
  | { type: "UPDATE_PROJECT_NAME"; value: string }
  | { type: "UPDATE_PALETTE_FILTER"; value: string }
  | { type: "UPDATE_SEARCH_QUERY"; value: string }
  | { type: "PALETTE_UP" }
  | { type: "PALETTE_DOWN"; max: number }
  | { type: "SUBMIT" }
  | { type: "CLEAR_SEARCH" }
  // Selection events
  | { type: "SELECT_STATUS"; value: TaskStatus }
  | { type: "SELECT_PRIORITY"; value: number }
  | { type: "SELECT_PROJECT"; value: number | null }
  | { type: "SELECT_CREATE_PROJECT" }
  | { type: "SELECT_FILE"; filepath: string }
  // Command palette
  | { type: "EXECUTE_COMMAND"; commandId: string }
  // Sync operations
  | { type: "SYNC_PULL" }
  | { type: "SYNC_PUSH" }
  | { type: "START_GCAL_SYNC" }
  | { type: "UPDATE_GCAL_DURATION"; value: string }
  | { type: "CONFIRM_GCAL_SYNC" }
  | { type: "GCAL_SYNC_COMPLETE"; eventUrl?: string }
  | { type: "GCAL_SYNC_ERROR"; error: string }
  // Database switching
  | { type: "SHOW_DB_PICKER" }
  | { type: "CANCEL_DB_PICKER" }
  | { type: "SELECT_DB"; name: string }
  | { type: "DB_SWITCH_COMPLETE" }
  | { type: "DB_SWITCH_ERROR"; error: string }
  // Child machine events (sent from detailEditing child)
  | { type: "EDITING_COMPLETE"; task: TaskFull }
  | { type: "EDITING_COMPLETE_WITH_REFRESH"; task: TaskFull }
  | { type: "EDITING_CANCELLED" }
  | { type: "EDITING_MODE_CHANGED"; mode: string }
  | { type: "PROJECTS_LOADED"; projects: Project[] }
  | { type: "PROJECT_CREATED"; project: Project }
  | { type: "WORKSPACE_CREATED"; path: string; existed: boolean }
  | { type: "WORKSPACE_ERROR"; error: string }
  // Error management
  | { type: "SET_ERROR"; error: string }
  | { type: "CLEAR_ERROR" }
  // Status messages (non-error)
  | { type: "SET_STATUS"; status: string }
  | { type: "CLEAR_STATUS" };

// === Actor Input Types ===
export interface LoadTasksInput {
  client: ITaskClient;
  all?: boolean;
  semantic?: string;
}

export interface LoadTaskDetailInput {
  client: ITaskClient;
  taskId: number;
}

export interface CreateTaskInput {
  client: ITaskClient;
  title: string;
  parentId: number | null;
}

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

export interface ToggleStatusInput {
  client: ITaskClient;
  task: TaskWithProject;
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

export interface UpdateProjectInput {
  client: ITaskClient;
  taskId: number;
  projectId: number | null;
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

export interface LoadProjectsInput {
  client: ITaskClient;
}

export interface CreateProjectAndAssignInput {
  client: ITaskClient;
  name: string;
  taskId: number;
}

export interface ReorderTaskInput {
  client: ITaskClient;
  taskId: number;
  direction: ReorderDirection;
}

export interface CreateWorkspaceInput {
  client: ITaskClient;
  taskId: number;
}

export interface UpdateTitleInput {
  client: ITaskClient;
  taskId: number;
  title: string;
}

export interface GcalSyncInput {
  client: ITaskClient;
  taskId: number;
  durationHours: number;
}

export interface UpdateDurationInput {
  client: ITaskClient;
  taskId: number;
  durationHours: number | null;
}

export interface DeleteTaskInput {
  client: ITaskClient;
  taskId: number;
}

// === UI Mode Type (derived from state) ===
export type UiMode =
  | "loading"
  | "list"
  | "detail"
  | "commandPalette"
  | "help"
  | "searching"
  | "creatingTask"
  | "editingTitleInList"
  | "editingTitle"
  | "addingComment"
  | "editingDescription"
  | "changingStatus"
  | "changingPriority"
  | "changingProject"
  | "creatingProject"
  | "changingDueDate"
  | "changingTags"
  | "changingRecurrence"
  | "changingDuration"
  | "addingAttachment"
  | "creatingWorkspace"
  | "pickingDatabase"
  | "switchingDatabase"
  | "enteringGcalDuration"
  | "syncingToCalendar"
  | "confirmingDelete"
  | "deletingTask"
  | "submitting";

// === Focus Type ===
export type Focus = "list" | "detail";

// === Command Definition ===
export interface Command {
  id: string;
  label: string;
  shortcut?: string;
  context?: "list" | "detail" | "global";
}
