import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { getDb } from "../../db/client.ts";
import { ReportQuery } from "../../shared/schemas.ts";
import {
  formatPeriodLabel,
  getReportPeriodRange,
} from "../../shared/date-parser.ts";
import { MAX_REPORT_TASKS_PER_SECTION } from "../../shared/limits.ts";

export const reportsRoute = new Hono();

// Get activity report for a time period
reportsRoute.get(
  "/",
  zValidator("query", ReportQuery),
  async (c) => {
    const { period, from, to, project } = c.req.valid("query");
    const db = await getDb();

    // Resolve date range
    let fromDate: string;
    let toDate: string;
    let label: string;

    if (from && to) {
      // Custom date range
      fromDate = from;
      toDate = to;
      label = formatPeriodLabel(from, to);
    } else if (from) {
      // From date only, default to today
      fromDate = from;
      toDate = new Date().toISOString().split("T")[0];
      label = formatPeriodLabel(from, toDate);
    } else if (period) {
      const range = getReportPeriodRange(period);
      fromDate = range.from;
      toDate = range.to;
      label = range.label;
    } else {
      // Default to current week
      const range = getReportPeriodRange("week");
      fromDate = range.from;
      toDate = range.to;
      label = range.label;
    }

    // Build project filter
    const projectFilter = project ? " AND p.name = ?" : "";
    const projectArg = project ? [project] : [];

    // Query completed tasks (status=done AND completed_at in range)
    const completedResult = await db.execute({
      sql: `
        SELECT t.id, t.title, t.description, t.status, t.priority, t.due_date,
               t.project_id, t.parent_id, t.\`order\`, t.created_at, t.updated_at,
               t.completed_at, p.name as project_name, pt.title as parent_title
        FROM tasks t
        LEFT JOIN projects p ON t.project_id = p.id
        LEFT JOIN tasks pt ON t.parent_id = pt.id
        WHERE t.status = 'done'
          AND t.completed_at >= ?
          AND t.completed_at < date(?, '+1 day')
          ${projectFilter}
        ORDER BY t.completed_at DESC
        LIMIT ?
      `,
      args: [fromDate, toDate, ...projectArg, MAX_REPORT_TASKS_PER_SECTION],
    });

    // Query in-progress tasks (updated_at in range, showing work activity)
    const inProgressResult = await db.execute({
      sql: `
        SELECT t.id, t.title, t.description, t.status, t.priority, t.due_date,
               t.project_id, t.parent_id, t.\`order\`, t.created_at, t.updated_at,
               t.completed_at, p.name as project_name, pt.title as parent_title
        FROM tasks t
        LEFT JOIN projects p ON t.project_id = p.id
        LEFT JOIN tasks pt ON t.parent_id = pt.id
        WHERE t.status = 'in-progress'
          AND t.updated_at >= ?
          AND t.updated_at < date(?, '+1 day')
          ${projectFilter}
        ORDER BY t.updated_at DESC
        LIMIT ?
      `,
      args: [fromDate, toDate, ...projectArg, MAX_REPORT_TASKS_PER_SECTION],
    });

    // Query added tasks (created_at in range)
    const addedResult = await db.execute({
      sql: `
        SELECT t.id, t.title, t.description, t.status, t.priority, t.due_date,
               t.project_id, t.parent_id, t.\`order\`, t.created_at, t.updated_at,
               t.completed_at, p.name as project_name, pt.title as parent_title
        FROM tasks t
        LEFT JOIN projects p ON t.project_id = p.id
        LEFT JOIN tasks pt ON t.parent_id = pt.id
        WHERE t.created_at >= ?
          AND t.created_at < date(?, '+1 day')
          ${projectFilter}
        ORDER BY t.created_at DESC
        LIMIT ?
      `,
      args: [fromDate, toDate, ...projectArg, MAX_REPORT_TASKS_PER_SECTION],
    });

    return c.json({
      period: {
        from: fromDate,
        to: toDate,
        label,
      },
      completed: completedResult.rows,
      in_progress: inProgressResult.rows,
      added: addedResult.rows,
      summary: {
        completed_count: completedResult.rows.length,
        in_progress_count: inProgressResult.rows.length,
        added_count: addedResult.rows.length,
      },
    });
  },
);
