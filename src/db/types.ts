/**
 * Database Row Types
 *
 * Type definitions for database query results.
 * These types represent the raw data returned from SQLite queries.
 */

/**
 * Raw row from tasks table.
 * Note: JSON fields (context, recurrence) are stored as strings in the database.
 */
export interface TaskRow {
  id: number;
  title: string;
  description: string | null;
  status: string;
  priority: number;
  due_date: string | null;
  project_id: number | null;
  parent_id: number | null;
  order: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  recurrence: string | null; // JSON string in DB
  context: string | null; // JSON string in DB
  gcal_event_id: string | null;
  gcal_event_url: string | null;
  duration_hours: number | null;
}

/**
 * Task row with joined project and parent information.
 * Returned by queries that JOIN with projects and parent tasks.
 */
export interface TaskRowWithProject extends TaskRow {
  project_name: string | null;
  parent_title: string | null;
}

/**
 * Task row with parsed JSON fields.
 * Use parseTaskJsonFields() to convert from TaskRow.
 */
export interface ParsedTaskRow {
  id: number;
  title: string;
  description: string | null;
  status: string;
  priority: number;
  due_date: string | null;
  project_id: number | null;
  parent_id: number | null;
  order: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  gcal_event_id: string | null;
  gcal_event_url: string | null;
  duration_hours: number | null;
  context: Record<string, unknown> | null;
  recurrence: {
    type: "daily" | "weekly" | "monthly" | "yearly";
    interval: number;
    daysOfWeek?: number[];
    dayOfMonth?: number | "last";
    weekOfMonth?: number;
    weekday?: number;
  } | null;
}

/**
 * Parsed task row with project information.
 */
export interface ParsedTaskRowWithProject extends ParsedTaskRow {
  project_name: string | null;
  parent_title: string | null;
}

/**
 * Raw row from projects table.
 */
export interface ProjectRow {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
}

/**
 * Raw row from comments table.
 */
export interface CommentRow {
  id: number;
  task_id: number;
  content: string;
  created_at: string;
}

/**
 * Raw row from attachments table.
 */
export interface AttachmentRow {
  id: number;
  task_id: number;
  filename: string;
  path: string;
  created_at: string;
}

/**
 * Raw row from tags table.
 */
export interface TagRow {
  id: number;
  name: string;
  created_at: string;
}

/**
 * Subtask summary for task detail view.
 */
export interface SubtaskSummary {
  id: number;
  title: string;
  status: string;
}

/**
 * Comment summary for task detail view.
 */
export interface CommentSummary {
  id: number;
  content: string;
  created_at: string;
}

/**
 * Attachment summary for task detail view.
 */
export interface AttachmentSummary {
  id: number;
  filename: string;
  path: string;
  created_at: string;
}

/**
 * Tag summary for task detail view.
 */
export interface TagSummary {
  id: number;
  name: string;
}
