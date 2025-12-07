/**
 * Detail Editing Child Machine
 *
 * Handles all task detail editing operations:
 * - Comment addition
 * - Description editing
 * - Status/Priority/Project/DueDate changes
 * - Attachment addition
 *
 * This machine is invoked by the parent TUI machine when entering
 * detail editing mode. It communicates back via sendParent events.
 *
 * State Flow:
 * 1. routing -> routes to appropriate state based on initialMode in context
 * 2. [editing state] -> user interacts (UPDATE_*, SELECT_*)
 * 3. [submitting state] -> actor performs API call
 * 4. sendParent(EDITING_COMPLETE | EDITING_CANCELLED) -> parent transitions back
 *
 * Project Flow (special case):
 * - loadingProjects -> changingProject -> submittingProject
 * - Can also create new project: creatingNewProject -> submittingNewProject
 *
 * @see ../tui.machine.ts for parent integration
 * @see ./detail-editing.types.ts for type definitions
 */

import { assign, sendParent, setup } from "xstate";
import type { Project, TaskFull, TaskStatus } from "../../../shared/schemas.ts";
import { editingActors } from "../actors/editing.actors.ts";
import type {
  DetailEditingContext,
  DetailEditingEvent,
  DetailEditingInput,
  DetailEditingMode,
} from "./detail-editing.types.ts";

// === Machine Definition ===

export const detailEditingMachine = setup({
  types: {} as {
    context: DetailEditingContext & { initialMode: DetailEditingMode };
    events: DetailEditingEvent;
    input: DetailEditingInput;
  },
  actors: {
    addComment: editingActors.addComment,
    updateDescription: editingActors.updateDescription,
    updateTitle: editingActors.updateTitle,
    updateStatus: editingActors.updateStatus,
    updatePriority: editingActors.updatePriority,
    loadProjects: editingActors.loadProjects,
    updateProject: editingActors.updateProject,
    createProjectAndAssign: editingActors.createProjectAndAssign,
    updateDueDate: editingActors.updateDueDate,
    updateTags: editingActors.updateTags,
    updateRecurrence: editingActors.updateRecurrence,
    addAttachment: editingActors.addAttachment,
  },
  guards: {
    hasValidComment: ({ context }) => context.commentText.trim().length > 0,
    hasValidProjectName: ({ context }) =>
      context.newProjectName.trim().length > 0,
    // Mode routing guards using context
    isAddingComment: ({ context }) => context.initialMode === "addingComment",
    isEditingDescription: ({ context }) =>
      context.initialMode === "editingDescription",
    isEditingTitle: ({ context }) => context.initialMode === "editingTitle",
    isChangingStatus: ({ context }) => context.initialMode === "changingStatus",
    isChangingPriority: ({ context }) =>
      context.initialMode === "changingPriority",
    isLoadingProjects: ({ context }) =>
      context.initialMode === "loadingProjects",
    isChangingDueDate: ({ context }) =>
      context.initialMode === "changingDueDate",
    isChangingTags: ({ context }) => context.initialMode === "changingTags",
    isChangingRecurrence: ({ context }) =>
      context.initialMode === "changingRecurrence",
    isAddingAttachment: ({ context }) =>
      context.initialMode === "addingAttachment",
  },
  actions: {
    clearFormFields: assign({
      commentText: "",
      descriptionText: "",
      titleText: "",
      dueDateText: "",
      tagsText: "",
      recurrenceText: "",
      newProjectName: "",
    }),
    notifyComplete: sendParent(({ event }) => ({
      type: "EDITING_COMPLETE" as const,
      task: (event as unknown as { output: TaskFull }).output,
    })),
    notifyCompleteWithRefresh: sendParent(({ event }) => ({
      type: "EDITING_COMPLETE_WITH_REFRESH" as const,
      task: (event as unknown as { output: TaskFull }).output,
    })),
    notifyCancelled: sendParent({ type: "EDITING_CANCELLED" as const }),
    notifyProjectsLoaded: sendParent(({ event }) => ({
      type: "PROJECTS_LOADED" as const,
      projects: (event as unknown as { output: Project[] }).output,
    })),
    notifyModeChanged: sendParent((_, params: { mode: string }) => ({
      type: "EDITING_MODE_CHANGED" as const,
      mode: params.mode,
    })),
    setError: assign({
      error: (
        _,
        params: { fallback: string },
      ) => params.fallback,
    }),
  },
}).createMachine({
  id: "detailEditing",
  initial: "routing",

  context: ({ input }) => ({
    client: input.client,
    selectedTask: input.selectedTask,
    initialMode: input.initialMode,
    commentText: "",
    descriptionText: input.descriptionText ?? "",
    titleText: input.titleText ?? "",
    dueDateText: input.dueDateText ?? "",
    tagsText: input.tagsText ?? "",
    recurrenceText: input.recurrenceText ?? "",
    newProjectName: "",
    projects: [],
    error: null,
  }),

  states: {
    // === Initial Routing State ===
    // Routes to the appropriate editing state based on initialMode stored in context
    routing: {
      always: [
        { target: "addingComment", guard: "isAddingComment" },
        { target: "editingDescription", guard: "isEditingDescription" },
        { target: "editingTitle", guard: "isEditingTitle" },
        { target: "changingStatus", guard: "isChangingStatus" },
        { target: "changingPriority", guard: "isChangingPriority" },
        { target: "loadingProjects", guard: "isLoadingProjects" },
        { target: "changingDueDate", guard: "isChangingDueDate" },
        { target: "changingTags", guard: "isChangingTags" },
        { target: "changingRecurrence", guard: "isChangingRecurrence" },
        { target: "addingAttachment", guard: "isAddingAttachment" },
        // Fallback to addingComment
        { target: "addingComment" },
      ],
    },

    // === Comment Flow ===
    addingComment: {
      on: {
        CANCEL: { actions: ["clearFormFields", "notifyCancelled"] },
        UPDATE_COMMENT: {
          actions: assign({ commentText: ({ event }) => event.value }),
        },
        SUBMIT: { target: "submittingComment", guard: "hasValidComment" },
      },
    },
    submittingComment: {
      invoke: {
        id: "addComment",
        src: "addComment",
        input: ({ context }) => ({
          client: context.client,
          taskId: context.selectedTask.id,
          content: context.commentText,
        }),
        onDone: { actions: ["clearFormFields", "notifyComplete"] },
        onError: {
          target: "addingComment",
          actions: assign({
            error: ({ event }) =>
              event.error instanceof Error
                ? event.error.message
                : "Failed to add comment",
          }),
        },
      },
    },

    // === Description Flow ===
    editingDescription: {
      on: {
        CANCEL: { actions: ["clearFormFields", "notifyCancelled"] },
        UPDATE_DESCRIPTION: {
          actions: assign({ descriptionText: ({ event }) => event.value }),
        },
        SUBMIT: "submittingDescription",
      },
    },
    submittingDescription: {
      invoke: {
        id: "updateDescription",
        src: "updateDescription",
        input: ({ context }) => ({
          client: context.client,
          taskId: context.selectedTask.id,
          description: context.descriptionText,
        }),
        onDone: { actions: ["clearFormFields", "notifyComplete"] },
        onError: {
          target: "editingDescription",
          actions: assign({
            error: ({ event }) =>
              event.error instanceof Error
                ? event.error.message
                : "Failed to update description",
          }),
        },
      },
    },

    // === Title Flow ===
    editingTitle: {
      on: {
        CANCEL: { actions: ["clearFormFields", "notifyCancelled"] },
        UPDATE_TITLE: {
          actions: assign({ titleText: ({ event }) => event.value }),
        },
        SUBMIT: {
          target: "submittingTitle",
          guard: ({ context }) => context.titleText.trim().length > 0,
        },
      },
    },
    submittingTitle: {
      invoke: {
        id: "updateTitle",
        src: "updateTitle",
        input: ({ context }) => ({
          client: context.client,
          taskId: context.selectedTask.id,
          title: context.titleText.trim(),
        }),
        onDone: { actions: ["clearFormFields", "notifyCompleteWithRefresh"] },
        onError: {
          target: "editingTitle",
          actions: assign({
            error: ({ event }) =>
              event.error instanceof Error
                ? event.error.message
                : "Failed to update title",
          }),
        },
      },
    },

    // === Status Flow ===
    changingStatus: {
      on: {
        CANCEL: { actions: "notifyCancelled" },
        SELECT_STATUS: "submittingStatus",
      },
    },
    submittingStatus: {
      invoke: {
        id: "updateStatus",
        src: "updateStatus",
        input: ({ context, event }) => ({
          client: context.client,
          taskId: context.selectedTask.id,
          status: (event as { type: "SELECT_STATUS"; value: TaskStatus }).value,
        }),
        onDone: { actions: ["clearFormFields", "notifyCompleteWithRefresh"] },
        onError: {
          target: "changingStatus",
          actions: assign({
            error: ({ event }) =>
              event.error instanceof Error
                ? event.error.message
                : "Failed to update status",
          }),
        },
      },
    },

    // === Priority Flow ===
    changingPriority: {
      on: {
        CANCEL: { actions: "notifyCancelled" },
        SELECT_PRIORITY: "submittingPriority",
      },
    },
    submittingPriority: {
      invoke: {
        id: "updatePriority",
        src: "updatePriority",
        input: ({ context, event }) => ({
          client: context.client,
          taskId: context.selectedTask.id,
          priority: (event as { type: "SELECT_PRIORITY"; value: number }).value,
        }),
        onDone: { actions: ["clearFormFields", "notifyComplete"] },
        onError: {
          target: "changingPriority",
          actions: assign({
            error: ({ event }) =>
              event.error instanceof Error
                ? event.error.message
                : "Failed to update priority",
          }),
        },
      },
    },

    // === Project Flow ===
    loadingProjects: {
      invoke: {
        id: "loadProjects",
        src: "loadProjects",
        input: ({ context }) => ({ client: context.client }),
        onDone: {
          target: "changingProject",
          actions: [
            assign({ projects: ({ event }) => event.output }),
            "notifyProjectsLoaded",
          ],
        },
        onError: {
          actions: [
            assign({
              error: ({ event }) =>
                event.error instanceof Error
                  ? event.error.message
                  : "Failed to load projects",
            }),
            "notifyCancelled",
          ],
        },
      },
    },
    changingProject: {
      on: {
        CANCEL: { actions: "notifyCancelled" },
        SELECT_PROJECT: "submittingProject",
        SELECT_CREATE_PROJECT: "creatingNewProject",
      },
    },
    submittingProject: {
      invoke: {
        id: "updateProject",
        src: "updateProject",
        input: ({ context, event }) => ({
          client: context.client,
          taskId: context.selectedTask.id,
          projectId: (event as { type: "SELECT_PROJECT"; value: number | null })
            .value,
        }),
        onDone: { actions: ["clearFormFields", "notifyCompleteWithRefresh"] },
        onError: {
          target: "changingProject",
          actions: assign({
            error: ({ event }) =>
              event.error instanceof Error
                ? event.error.message
                : "Failed to update project",
          }),
        },
      },
    },
    creatingNewProject: {
      entry: {
        type: "notifyModeChanged",
        params: { mode: "creatingNewProject" },
      },
      on: {
        CANCEL: {
          target: "changingProject",
          actions: [
            assign({ newProjectName: "" }),
            {
              type: "notifyModeChanged",
              params: { mode: "changingProject" },
            },
          ],
        },
        UPDATE_PROJECT_NAME: {
          actions: assign({ newProjectName: ({ event }) => event.value }),
        },
        SUBMIT: {
          target: "submittingNewProject",
          guard: "hasValidProjectName",
        },
      },
    },
    submittingNewProject: {
      invoke: {
        id: "createProjectAndAssign",
        src: "createProjectAndAssign",
        input: ({ context }) => ({
          client: context.client,
          name: context.newProjectName,
          taskId: context.selectedTask.id,
        }),
        onDone: {
          actions: [
            assign({
              projects: ({ context, event }) => [
                ...context.projects,
                event.output.project,
              ],
            }),
            "clearFormFields",
            sendParent(({ event }) => ({
              type: "EDITING_COMPLETE_WITH_REFRESH" as const,
              task: event.output.task,
            })),
            sendParent(({ event }) => ({
              type: "PROJECT_CREATED" as const,
              project: event.output.project,
            })),
          ],
        },
        onError: {
          target: "creatingNewProject",
          actions: assign({
            error: ({ event }) =>
              event.error instanceof Error
                ? event.error.message
                : "Failed to create project",
          }),
        },
      },
    },

    // === Due Date Flow ===
    changingDueDate: {
      on: {
        CANCEL: { actions: ["clearFormFields", "notifyCancelled"] },
        UPDATE_DUE_DATE: {
          actions: assign({ dueDateText: ({ event }) => event.value }),
        },
        SUBMIT: "submittingDueDate",
      },
    },
    submittingDueDate: {
      invoke: {
        id: "updateDueDate",
        src: "updateDueDate",
        input: ({ context }) => ({
          client: context.client,
          taskId: context.selectedTask.id,
          dueDate: context.dueDateText,
        }),
        onDone: { actions: ["clearFormFields", "notifyComplete"] },
        onError: {
          target: "changingDueDate",
          actions: assign({
            error: ({ event }) =>
              event.error instanceof Error
                ? event.error.message
                : "Failed to update due date",
          }),
        },
      },
    },

    // === Tags Flow ===
    changingTags: {
      on: {
        CANCEL: { actions: ["clearFormFields", "notifyCancelled"] },
        UPDATE_TAGS: {
          actions: assign({ tagsText: ({ event }) => event.value }),
        },
        SUBMIT: "submittingTags",
      },
    },
    submittingTags: {
      invoke: {
        id: "updateTags",
        src: "updateTags",
        input: ({ context }) => ({
          client: context.client,
          taskId: context.selectedTask.id,
          tags: context.tagsText
            .split(/[,\s]+/)
            .map((t) => t.replace(/^#/, "").trim())
            .filter((t) => t.length > 0),
        }),
        onDone: { actions: ["clearFormFields", "notifyComplete"] },
        onError: {
          target: "changingTags",
          actions: assign({
            error: ({ event }) =>
              event.error instanceof Error
                ? event.error.message
                : "Failed to update tags",
          }),
        },
      },
    },

    // === Recurrence Flow ===
    changingRecurrence: {
      on: {
        CANCEL: { actions: ["clearFormFields", "notifyCancelled"] },
        UPDATE_RECURRENCE: {
          actions: assign({ recurrenceText: ({ event }) => event.value }),
        },
        SUBMIT: "submittingRecurrence",
      },
    },
    submittingRecurrence: {
      invoke: {
        id: "updateRecurrence",
        src: "updateRecurrence",
        input: ({ context }) => ({
          client: context.client,
          taskId: context.selectedTask.id,
          recurrence: context.recurrenceText,
        }),
        onDone: { actions: ["clearFormFields", "notifyComplete"] },
        onError: {
          target: "changingRecurrence",
          actions: assign({
            error: ({ event }) =>
              event.error instanceof Error
                ? event.error.message
                : "Failed to update recurrence",
          }),
        },
      },
    },

    // === Attachment Flow ===
    addingAttachment: {
      on: {
        CANCEL: { actions: "notifyCancelled" },
        SELECT_FILE: "submittingAttachment",
      },
    },
    submittingAttachment: {
      invoke: {
        id: "addAttachment",
        src: "addAttachment",
        input: ({ context, event }) => ({
          client: context.client,
          taskId: context.selectedTask.id,
          filepath: (event as { type: "SELECT_FILE"; filepath: string })
            .filepath,
        }),
        onDone: { actions: ["clearFormFields", "notifyComplete"] },
        onError: {
          target: "addingAttachment",
          actions: assign({
            error: ({ event }) =>
              event.error instanceof Error
                ? event.error.message
                : "Failed to add attachment",
          }),
        },
      },
    },
  },
});

// Export type for the machine
export type DetailEditingMachine = typeof detailEditingMachine;
