/**
 * Action Factories for TUI State Machine
 *
 * Reusable action creators to eliminate repetitive patterns.
 * Note: These are reference implementations showing the pattern.
 * In practice, inline assign() is often clearer in XState v5.
 */

// === Error Handler Factory ===

/**
 * Creates a standardized error handler for invoke onError.
 * Eliminates the repetitive pattern of extracting error messages.
 *
 * Usage in machine:
 * onError: {
 *   target: "someState",
 *   actions: assign({
 *     error: ({ event }) =>
 *       event.error instanceof Error ? event.error.message : "Fallback message",
 *   }),
 * }
 */
export function createErrorMessage(
  event: { error: unknown },
  fallbackMessage: string,
): string {
  return event.error instanceof Error ? event.error.message : fallbackMessage;
}

/**
 * Pre-built error messages for common operations.
 */
export const errorMessages = {
  loadTasks: "Failed to load tasks",
  loadTaskDetail: "Failed to load task details",
  createTask: "Failed to create task",
  addComment: "Failed to add comment",
  updateDescription: "Failed to update description",
  updateStatus: "Failed to update status",
  updatePriority: "Failed to update priority",
  updateProject: "Failed to update project",
  createProject: "Failed to create project",
  loadProjects: "Failed to load projects",
  updateDueDate: "Failed to update due date",
  addAttachment: "Failed to add attachment",
  toggleStatus: "Failed to toggle status",
};
