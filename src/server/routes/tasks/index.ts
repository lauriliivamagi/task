/**
 * Tasks Route
 *
 * Combines all task-related routes into a single router.
 * Routes are organized by operation type for maintainability.
 */

import { Hono } from "hono";
import { listRoute } from "./list.ts";
import { getRoute } from "./get.ts";
import { createRoute } from "./create.ts";
import { updateRoute } from "./update.ts";
import { deleteRoute } from "./delete.ts";
import { reorderRoute } from "./reorder.ts";
import { subtasksRoute } from "./subtasks.ts";
import { workspaceRoute } from "./workspace.ts";

export const tasksRoute = new Hono();

// Mount all routes
// Order matters: more specific routes (bulk, batch) must come before parameterized routes (/:id)

// List tasks - GET /tasks
tasksRoute.route("/", listRoute);

// Create task - POST /tasks, POST /tasks/batch
tasksRoute.route("/", createRoute);

// Bulk operations - must come before /:id routes
// PATCH /tasks/bulk
// DELETE /tasks/bulk
tasksRoute.route("/", updateRoute);
tasksRoute.route("/", deleteRoute);

// Single task operations
// GET /tasks/:id
tasksRoute.route("/", getRoute);

// Task actions
// POST /tasks/:id/reorder
// POST /tasks/:id/complete-subtasks
// POST /tasks/:id/workspace
tasksRoute.route("/", reorderRoute);
tasksRoute.route("/", subtasksRoute);
tasksRoute.route("/", workspaceRoute);
