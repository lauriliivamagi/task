/**
 * TUI State Machine
 *
 * Manages all UI state for the terminal interface using XState v5.
 * Uses parallel regions for data loading and UI mode management.
 *
 * Architecture:
 * - data region: idle -> loading -> ready | error (+ loadingDetail, togglingStatus)
 * - ui region: normal (list/detail) | commandPalette | creatingTask | detailEditing
 *
 * Child Machines:
 * - detailEditing: Handles all task detail editing operations (comment, description,
 *   status, priority, project, due date, attachment). Invoked when user enters
 *   any editing mode from the detail view. Communicates back via sendParent events.
 *
 * Event Flow:
 * - User input events (CANCEL, SUBMIT, UPDATE_*) are forwarded to child machine
 * - Child machine sends completion events (EDITING_COMPLETE, EDITING_CANCELLED)
 * - Parent handles these to update context and transition back to normal state
 *
 * @see ./child-machines/detail-editing.machine.ts
 * @see ./tui.types.ts for context and event types
 */

import { assign, forwardTo, raise, setup } from "xstate";
import type {
  Project,
  TaskFull,
  TaskWithProject,
} from "../../shared/schemas.ts";
import type { TuiContext, TuiEvent, TuiMachineInput } from "./tui.types.ts";
import { actors } from "./tui.actors.ts";
import { guards } from "./tui.guards.ts";
import { detailEditingMachine } from "./child-machines/detail-editing.machine.ts";
import type { DetailEditingMode } from "./child-machines/detail-editing.types.ts";
import { saveLastSelectedTaskId } from "../tui-state.ts";
import { formatDateTimeForEditing } from "../../shared/date-parser.ts";
import { assertDefined } from "../../shared/assert.ts";

// === Machine Setup ===

export const tuiMachine = setup({
  types: {} as {
    context: TuiContext;
    events: TuiEvent;
    input: TuiMachineInput;
  },
  actors: {
    ...actors,
    detailEditing: detailEditingMachine,
  },
  guards,
  // Actions must be defined inline for proper type inference
  actions: {
    clearError: assign({ error: null }),
    clearStatus: assign({ status: null }),
    clearFormFields: assign({
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
      gcalDurationText: "",
    }),
    clearPaletteState: assign({
      paletteFilter: "",
      paletteSelectedIndex: 0,
    }),
    selectFirstTask: assign({
      selectedIndex: 0,
    }),
  },
}).createMachine({
  id: "tui",
  type: "parallel",
  context: ({ input }) => ({
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
    lastSelectedTaskId: input.lastSelectedTaskId ?? null,
    paletteFilter: "",
    paletteSelectedIndex: 0,
    searchQuery: "",
    currentEditingMode: null,
    error: null,
    status: null,
    client: input.client,
    fs: input.fs,
    stateFile: input.stateFile,
  }),

  // Global event handlers (available in all states)
  on: {
    SET_ERROR: {
      actions: assign({ error: ({ event }) => event.error }),
    },
    CLEAR_ERROR: {
      actions: "clearError",
    },
    SET_STATUS: {
      actions: assign({ status: ({ event }) => event.status }),
    },
    CLEAR_STATUS: {
      actions: "clearStatus",
    },
  },

  states: {
    // === Data Loading Region ===
    data: {
      initial: "loading",
      states: {
        idle: {
          on: {
            LOAD_TASKS: "loading",
            REFRESH: "loading",
          },
        },
        loading: {
          invoke: {
            id: "loadTasks",
            src: "loadTasks",
            input: ({ context }) => ({
              client: context.client,
              all: false,
              semantic: context.searchQuery || undefined,
            }),
            onDone: [
              {
                // If tasks exist, load details for the first one
                target: "loadingDetail",
                guard: ({ event }) => event.output.length > 0,
                actions: assign({
                  tasks: ({ event }) => event.output,
                  error: null,
                  // Priority: pendingSelectTaskId > current selectedTask > lastSelectedTaskId > first task
                  selectedIndex: ({ context, event }) => {
                    // First priority: pending selection (for newly created tasks)
                    if (context.pendingSelectTaskId !== null) {
                      const idx = event.output.findIndex(
                        (t: TaskWithProject) =>
                          t.id === context.pendingSelectTaskId,
                      );
                      if (idx >= 0) return idx;
                    }
                    // Second priority: preserve current selection
                    if (context.selectedTask) {
                      const selectedTaskId = context.selectedTask.id;
                      const idx = event.output.findIndex(
                        (t: TaskWithProject) => t.id === selectedTaskId,
                      );
                      if (idx >= 0) return idx;
                    }
                    // Third priority: restore last selected task from previous session
                    if (context.lastSelectedTaskId !== null) {
                      const idx = event.output.findIndex(
                        (t: TaskWithProject) =>
                          t.id === context.lastSelectedTaskId,
                      );
                      if (idx >= 0) return idx;
                    }
                    return 0;
                  },
                }),
              },
              {
                // No tasks, go to ready
                target: "ready",
                actions: assign({
                  tasks: ({ event }) => event.output,
                  error: null,
                  selectedIndex: 0,
                  selectedTask: null,
                  pendingSelectTaskId: null,
                }),
              },
            ],
            onError: {
              target: "error",
              actions: assign({
                error: ({ event }) =>
                  event.error instanceof Error
                    ? event.error.message
                    : "Failed to load tasks",
              }),
            },
          },
        },
        ready: {
          on: {
            REFRESH: "loading",
            HIGHLIGHT_TASK: {
              target: "loadingDetail",
              actions: assign({
                selectedIndex: ({ context, event }) =>
                  context.tasks.findIndex((t) => t.id === event.task.id),
                pendingSelectTaskId: null, // Clear after selection
              }),
            },
            TOGGLE_STATUS: {
              target: "togglingStatus",
              guard: "canToggleStatus",
            },
            TOGGLE_PROGRESS: {
              target: "togglingProgress",
              guard: "canToggleStatus",
            },
            MOVE_TASK_UP: {
              target: "reorderingTask",
              guard: "canToggleStatus", // Reuse guard - needs a selected task
              actions: assign({
                pendingSelectTaskId: ({ context }) =>
                  context.tasks[context.selectedIndex]?.id ?? null,
              }),
            },
            MOVE_TASK_DOWN: {
              target: "reorderingTask",
              guard: "canToggleStatus",
              actions: assign({
                pendingSelectTaskId: ({ context }) =>
                  context.tasks[context.selectedIndex]?.id ?? null,
              }),
            },
            SYNC_PULL: "syncingPull",
            SYNC_PUSH: "syncingPush",
            START_GCAL_SYNC: {
              target: "enteringGcalDuration",
              guard: "hasSelectedTask",
              actions: assign({
                gcalDurationText: ({ context }) =>
                  context.selectedTask?.duration_hours?.toString() ?? "1",
              }),
            },
            START_CHANGE_DURATION: {
              target: "enteringDuration",
              guard: "hasSelectedTask",
              actions: assign({
                durationText: ({ context }) =>
                  context.selectedTask?.duration_hours?.toString() ?? "",
              }),
            },
          },
        },
        loadingDetail: {
          on: {
            // Allow reordering even while loading details
            MOVE_TASK_UP: {
              target: "reorderingTask",
              guard: "canToggleStatus",
              actions: assign({
                pendingSelectTaskId: ({ context }) =>
                  context.tasks[context.selectedIndex]?.id ?? null,
              }),
            },
            MOVE_TASK_DOWN: {
              target: "reorderingTask",
              guard: "canToggleStatus",
              actions: assign({
                pendingSelectTaskId: ({ context }) =>
                  context.tasks[context.selectedIndex]?.id ?? null,
              }),
            },
          },
          invoke: {
            id: "loadTaskDetail",
            src: "loadTaskDetail",
            input: ({ context }) => ({
              client: context.client,
              taskId: context.tasks[context.selectedIndex]?.id ?? 0,
            }),
            onDone: {
              target: "ready",
              actions: [
                assign({
                  selectedTask: ({ event }) => event.output,
                  lastSelectedTaskId: ({ event }) => event.output.id,
                  error: null,
                }),
                // Fire-and-forget save to persist selection for next TUI session
                ({ event, context }) => {
                  saveLastSelectedTaskId(
                    event.output.id,
                    context.fs,
                    context.stateFile,
                  );
                },
              ],
            },
            onError: {
              target: "ready",
              actions: assign({
                error: ({ event }) =>
                  event.error instanceof Error
                    ? event.error.message
                    : "Failed to load task details",
              }),
            },
          },
        },
        togglingStatus: {
          invoke: {
            id: "toggleStatus",
            src: "toggleStatus",
            input: ({ context }) => ({
              client: context.client,
              task: context.tasks[context.selectedIndex],
            }),
            onDone: [
              {
                // If a recurring task created a new instance, reload the list
                guard: ({ event }) => event.output.recurringNextTaskId !== null,
                target: "loading",
                actions: assign({
                  // Set pending task ID so the new task is selected after reload
                  pendingSelectTaskId: ({ event }) =>
                    event.output.recurringNextTaskId,
                  selectedTask: ({ event }) => event.output.task,
                }),
              },
              {
                // Normal toggle: stay in ready, update local state (no auto-refresh)
                target: "ready",
                actions: assign({
                  selectedTask: ({ event }) => event.output.task,
                  // Update the task in the local list to show strikethrough
                  tasks: ({ context, event }) =>
                    context.tasks.map((t) =>
                      t.id === event.output.task.id
                        ? { ...t, status: event.output.task.status }
                        : t
                    ),
                }),
              },
            ],
            onError: {
              target: "ready",
              actions: assign({
                error: ({ event }) =>
                  event.error instanceof Error
                    ? event.error.message
                    : "Failed to mark as done",
              }),
            },
          },
        },
        togglingProgress: {
          invoke: {
            id: "toggleProgress",
            src: "toggleProgress",
            input: ({ context }) => ({
              client: context.client,
              task: context.tasks[context.selectedIndex],
            }),
            onDone: {
              target: "ready",
              actions: assign({
                selectedTask: ({ event }) => event.output.task,
                // Update the task in the local list to show status change
                tasks: ({ context, event }) =>
                  context.tasks.map((t) =>
                    t.id === event.output.task.id
                      ? { ...t, status: event.output.task.status }
                      : t
                  ),
              }),
            },
            onError: {
              target: "ready",
              actions: assign({
                error: ({ event }) =>
                  event.error instanceof Error
                    ? event.error.message
                    : "Failed to toggle progress",
              }),
            },
          },
        },
        reorderingTask: {
          invoke: {
            id: "reorderTask",
            src: "reorderTask",
            input: ({ context, event }) => ({
              client: context.client,
              taskId: context.tasks[context.selectedIndex]?.id ?? 0,
              direction: event.type === "MOVE_TASK_UP" ? "up" : "down",
            }),
            onDone: {
              target: "loading", // Refresh the list to get new order
            },
            onError: {
              target: "ready",
              actions: assign({
                error: ({ event }) =>
                  event.error instanceof Error
                    ? event.error.message
                    : "Failed to reorder task",
              }),
            },
          },
        },
        syncingPull: {
          entry: assign({ status: "Pulling..." }),
          invoke: {
            id: "syncPull",
            src: "syncPull",
            onDone: {
              target: "loading", // Refresh tasks after pull
              actions: [
                assign({ status: null }),
                assign({
                  error: ({ event }) =>
                    event.output.success ? null : (event.output.error ?? null),
                }),
              ],
            },
            onError: {
              target: "ready",
              actions: [
                assign({ status: null }),
                assign({
                  error: ({ event }) =>
                    event.error instanceof Error
                      ? event.error.message
                      : "Pull failed",
                }),
              ],
            },
          },
        },
        syncingPush: {
          entry: assign({ status: "Pushing..." }),
          invoke: {
            id: "syncPush",
            src: "syncPush",
            onDone: {
              target: "loading", // Refresh to trigger re-render
              actions: [
                assign({ status: null }),
                assign({
                  error: ({ event }) =>
                    event.output.success ? null : (event.output.error ?? null),
                }),
              ],
            },
            onError: {
              target: "ready",
              actions: [
                assign({ status: null }),
                assign({
                  error: ({ event }) =>
                    event.error instanceof Error
                      ? event.error.message
                      : "Push failed",
                }),
              ],
            },
          },
        },
        enteringGcalDuration: {
          on: {
            UPDATE_GCAL_DURATION: {
              actions: assign({
                gcalDurationText: ({ event }) => event.value,
              }),
            },
            CONFIRM_GCAL_SYNC: {
              target: "syncingToCalendar",
              guard: ({ context }) => {
                const duration = parseFloat(context.gcalDurationText);
                return !isNaN(duration) && duration > 0 && duration <= 24;
              },
            },
            CANCEL: {
              target: "ready",
              actions: assign({ gcalDurationText: "1" }),
            },
          },
        },
        enteringDuration: {
          on: {
            UPDATE_DURATION: {
              actions: assign({
                durationText: ({ event }) => event.value,
              }),
            },
            CONFIRM_DURATION: {
              target: "updatingDuration",
              guard: ({ context }) => {
                // Allow empty string to clear duration
                if (context.durationText.trim() === "") return true;
                const duration = parseFloat(context.durationText);
                return !isNaN(duration) && duration >= 0.25 && duration <= 24;
              },
            },
            CANCEL: {
              target: "ready",
              actions: assign({ durationText: "" }),
            },
          },
        },
        updatingDuration: {
          entry: assign({ status: "Updating duration..." }),
          invoke: {
            id: "updateDuration",
            src: "updateDuration",
            input: ({ context }) => ({
              client: context.client,
              taskId: context.selectedTask?.id ?? 0,
              durationHours: context.durationText.trim() === ""
                ? null
                : parseFloat(context.durationText),
            }),
            onDone: {
              target: "ready",
              actions: [
                assign({ status: null }),
                assign({ durationText: "" }),
                // Update selectedTask with the new duration_hours
                assign({
                  selectedTask: ({ context, event }) => {
                    return context.selectedTask
                      ? {
                        ...context.selectedTask,
                        duration_hours: event.output.duration_hours ?? null,
                      }
                      : null;
                  },
                }),
                // Update the task in the tasks list
                assign({
                  tasks: ({ context, event }) => {
                    const taskId = context.selectedTask?.id;
                    if (!taskId) return context.tasks;
                    return context.tasks.map((t) =>
                      t.id === taskId
                        ? {
                          ...t,
                          duration_hours: event.output.duration_hours ?? null,
                        }
                        : t
                    );
                  },
                }),
                // Ensure selectedIndex stays correct after updating tasks
                assign({
                  selectedIndex: ({ context }) => {
                    const taskId = context.selectedTask?.id;
                    if (!taskId) return context.selectedIndex;
                    const idx = context.tasks.findIndex((t) => t.id === taskId);
                    return idx >= 0 ? idx : context.selectedIndex;
                  },
                }),
              ],
            },
            onError: {
              target: "ready",
              actions: [
                assign({ status: null }),
                assign({ durationText: "" }),
                assign({
                  error: ({ event }) =>
                    event.error instanceof Error
                      ? event.error.message
                      : "Failed to update duration",
                }),
              ],
            },
          },
        },
        syncingToCalendar: {
          entry: assign({ status: "Syncing to calendar..." }),
          invoke: {
            id: "gcalSync",
            src: "gcalSync",
            input: ({ context }) => ({
              client: context.client,
              taskId: context.selectedTask?.id ?? 0,
              durationHours: parseFloat(context.gcalDurationText) || 1,
            }),
            onDone: {
              target: "ready",
              actions: [
                assign({ status: null }),
                assign({ gcalDurationText: "1" }),
                assign({
                  error: ({ event }) =>
                    event.output.success ? null : (event.output.error ?? null),
                }),
                // Update selectedTask with the new gcal_event_id, gcal_event_url, and duration_hours
                assign({
                  selectedTask: ({ context, event }) => {
                    if (!event.output.success || !event.output.eventId) {
                      return context.selectedTask;
                    }
                    const durationHours =
                      parseFloat(context.gcalDurationText) || 1;
                    return context.selectedTask
                      ? {
                        ...context.selectedTask,
                        gcal_event_id: event.output.eventId,
                        gcal_event_url: event.output.eventUrl ?? null,
                        duration_hours: durationHours,
                      }
                      : null;
                  },
                }),
                // Update the task in the tasks list
                assign({
                  tasks: ({ context, event }) => {
                    const eventId = event.output.eventId;
                    if (!event.output.success || !eventId) {
                      return context.tasks;
                    }
                    const taskId = context.selectedTask?.id;
                    if (!taskId) return context.tasks;
                    const durationHours =
                      parseFloat(context.gcalDurationText) || 1;
                    return context.tasks.map((t) =>
                      t.id === taskId
                        ? {
                          ...t,
                          gcal_event_id: eventId,
                          gcal_event_url: event.output.eventUrl ?? null,
                          duration_hours: durationHours,
                        }
                        : t
                    );
                  },
                }),
                // Ensure selectedIndex stays correct after updating tasks
                assign({
                  selectedIndex: ({ context }) => {
                    const taskId = context.selectedTask?.id;
                    if (!taskId) return context.selectedIndex;
                    const idx = context.tasks.findIndex((t) => t.id === taskId);
                    return idx >= 0 ? idx : context.selectedIndex;
                  },
                }),
              ],
            },
            onError: {
              target: "ready",
              actions: [
                assign({ status: null }),
                assign({ gcalDurationText: "1" }),
                assign({
                  error: ({ event }) =>
                    event.error instanceof Error
                      ? event.error.message
                      : "Calendar sync failed",
                }),
              ],
            },
          },
        },
        error: {
          on: {
            REFRESH: "loading",
            LOAD_TASKS: "loading",
          },
        },
      },
    },

    // === UI Mode Region ===
    ui: {
      initial: "normal",
      states: {
        normal: {
          initial: "list",
          on: {
            OPEN_COMMAND_PALETTE: {
              target: "commandPalette",
              actions: "clearPaletteState",
            },
            OPEN_HELP: "help",
            START_CREATE_TASK: "creatingTask",
            START_SEARCH: "searching",
            START_WORK: {
              target: "creatingWorkspace",
              guard: "hasSelectedTask",
            },
            CLEAR_SEARCH: {
              actions: [
                assign({ searchQuery: "" }),
                raise({ type: "REFRESH" }),
              ],
            },
            // Handle SHOW_DB_PICKER from normal state (sent after EXECUTE_COMMAND transitions here)
            SHOW_DB_PICKER: {
              target: "pickingDatabase",
            },
          },
          states: {
            list: {
              on: {
                TAB: "detail",
                START_CREATE_SUBTASK: {
                  target: "#tui.ui.creatingTask",
                  guard: "canCreateSubtask",
                  actions: assign({
                    newTaskParentId: ({ context }) =>
                      context.tasks[context.selectedIndex]?.id ?? null,
                  }),
                },
                START_EDIT_TITLE_IN_LIST: {
                  target: "#tui.ui.editingTitleInList",
                  guard: "hasSelectedTask",
                  actions: assign({
                    editingTitleText: ({ context }) =>
                      context.tasks[context.selectedIndex]?.title ?? "",
                  }),
                },
              },
            },
            detail: {
              on: {
                TAB: "list",
                START_ADD_COMMENT: {
                  target: "#tui.ui.detailEditing",
                  guard: "hasSelectedTask",
                  actions: assign({
                    currentEditingMode: "addingComment",
                  }),
                },
                START_EDIT_DESCRIPTION: {
                  target: "#tui.ui.detailEditing",
                  guard: "hasSelectedTask",
                  actions: assign({
                    currentEditingMode: "editingDescription",
                    descriptionText: ({ context }) =>
                      context.selectedTask?.description ?? "",
                  }),
                },
                START_CHANGE_STATUS: {
                  target: "#tui.ui.detailEditing",
                  guard: "hasSelectedTask",
                  actions: assign({
                    currentEditingMode: "changingStatus",
                  }),
                },
                START_CHANGE_PRIORITY: {
                  target: "#tui.ui.detailEditing",
                  guard: "hasSelectedTask",
                  actions: assign({
                    currentEditingMode: "changingPriority",
                  }),
                },
                START_CHANGE_PROJECT: {
                  target: "#tui.ui.detailEditing",
                  guard: "hasSelectedTask",
                  actions: assign({
                    currentEditingMode: "loadingProjects",
                  }),
                },
                START_CHANGE_DUE_DATE: {
                  target: "#tui.ui.detailEditing",
                  guard: "hasSelectedTask",
                  actions: assign({
                    currentEditingMode: "changingDueDate",
                    dueDateText: ({ context }) =>
                      formatDateTimeForEditing(
                        context.selectedTask?.due_date ?? "",
                      ),
                  }),
                },
                START_ADD_ATTACHMENT: {
                  target: "#tui.ui.detailEditing",
                  guard: "hasSelectedTask",
                  actions: assign({
                    currentEditingMode: "addingAttachment",
                  }),
                },
                START_CHANGE_TAGS: {
                  target: "#tui.ui.detailEditing",
                  guard: "hasSelectedTask",
                  actions: assign({
                    currentEditingMode: "changingTags",
                    tagsText: ({ context }) =>
                      context.selectedTask?.tags?.map((t) => t.name).join(
                        " ",
                      ) ??
                        "",
                  }),
                },
                START_CHANGE_RECURRENCE: {
                  target: "#tui.ui.detailEditing",
                  guard: "hasSelectedTask",
                  actions: assign({
                    currentEditingMode: "changingRecurrence",
                    recurrenceText: ({ context }) => {
                      const rec = context.selectedTask?.recurrence;
                      if (!rec) return "";
                      // Import formatRecurrence would cause circular dependency
                      // Just provide the current recurrence as an empty string
                      // User will type a new value
                      return "";
                    },
                  }),
                },
                START_EDIT_TITLE: {
                  target: "#tui.ui.detailEditing",
                  guard: "hasSelectedTask",
                  actions: assign({
                    currentEditingMode: "editingTitle",
                    titleText: ({ context }) =>
                      context.selectedTask?.title ?? "",
                  }),
                },
              },
            },
            hist: { type: "history" },
          },
        },

        commandPalette: {
          on: {
            CANCEL: {
              target: "normal.hist",
              actions: "clearPaletteState",
            },
            EXECUTE_COMMAND: {
              target: "normal.hist",
              actions: "clearPaletteState",
            },
            SHOW_DB_PICKER: {
              target: "pickingDatabase",
              actions: "clearPaletteState",
            },
            UPDATE_PALETTE_FILTER: {
              actions: assign({
                paletteFilter: ({ event }) => event.value,
                paletteSelectedIndex: 0,
              }),
            },
            PALETTE_UP: {
              actions: assign({
                paletteSelectedIndex: ({ context }) =>
                  Math.max(0, context.paletteSelectedIndex - 1),
              }),
            },
            PALETTE_DOWN: {
              actions: assign({
                paletteSelectedIndex: ({ context, event }) =>
                  Math.min(event.max - 1, context.paletteSelectedIndex + 1),
              }),
            },
          },
        },

        help: {
          on: {
            CANCEL: {
              target: "normal.hist",
            },
          },
        },

        pickingDatabase: {
          on: {
            CANCEL_DB_PICKER: {
              target: "normal.hist",
            },
            SELECT_DB: {
              target: "switchingDatabase",
            },
          },
        },

        switchingDatabase: {
          invoke: {
            id: "switchDatabase",
            src: "switchDatabase",
            input: ({ event }) => {
              // Type narrowing for SELECT_DB event
              if (event.type === "SELECT_DB") {
                return { name: event.name };
              }
              // This shouldn't happen but satisfy TypeScript
              return { name: "default" };
            },
            onDone: {
              target: "normal.list",
              actions: [
                assign({
                  tasks: [],
                  selectedTask: null,
                  selectedIndex: 0,
                  pendingSelectTaskId: null,
                  lastSelectedTaskId: null,
                }),
                raise({ type: "REFRESH" }),
              ],
            },
            onError: {
              target: "normal.hist",
              actions: assign({
                error: ({ event }) =>
                  event.error instanceof Error
                    ? event.error.message
                    : "Failed to switch database",
              }),
            },
          },
        },

        searching: {
          on: {
            CANCEL: {
              target: "normal.list",
              actions: assign({ searchQuery: "" }),
            },
            UPDATE_SEARCH_QUERY: {
              actions: assign({
                searchQuery: ({ event }) => event.value,
              }),
            },
            SUBMIT: {
              target: "normal.list",
              actions: raise({ type: "REFRESH" }),
            },
          },
        },

        creatingTask: {
          on: {
            CANCEL: {
              target: "normal.list",
              actions: "clearFormFields",
            },
            UPDATE_TITLE: {
              actions: assign({
                newTaskTitle: ({ event }) => event.value,
              }),
            },
            SUBMIT: {
              target: "submittingTask",
              guard: "hasValidTitle",
            },
          },
        },

        submittingTask: {
          invoke: {
            id: "createTask",
            src: "createTask",
            input: ({ context }) => ({
              client: context.client,
              title: context.newTaskTitle,
              parentId: context.newTaskParentId,
            }),
            onDone: {
              target: "normal.list",
              actions: [
                "clearFormFields",
                assign({
                  pendingSelectTaskId: ({ event }) => event.output.id,
                }),
                raise({ type: "REFRESH" }),
              ],
            },
            onError: {
              target: "creatingTask",
              actions: assign({
                error: ({ event }) =>
                  event.error instanceof Error
                    ? event.error.message
                    : "Failed to create task",
              }),
            },
          },
        },

        creatingWorkspace: {
          invoke: {
            id: "createWorkspace",
            src: "createWorkspace",
            input: ({ context }) => {
              assertDefined(
                context.selectedTask,
                "Selected task must be defined when creating workspace",
                "tui.machine",
              );
              return {
                client: context.client,
                taskId: context.selectedTask.id,
              };
            },
            onDone: {
              target: "normal.hist",
              // Refresh to show status change (todo -> in-progress)
              actions: raise({ type: "REFRESH" }),
            },
            onError: {
              target: "normal.hist",
              actions: assign({
                error: ({ event }) =>
                  event.error instanceof Error
                    ? event.error.message
                    : "Failed to create workspace",
              }),
            },
          },
        },

        // === List View Title Editing ===
        editingTitleInList: {
          on: {
            CANCEL: {
              target: "normal.list",
              actions: "clearFormFields",
            },
            UPDATE_EDITING_TITLE: {
              actions: assign({
                editingTitleText: ({ event }) => event.value,
              }),
            },
            SUBMIT: {
              target: "submittingTitleInList",
              guard: ({ context }) =>
                context.editingTitleText.trim().length > 0,
            },
          },
        },

        submittingTitleInList: {
          invoke: {
            id: "updateTitleInList",
            src: "updateTitle",
            input: ({ context }) => ({
              client: context.client,
              taskId: context.tasks[context.selectedIndex]?.id ?? 0,
              title: context.editingTitleText.trim(),
            }),
            onDone: {
              target: "normal.list",
              actions: [
                "clearFormFields",
                assign({
                  // Update the task in the local list
                  tasks: ({ context, event }) =>
                    context.tasks.map((t) =>
                      t.id === event.output.id
                        ? { ...t, title: event.output.title }
                        : t
                    ),
                  selectedTask: ({ event }) => event.output,
                  // Preserve selection by setting pendingSelectTaskId
                  pendingSelectTaskId: ({ event }) => event.output.id,
                }),
              ],
            },
            onError: {
              target: "editingTitleInList",
              actions: assign({
                error: ({ event }) =>
                  event.error instanceof Error
                    ? event.error.message
                    : "Failed to update title",
              }),
            },
          },
        },

        // === Detail Editing (Child Machine) ===
        detailEditing: {
          invoke: {
            id: "detailEditing",
            src: "detailEditing",
            input: ({ context }) => {
              if (!context.selectedTask) {
                throw new Error(
                  "selectedTask must be defined when entering detail editing",
                );
              }
              return {
                client: context.client,
                selectedTask: context.selectedTask,
                initialMode: (context.currentEditingMode ??
                  "addingComment") as DetailEditingMode,
                descriptionText: context.descriptionText,
                titleText: context.titleText,
                dueDateText: context.dueDateText,
                tagsText: context.tagsText,
                recurrenceText: context.recurrenceText,
              };
            },
          },
          exit: assign({ currentEditingMode: null }),
          on: {
            // Forward user input events to child machine
            CANCEL: { actions: forwardTo("detailEditing") },
            SUBMIT: { actions: forwardTo("detailEditing") },
            UPDATE_COMMENT: {
              actions: [
                forwardTo("detailEditing"),
                assign({
                  commentText: ({ event }) =>
                    (event as { type: "UPDATE_COMMENT"; value: string }).value,
                }),
              ],
            },
            UPDATE_DESCRIPTION: {
              actions: [
                forwardTo("detailEditing"),
                assign({
                  descriptionText: ({ event }) =>
                    (event as { type: "UPDATE_DESCRIPTION"; value: string })
                      .value,
                }),
              ],
            },
            UPDATE_TITLE: {
              actions: [
                forwardTo("detailEditing"),
                assign({
                  titleText: ({ event }) =>
                    (event as { type: "UPDATE_TITLE"; value: string }).value,
                }),
              ],
            },
            UPDATE_DUE_DATE: {
              actions: [
                forwardTo("detailEditing"),
                assign({
                  dueDateText: ({ event }) =>
                    (event as { type: "UPDATE_DUE_DATE"; value: string }).value,
                }),
              ],
            },
            UPDATE_TAGS: {
              actions: [
                forwardTo("detailEditing"),
                assign({
                  tagsText: ({ event }) =>
                    (event as { type: "UPDATE_TAGS"; value: string }).value,
                }),
              ],
            },
            UPDATE_RECURRENCE: {
              actions: [
                forwardTo("detailEditing"),
                assign({
                  recurrenceText: ({ event }) =>
                    (event as { type: "UPDATE_RECURRENCE"; value: string })
                      .value,
                }),
              ],
            },
            UPDATE_PROJECT_NAME: {
              actions: [
                forwardTo("detailEditing"),
                assign({
                  newProjectName: ({ event }) =>
                    (event as { type: "UPDATE_PROJECT_NAME"; value: string })
                      .value,
                }),
              ],
            },
            SELECT_STATUS: { actions: forwardTo("detailEditing") },
            SELECT_PRIORITY: { actions: forwardTo("detailEditing") },
            SELECT_PROJECT: { actions: forwardTo("detailEditing") },
            SELECT_CREATE_PROJECT: { actions: forwardTo("detailEditing") },
            SELECT_FILE: { actions: forwardTo("detailEditing") },

            // Child machine completion events
            EDITING_COMPLETE: {
              target: "normal.detail",
              actions: [
                assign({
                  selectedTask: ({ event }) =>
                    (event as { type: "EDITING_COMPLETE"; task: TaskFull })
                      .task,
                }),
                "clearFormFields",
              ],
            },
            EDITING_COMPLETE_WITH_REFRESH: {
              target: "normal.detail",
              actions: [
                assign({
                  selectedTask: ({ event }) =>
                    (event as {
                      type: "EDITING_COMPLETE_WITH_REFRESH";
                      task: TaskFull;
                    }).task,
                }),
                "clearFormFields",
                raise({ type: "REFRESH" }),
              ],
            },
            EDITING_CANCELLED: {
              target: "normal.detail",
              actions: "clearFormFields",
            },
            PROJECTS_LOADED: {
              actions: assign({
                projects: ({ event }) =>
                  (event as { type: "PROJECTS_LOADED"; projects: Project[] })
                    .projects,
              }),
            },
            PROJECT_CREATED: {
              actions: assign({
                projects: ({ context, event }) => [
                  ...context.projects,
                  (event as { type: "PROJECT_CREATED"; project: Project })
                    .project,
                ],
              }),
            },
            EDITING_MODE_CHANGED: {
              actions: assign({
                currentEditingMode: ({ event }) =>
                  (event as { type: "EDITING_MODE_CHANGED"; mode: string })
                    .mode,
              }),
            },
          },
        },
      },
    },
  },
});

// Export type for the machine
export type TuiMachine = typeof tuiMachine;
