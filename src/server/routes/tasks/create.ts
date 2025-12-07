/**
 * Task Create Routes
 *
 * POST /tasks - Create single task
 * POST /tasks/batch - Create multiple tasks with subtasks
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { getDb } from "../../../db/client.ts";
import {
  BatchCreateInput,
  CreatedTask,
  CreateTaskInput,
} from "../../../shared/schemas.ts";
import { getEmbeddingService } from "../../../embeddings/service.ts";
import { resolveDueDate } from "../../../shared/date-parser.ts";
import {
  getNextOrder,
  parseTaskJsonFields,
  resolveOrCreateProject,
  serializeJson,
} from "./helpers.ts";

export const createRoute = new Hono();

// Create single task
createRoute.post(
  "/",
  zValidator("json", CreateTaskInput),
  async (c) => {
    const input = c.req.valid("json");
    const db = await getDb();

    // Validate that subtasks cannot have recurrence
    if (input.parent_id && input.recurrence) {
      return c.json(
        {
          error:
            "Subtasks cannot have recurrence. Only top-level tasks can be recurring.",
        },
        400,
      );
    }

    let projectId: number | null = null;
    if (input.project) {
      projectId = await resolveOrCreateProject(db, input.project);
    }

    // Resolve due date from ISO or natural language
    const dueDate = resolveDueDate(input.due_date, input.due_date_natural);

    // Serialize context and recurrence to JSON
    const contextJson = serializeJson(input.context);
    const recurrenceJson = serializeJson(input.recurrence);

    // Calculate next order value
    const nextOrder = await getNextOrder(db, input.parent_id);

    const result = await db.execute({
      sql:
        `INSERT INTO tasks (title, description, project_id, parent_id, due_date, context, \`order\`, recurrence, duration_hours)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING id, project_id, parent_id, title, description, status, priority, due_date, \`order\`, context, recurrence, duration_hours, created_at, updated_at`,
      args: [
        input.title,
        input.description || null,
        projectId,
        input.parent_id || null,
        dueDate,
        contextJson,
        nextOrder,
        recurrenceJson,
        input.duration_hours ?? null,
      ],
    });

    const task = parseTaskJsonFields(result.rows[0]);

    // Handle tags if provided
    const tagNames: string[] = [];
    if (input.tags && input.tags.length > 0) {
      for (const tagName of input.tags) {
        const trimmedName = tagName.trim();
        if (!trimmedName) continue;

        // Get or create tag
        await db.execute({
          sql: "INSERT OR IGNORE INTO tags (name) VALUES (?)",
          args: [trimmedName],
        });
        const tagResult = await db.execute({
          sql: "SELECT id FROM tags WHERE name = ?",
          args: [trimmedName],
        });

        if (tagResult.rows[0]) {
          await db.execute({
            sql:
              "INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?, ?)",
            args: [task.id, tagResult.rows[0].id],
          });
          tagNames.push(trimmedName);
        }
      }
    }

    // Fire-and-forget embedding generation (including tags)
    const embeddingService = getEmbeddingService();
    embeddingService
      .embedTask(
        task.id as number,
        input.title,
        input.description,
        tagNames.length > 0 ? tagNames : undefined,
      )
      .catch((err) => console.error("Failed to embed new task:", err));

    return c.json(task, 201);
  },
);

// Batch create tasks with subtasks
createRoute.post(
  "/batch",
  zValidator("json", BatchCreateInput),
  async (c) => {
    const { tasks } = c.req.valid("json");
    const db = await getDb();
    const embeddingService = getEmbeddingService();

    const created: CreatedTask[] = [];
    let totalCount = 0;

    // Process each task in the batch
    for (const taskInput of tasks) {
      // Resolve or create project if specified
      let projectId: number | null = null;
      if (taskInput.project) {
        projectId = await resolveOrCreateProject(db, taskInput.project);
      }

      // Resolve due date from ISO or natural language
      const taskDueDate = resolveDueDate(
        taskInput.due_date,
        taskInput.due_date_natural,
      );

      // Serialize context to JSON
      const taskContextJson = serializeJson(taskInput.context);

      // Calculate next order value for parent task
      const parentNextOrder = await getNextOrder(db, taskInput.parent_id);

      // Create the parent task
      const taskResult = await db.execute({
        sql:
          `INSERT INTO tasks (title, description, project_id, parent_id, due_date, priority, context, \`order\`)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              RETURNING id, title`,
        args: [
          taskInput.title,
          taskInput.description || null,
          projectId,
          taskInput.parent_id || null,
          taskDueDate,
          taskInput.priority ?? 0,
          taskContextJson,
          parentNextOrder,
        ],
      });

      const parentTask = taskResult.rows[0];
      const parentId = parentTask.id as number;
      totalCount++;

      // Fire-and-forget embedding for parent task
      embeddingService
        .embedTask(parentId, taskInput.title, taskInput.description)
        .catch((err) => console.error("Failed to embed task:", err));

      const createdTask: CreatedTask = {
        id: parentId,
        title: parentTask.title as string,
        parent_id: taskInput.parent_id ?? null,
        subtasks: [],
      };

      // Create subtasks if any
      if (taskInput.subtasks && taskInput.subtasks.length > 0) {
        let subtaskOrder = 0;
        for (const subtaskInput of taskInput.subtasks) {
          // Resolve subtask due date
          const subtaskDueDate = resolveDueDate(
            subtaskInput.due_date,
            subtaskInput.due_date_natural,
          );

          // Serialize subtask context to JSON
          const subtaskContextJson = serializeJson(subtaskInput.context);

          const subtaskResult = await db.execute({
            sql:
              `INSERT INTO tasks (title, description, project_id, parent_id, due_date, priority, context, \`order\`)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                  RETURNING id, title`,
            args: [
              subtaskInput.title,
              subtaskInput.description || null,
              projectId, // Inherit project from parent
              parentId,
              subtaskDueDate,
              subtaskInput.priority ?? 0,
              subtaskContextJson,
              subtaskOrder++,
            ],
          });

          const subtask = subtaskResult.rows[0];
          const subtaskId = subtask.id as number;
          totalCount++;

          // Fire-and-forget embedding for subtask
          embeddingService
            .embedTask(subtaskId, subtaskInput.title, subtaskInput.description)
            .catch((err) => console.error("Failed to embed subtask:", err));

          createdTask.subtasks?.push({
            id: subtaskId,
            title: subtask.title as string,
          });
        }
      }

      created.push(createdTask);
    }

    return c.json({ created, count: totalCount }, 201);
  },
);
