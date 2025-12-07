/**
 * Editing Actors for TUI State Machine
 *
 * Promise-based actors for mutation operations (create, update).
 */

import { fromPromise } from "xstate";
import type { Project, TaskFull } from "../../../shared/schemas.ts";
import type {
  AddAttachmentInput,
  AddCommentInput,
  CreateProjectAndAssignInput,
  CreateTaskInput,
  LoadProjectsInput,
  UpdateDescriptionInput,
  UpdateDueDateInput,
  UpdatePriorityInput,
  UpdateProjectInput,
  UpdateStatusInput,
  UpdateTitleInput,
} from "../tui.types.ts";
import type {
  UpdateRecurrenceInput,
  UpdateTagsInput,
} from "../child-machines/detail-editing.types.ts";
import { parseRecurrence } from "../../../shared/recurrence-parser.ts";
import { resolveDueDate } from "../../../shared/date-parser.ts";

export const createTaskActor = fromPromise<{ id: number }, CreateTaskInput>(
  async ({ input }) => {
    const task = await input.client.createTask({
      title: input.title,
      parent_id: input.parentId ?? undefined,
    });
    return { id: (task as { id: number }).id };
  },
);

export const addCommentActor = fromPromise<TaskFull, AddCommentInput>(
  async ({ input }) => {
    await input.client.addComment(input.taskId, { content: input.content });
    return input.client.getTask(input.taskId);
  },
);

export const updateDescriptionActor = fromPromise<
  TaskFull,
  UpdateDescriptionInput
>(
  async ({ input }) => {
    await input.client.updateTask(input.taskId, {
      description: input.description,
    });
    return input.client.getTask(input.taskId);
  },
);

export const updateStatusActor = fromPromise<TaskFull, UpdateStatusInput>(
  async ({ input }) => {
    await input.client.updateTask(input.taskId, { status: input.status });
    return input.client.getTask(input.taskId);
  },
);

export const updatePriorityActor = fromPromise<TaskFull, UpdatePriorityInput>(
  async ({ input }) => {
    await input.client.updateTask(input.taskId, { priority: input.priority });
    return input.client.getTask(input.taskId);
  },
);

export const updateProjectActor = fromPromise<TaskFull, UpdateProjectInput>(
  async ({ input }) => {
    await input.client.updateTask(input.taskId, {
      project_id: input.projectId,
    });
    return input.client.getTask(input.taskId);
  },
);

export const updateDueDateActor = fromPromise<TaskFull, UpdateDueDateInput>(
  async ({ input }) => {
    const dueDateText = input.dueDate.trim();

    // Empty text clears due date
    if (dueDateText === "") {
      await input.client.updateTask(input.taskId, { due_date: null });
      return input.client.getTask(input.taskId);
    }

    // Check if input looks like ISO date format (starts with YYYY-MM-DD)
    const isIsoFormat = /^\d{4}-\d{2}-\d{2}/.test(dueDateText);

    // Pass to appropriate parameter: ISO format or natural language
    const parsedDate = isIsoFormat
      ? resolveDueDate(dueDateText, undefined)
      : resolveDueDate(undefined, dueDateText);

    if (!parsedDate) {
      throw new Error(
        `Invalid date: "${dueDateText}". Try "2024-12-31", "2024-12-31 14:00", or "tomorrow at 14:00".`,
      );
    }

    await input.client.updateTask(input.taskId, { due_date: parsedDate });
    return input.client.getTask(input.taskId);
  },
);

export const addAttachmentActor = fromPromise<TaskFull, AddAttachmentInput>(
  async ({ input }) => {
    await input.client.addAttachment(input.taskId, input.filepath);
    return input.client.getTask(input.taskId);
  },
);

export const loadProjectsActor = fromPromise<Project[], LoadProjectsInput>(
  ({ input }) => input.client.listProjects(),
);

export const createProjectAndAssignActor = fromPromise<
  { task: TaskFull; project: Project },
  CreateProjectAndAssignInput
>(
  async ({ input }) => {
    // 1. Create the project
    const project = await input.client.createProject({ name: input.name });
    // 2. Assign the project to the task
    await input.client.updateTask(input.taskId, { project_id: project.id });
    // 3. Return refreshed task and new project
    const task = await input.client.getTask(input.taskId);
    return { task, project };
  },
);

export const updateTagsActor = fromPromise<TaskFull, UpdateTagsInput>(
  async ({ input }) => {
    await input.client.setTagsForTask(input.taskId, input.tags);
    return input.client.getTask(input.taskId);
  },
);

export const updateTitleActor = fromPromise<TaskFull, UpdateTitleInput>(
  async ({ input }) => {
    await input.client.updateTask(input.taskId, { title: input.title });
    return input.client.getTask(input.taskId);
  },
);

export const updateRecurrenceActor = fromPromise<
  TaskFull,
  UpdateRecurrenceInput
>(
  async ({ input }) => {
    const recurrenceText = input.recurrence.trim();

    // Empty text clears recurrence
    if (recurrenceText === "") {
      await input.client.updateTask(input.taskId, { recurrence: null });
      return input.client.getTask(input.taskId);
    }

    // Parse the natural language recurrence
    const parsedRecurrence = parseRecurrence(recurrenceText);
    if (!parsedRecurrence) {
      throw new Error(
        `Invalid recurrence: "${recurrenceText}". Try "every day", "every Monday", "monthly", etc.`,
      );
    }

    await input.client.updateTask(input.taskId, {
      recurrence: parsedRecurrence,
    });
    return input.client.getTask(input.taskId);
  },
);

/** Editing actors for machine setup */
export const editingActors = {
  createTask: createTaskActor,
  addComment: addCommentActor,
  updateDescription: updateDescriptionActor,
  updateStatus: updateStatusActor,
  updatePriority: updatePriorityActor,
  updateProject: updateProjectActor,
  updateDueDate: updateDueDateActor,
  updateTags: updateTagsActor,
  updateTitle: updateTitleActor,
  updateRecurrence: updateRecurrenceActor,
  addAttachment: addAttachmentActor,
  loadProjects: loadProjectsActor,
  createProjectAndAssign: createProjectAndAssignActor,
};
