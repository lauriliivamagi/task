/**
 * Task Get Route
 *
 * GET /tasks/:id - Get single task with full details
 */

import { Hono } from "hono";
import { getDb } from "../../../db/client.ts";
import { parseTaskJsonFields } from "./helpers.ts";

export const getRoute = new Hono();

getRoute.get("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const db = await getDb();

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

  const task = parseTaskJsonFields(taskResult.rows[0]);

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

  const fullTask = {
    ...task,
    subtasks: subtasksResult.rows,
    comments: commentsResult.rows,
    attachments: attachmentsResult.rows,
    tags: tagsResult.rows,
  };

  return c.json(fullTask);
});
