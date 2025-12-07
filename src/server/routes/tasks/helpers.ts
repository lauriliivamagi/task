/**
 * Task Route Helpers
 *
 * Shared utilities for task route handlers including:
 * - JSON field parsing for context/recurrence
 * - SQL query building
 * - Type definitions
 */

import type { Client, Row } from "@libsql/client/node";
import type {
  ParsedTaskRow,
  ParsedTaskRowWithProject,
} from "../../../db/types.ts";

/**
 * Standard SELECT clause for task queries with project/parent joins.
 */
export const TASK_SELECT_SQL = `
  SELECT t.id, t.title, t.description, t.status, t.priority, t.due_date,
         t.project_id, t.parent_id, t.\`order\`, t.created_at, t.updated_at,
         t.completed_at, t.recurrence, t.gcal_event_id, t.gcal_event_url,
         t.duration_hours, t.context, p.name as project_name, pt.title as parent_title
  FROM tasks t
  LEFT JOIN projects p ON t.project_id = p.id
  LEFT JOIN tasks pt ON t.parent_id = pt.id
`;

/**
 * Parse JSON fields (context, recurrence) from a task database row.
 *
 * These fields are stored as JSON strings in SQLite but need to be
 * returned as objects in the API response.
 *
 * @param row - Raw database row
 * @returns Row with parsed JSON fields
 */
export function parseTaskJsonFields(row: Row): ParsedTaskRow {
  const task = { ...row } as Record<string, unknown>;

  // Parse context JSON
  if (task.context && typeof task.context === "string") {
    try {
      task.context = JSON.parse(task.context as string);
    } catch {
      // Keep as null if parsing fails
      task.context = null;
    }
  }

  // Parse recurrence JSON
  if (task.recurrence && typeof task.recurrence === "string") {
    try {
      task.recurrence = JSON.parse(task.recurrence as string);
    } catch {
      // Keep as null if parsing fails
      task.recurrence = null;
    }
  }

  return task as unknown as ParsedTaskRow;
}

/**
 * Parse JSON fields for multiple task rows.
 *
 * @param rows - Array of raw database rows
 * @returns Array of rows with parsed JSON fields
 */
export function parseTasksJsonFields(rows: Row[]): ParsedTaskRowWithProject[] {
  return rows.map(parseTaskJsonFields) as ParsedTaskRowWithProject[];
}

/**
 * Build a dynamic UPDATE SQL statement from field specifications.
 *
 * @param tableName - Name of the table to update
 * @param updates - Object with field names and values to update
 * @returns Object with SQL string and args array
 */
export function buildUpdateSql(
  _tableName: string,
  updates: Record<string, unknown>,
): { clauses: string[]; args: unknown[] } {
  const clauses: string[] = [];
  const args: unknown[] = [];

  for (const [field, value] of Object.entries(updates)) {
    if (value !== undefined) {
      // Handle special field names that need escaping
      const fieldName = field === "order" ? "`order`" : field;
      clauses.push(`${fieldName} = ?`);
      args.push(value);
    }
  }

  return { clauses, args };
}

/**
 * Serialize a value to JSON string for database storage.
 * Returns null for undefined/null values.
 */
export function serializeJson(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  return JSON.stringify(value);
}

/**
 * Calculate the next order value for a task within its scope.
 * Top-level tasks have global order, subtasks have order within parent.
 */
export async function getNextOrder(
  db: Client,
  parentId: number | null | undefined,
): Promise<number> {
  const result = parentId
    ? await db.execute({
      sql:
        "SELECT COALESCE(MAX(`order`), -1) + 1 as next_order FROM tasks WHERE parent_id = ?",
      args: [parentId],
    })
    : await db.execute({
      sql:
        "SELECT COALESCE(MAX(`order`), -1) + 1 as next_order FROM tasks WHERE parent_id IS NULL",
      args: [],
    });

  return result.rows[0].next_order as number;
}

/**
 * Resolve a project by name, creating it if it doesn't exist.
 * Returns the project ID.
 */
export async function resolveOrCreateProject(
  db: Client,
  projectName: string,
): Promise<number> {
  // Check if project exists
  const projectResult = await db.execute({
    sql: "SELECT id FROM projects WHERE name = ?",
    args: [projectName],
  });

  if (projectResult.rows.length > 0) {
    return projectResult.rows[0].id as number;
  }

  // Create new project
  const createResult = await db.execute({
    sql: "INSERT INTO projects (name) VALUES (?) RETURNING id",
    args: [projectName],
  });

  return createResult.rows[0].id as number;
}
