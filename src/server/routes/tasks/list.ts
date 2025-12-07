/**
 * Task List Route
 *
 * GET /tasks - List tasks with filtering and semantic search
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { getDb } from "../../../db/client.ts";
import { ListTasksQuery } from "../../../shared/schemas.ts";
import { getEmbeddingService } from "../../../embeddings/service.ts";
import { parseTasksJsonFields } from "./helpers.ts";

export const listRoute = new Hono();

listRoute.get(
  "/",
  zValidator("query", ListTasksQuery),
  async (c) => {
    const {
      all,
      project,
      q,
      due_before,
      due_after,
      overdue,
      priority,
      status,
      tag,
      semantic,
      limit,
    } = c.req.valid("query");
    const db = await getDb();

    // Handle semantic search separately
    if (semantic) {
      const embeddingService = getEmbeddingService();
      const isAvailable = await embeddingService.isAvailable();

      if (!isAvailable) {
        return c.json(
          {
            error:
              "Embedding service not configured. Set EMBEDDING_PROVIDER and required API keys.",
          },
          503,
        );
      }

      try {
        const taskIds = await embeddingService.searchSimilar(semantic, limit);

        if (taskIds.length === 0) {
          return c.json([]);
        }

        // Fetch full task details for the matched IDs, preserving order
        const placeholders = taskIds.map(() => "?").join(", ");
        const result = await db.execute({
          sql: `
            SELECT t.id, t.title, t.description, t.status, t.priority, t.due_date,
                   t.project_id, t.parent_id, t.\`order\`, t.created_at, t.updated_at,
                   t.completed_at, t.recurrence, t.gcal_event_id, t.gcal_event_url,
                   t.duration_hours, p.name as project_name, pt.title as parent_title
            FROM tasks t
            LEFT JOIN projects p ON t.project_id = p.id
            LEFT JOIN tasks pt ON t.parent_id = pt.id
            WHERE t.id IN (${placeholders})
          `,
          args: taskIds,
        });

        const parsedRows = parseTasksJsonFields(result.rows);

        // Preserve semantic ordering from vector search
        const taskMap = new Map(parsedRows.map((row) => [row.id, row]));
        const orderedTasks = taskIds
          .map((id) => taskMap.get(id))
          .filter((t) => t !== undefined);

        return c.json(orderedTasks);
      } catch (error) {
        console.error("Semantic search failed:", error);
        return c.json({ error: "Semantic search failed" }, 500);
      }
    }

    let sql = `
      SELECT t.id, t.title, t.description, t.status, t.priority, t.due_date,
             t.project_id, t.parent_id, t.\`order\`, t.created_at, t.updated_at,
             t.completed_at, t.recurrence, t.gcal_event_id, t.gcal_event_url,
             t.duration_hours, p.name as project_name, pt.title as parent_title
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN tasks pt ON t.parent_id = pt.id
      WHERE 1=1
    `;
    const args: (string | number | null)[] = [];

    // Text search (case-insensitive)
    if (q) {
      sql +=
        " AND (LOWER(t.title) LIKE LOWER(?) OR LOWER(t.description) LIKE LOWER(?))";
      args.push(`%${q}%`, `%${q}%`);
    }

    // Date filters
    if (due_before) {
      sql += " AND t.due_date < ?";
      args.push(due_before);
    }
    if (due_after) {
      sql += " AND t.due_date > ?";
      args.push(due_after);
    }
    if (overdue) {
      sql += " AND t.due_date < datetime('now') AND t.status != 'done'";
    }

    // Status filter takes precedence over 'all'
    if (status) {
      sql += " AND t.status = ?";
      args.push(status);
    } else if (!all) {
      sql += " AND t.status != 'done'";
    }

    // Priority filter
    if (priority !== undefined) {
      sql += " AND t.priority = ?";
      args.push(priority);
    }

    // Project filter
    if (project) {
      sql += " AND p.name = ?";
      args.push(project);
    }

    // Tag filter
    if (tag) {
      sql += ` AND EXISTS (
        SELECT 1 FROM task_tags tt
        JOIN tags tg ON tt.tag_id = tg.id
        WHERE tt.task_id = t.id AND tg.name = ?
      )`;
      args.push(tag);
    }

    sql += " ORDER BY t.`order` ASC, t.created_at ASC";

    const result = await db.execute({ sql, args });
    const parsedRows = parseTasksJsonFields(result.rows);

    return c.json(parsedRows);
  },
);
