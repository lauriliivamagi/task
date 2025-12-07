/**
 * Data Actors for TUI State Machine
 *
 * Promise-based actors for data fetching operations (read-only).
 */

import { fromPromise } from "xstate";
import type { TaskFull, TaskWithProject } from "../../../shared/schemas.ts";
import type {
  CreateWorkspaceInput,
  GcalSyncInput,
  LoadTaskDetailInput,
  LoadTasksInput,
  ReorderTaskInput,
  ToggleStatusInput,
  UpdateDurationInput,
} from "../tui.types.ts";
import {
  commitChanges,
  ensureGitignore,
  getGitStatus,
  isGitInitialized,
  pullChanges,
  pushChanges,
} from "../../../shared/sync.ts";

export const loadTasksActor = fromPromise<TaskWithProject[], LoadTasksInput>(
  ({ input }) =>
    input.client.listTasks({
      all: input.all ?? false,
      semantic: input.semantic,
    }),
);

export const loadTaskDetailActor = fromPromise<TaskFull, LoadTaskDetailInput>(
  ({ input }) => input.client.getTask(input.taskId),
);

/** Result type for toggle status operation */
export interface ToggleStatusResult {
  task: TaskFull;
  recurringNextTaskId: number | null;
}

export const toggleStatusActor = fromPromise<
  ToggleStatusResult,
  ToggleStatusInput
>(
  async ({ input }) => {
    const newStatus = input.task.status === "done" ? "todo" : "done";
    const updateResult = await input.client.updateTask(input.task.id, {
      status: newStatus,
    });

    // Check if a recurring task created a new instance
    const recurringNextTaskId =
      (updateResult as { recurring_next_task_id?: number })
        .recurring_next_task_id ?? null;

    // If a new recurring task was created, load that task instead
    const taskIdToLoad = recurringNextTaskId ?? input.task.id;
    const task = await input.client.getTask(taskIdToLoad);

    return { task, recurringNextTaskId };
  },
);

/** Result type for toggle progress operation */
export interface ToggleProgressResult {
  task: TaskFull;
}

/**
 * Toggle task between "todo" and "in-progress" status.
 * - If task is "todo" → change to "in-progress"
 * - If task is "in-progress" → change to "todo"
 * - Other statuses are not changed
 */
export const toggleProgressActor = fromPromise<
  ToggleProgressResult,
  ToggleStatusInput
>(
  async ({ input }) => {
    let newStatus: "todo" | "in-progress";
    if (input.task.status === "todo") {
      newStatus = "in-progress";
    } else if (input.task.status === "in-progress") {
      newStatus = "todo";
    } else {
      // Don't change status for "done" tasks
      const task = await input.client.getTask(input.task.id);
      return { task };
    }

    await input.client.updateTask(input.task.id, { status: newStatus });
    const task = await input.client.getTask(input.task.id);
    return { task };
  },
);

export const reorderTaskActor = fromPromise<
  { swapped: boolean; taskId: number },
  ReorderTaskInput
>(async ({ input }) => {
  await input.client.reorderTask(input.taskId, input.direction);
  return { swapped: true, taskId: input.taskId };
});

export const createWorkspaceActor = fromPromise<
  { path: string; existed: boolean },
  CreateWorkspaceInput
>(async ({ input }) => {
  const result = await input.client.createWorkspace(input.taskId);
  return { path: result.path, existed: result.existed ?? false };
});

/** Result type for sync operations */
export interface SyncResult {
  success: boolean;
  error?: string;
}

/** Sync pull actor - pulls changes from remote */
export const syncPullActor = fromPromise<SyncResult, void>(async () => {
  // Check if git is initialized
  if (!await isGitInitialized()) {
    return {
      success: false,
      error: "Sync not initialized. Run: task sync init",
    };
  }

  // Check if remote is configured
  const status = await getGitStatus();
  if (!status.hasRemote) {
    return {
      success: false,
      error: "No remote configured. Run: task sync init <url>",
    };
  }

  // Pull changes
  const result = await pullChanges();
  if (!result.success) {
    return { success: false, error: `Pull failed: ${result.stderr}` };
  }

  return { success: true };
});

/** Sync push actor - commits and pushes changes to remote */
export const syncPushActor = fromPromise<SyncResult, void>(async () => {
  // Check if git is initialized
  if (!await isGitInitialized()) {
    return {
      success: false,
      error: "Sync not initialized. Run: task sync init",
    };
  }

  // Check if remote is configured
  const status = await getGitStatus();
  if (!status.hasRemote) {
    return {
      success: false,
      error: "No remote configured. Run: task sync init <url>",
    };
  }

  // Commit changes if dirty
  if (status.isDirty) {
    await ensureGitignore();
    await commitChanges();
  }

  // Push changes
  const result = await pushChanges();
  if (!result.success && !result.stderr.includes("Everything up-to-date")) {
    return { success: false, error: `Push failed: ${result.stderr}` };
  }

  return { success: true };
});

/** Input for switchDatabase actor */
export interface SwitchDatabaseInput {
  name: string;
}

/** Switch to a different database */
export const switchDatabaseActor = fromPromise<boolean, SwitchDatabaseInput>(
  async ({ input }) => {
    const { setActiveDb } = await import("../../../shared/config.ts");
    const { resetDbClient } = await import("../../../db/client.ts");

    // Update the active database in config
    await setActiveDb(input.name);

    // Reset the database client so it picks up the new database
    // Note: Migrations are run on ALL databases at server startup,
    // so we don't need to run them here when switching.
    resetDbClient();

    return true;
  },
);

/** Result type for gcal sync */
export interface GcalSyncResult {
  success: boolean;
  eventId?: string;
  eventUrl?: string;
  error?: string;
}

/** Google Calendar sync actor - syncs selected task to calendar */
export const gcalSyncActor = fromPromise<GcalSyncResult, GcalSyncInput>(
  async ({ input }) => {
    try {
      // Check auth status first
      const status = await input.client.getGcalStatus();
      if (!status.authenticated) {
        return {
          success: false,
          error: "Not authenticated. Run 'task gcal auth' first.",
        };
      }

      // Sync the task with specified duration
      const result = await input.client.syncToCalendar(input.taskId, {
        durationHours: input.durationHours,
      });

      if (result.success) {
        return {
          success: true,
          eventId: result.eventId,
          eventUrl: result.eventUrl,
        };
      } else {
        return {
          success: false,
          error: result.error ?? "Sync failed",
        };
      }
    } catch (error) {
      return {
        success: false,
        error: String(error),
      };
    }
  },
);

/** Result type for update duration */
export interface UpdateDurationResult {
  duration_hours: number | null;
}

/** Update task duration actor */
export const updateDurationActor = fromPromise<
  UpdateDurationResult,
  UpdateDurationInput
>(
  async ({ input }) => {
    await input.client.updateTask(input.taskId, {
      duration_hours: input.durationHours,
    });
    return { duration_hours: input.durationHours };
  },
);

/** Data actors for machine setup */
export const dataActors = {
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
};
