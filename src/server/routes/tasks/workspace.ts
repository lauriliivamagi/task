/**
 * Task Workspace Route
 *
 * POST /tasks/:id/workspace - Create workspace for task
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { getDb } from "../../../db/client.ts";
import { CreateWorkspaceInput } from "../../../shared/schemas.ts";
import {
  createWorkspace,
  getWorkspaceFromContext,
} from "../../../shared/workspace.ts";
import { getConfig } from "../../../shared/config.ts";
import { parseTaskJsonFields } from "./helpers.ts";

export const workspaceRoute = new Hono();

workspaceRoute.post(
  "/:id/workspace",
  zValidator("json", CreateWorkspaceInput),
  async (c) => {
    const id = Number(c.req.param("id"));
    const input = c.req.valid("json");
    const db = await getDb();

    // Get the task with full details
    const taskResult = await db.execute({
      sql: `
        SELECT t.*, p.name as project_name, pt.title as parent_title
        FROM tasks t
        LEFT JOIN projects p ON t.project_id = p.id
        LEFT JOIN tasks pt ON t.parent_id = pt.id
        WHERE t.id = ?
      `,
      args: [id],
    });

    if (taskResult.rows.length === 0) {
      return c.json({ error: `Task #${id} not found` }, 404);
    }

    const taskRow = parseTaskJsonFields(taskResult.rows[0]);

    // Parse context JSON if present
    let context: Record<string, unknown> = {};
    if (taskRow.context && typeof taskRow.context === "object") {
      context = taskRow.context as Record<string, unknown>;
    }

    // Check if workspace already exists (and folder actually exists on disk)
    const existingWorkspace = getWorkspaceFromContext(context);
    if (existingWorkspace) {
      try {
        const stat = await Deno.stat(existingWorkspace);
        if (stat.isDirectory) {
          // Open existing workspace if requested
          if (!input.noOpen) {
            const config = await getConfig();
            try {
              const command = new Deno.Command(config.work.ide_command, {
                args: [...config.work.ide_args, existingWorkspace],
                stdout: "null",
                stderr: "null",
              });
              command.spawn();
            } catch {
              // IDE open failure is not critical
            }
          }
          // Mark task as in-progress
          await db.execute({
            sql:
              "UPDATE tasks SET status = 'in-progress', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'todo'",
            args: [id],
          });
          return c.json({
            path: existingWorkspace,
            name: existingWorkspace.split("/").pop() || "",
            opened: !input.noOpen,
            existed: true,
          });
        }
      } catch {
        // Folder doesn't exist, clear stale workspace from context
        delete context.workspace;
      }
    }

    // Get subtasks, comments, attachments, tags for full task
    const subtasksResult = await db.execute({
      sql: "SELECT id, title, status FROM tasks WHERE parent_id = ?",
      args: [id],
    });

    const commentsResult = await db.execute({
      sql:
        "SELECT id, content, created_at FROM comments WHERE task_id = ? ORDER BY created_at ASC",
      args: [id],
    });

    const attachmentsResult = await db.execute({
      sql:
        "SELECT id, filename, path, created_at FROM attachments WHERE task_id = ? ORDER BY created_at ASC",
      args: [id],
    });

    const tagsResult = await db.execute({
      sql: `
        SELECT tg.id, tg.name
        FROM tags tg
        JOIN task_tags tt ON tg.id = tt.tag_id
        WHERE tt.task_id = ?
        ORDER BY tg.name ASC
      `,
      args: [id],
    });

    const task = {
      ...taskRow,
      context,
      subtasks: subtasksResult.rows,
      comments: commentsResult.rows,
      attachments: attachmentsResult.rows,
      tags: tagsResult.rows,
    };

    // Get config
    const config = await getConfig();

    // Create workspace
    const result = await createWorkspace({
      task: task as unknown as Parameters<typeof createWorkspace>[0]["task"],
      template: input.template,
      name: input.name,
      noOpen: input.noOpen,
      config: config.work,
    });

    // Update task context with workspace path and mark as in-progress
    const updatedContext = {
      ...context,
      workspace: result.path,
    };

    await db.execute({
      sql: `UPDATE tasks
            SET context = ?,
                status = CASE WHEN status = 'todo' THEN 'in-progress' ELSE status END,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
      args: [JSON.stringify(updatedContext), id],
    });

    return c.json({
      path: result.path,
      name: result.name,
      opened: result.opened,
      existed: false,
    }, 201);
  },
);
