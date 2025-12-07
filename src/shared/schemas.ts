import { z } from "zod";

// Task status enum
export const TaskStatus = z.enum(["todo", "in-progress", "done"]);
export type TaskStatus = z.infer<typeof TaskStatus>;

// Recurrence rule for recurring tasks
export const RecurrenceRule = z.object({
  type: z.enum(["daily", "weekly", "monthly", "yearly"]),
  interval: z.number().int().min(1).max(365),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(), // 0=Sun..6=Sat
  dayOfMonth: z
    .union([z.number().int().min(1).max(31), z.literal("last")])
    .optional(),
  weekOfMonth: z.number().int().min(1).max(5).optional(), // 1-5 for "first Monday" etc.
  weekday: z.number().int().min(0).max(6).optional(), // For weekOfMonth patterns
});
export type RecurrenceRule = z.infer<typeof RecurrenceRule>;

// Priority levels
export const TaskPriority = z.coerce.number().min(0).max(2);

// Task schema
export const Task = z.object({
  id: z.number(),
  project_id: z.number().nullable(),
  parent_id: z.number().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  status: TaskStatus,
  priority: TaskPriority,
  due_date: z.string().nullable(),
  order: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
  completed_at: z.string().nullable(),
  recurrence: RecurrenceRule.nullable(),
  gcal_event_id: z.string().nullable(),
  gcal_event_url: z.string().nullable(),
  duration_hours: z.number().nullable(),
});
export type Task = z.infer<typeof Task>;

// Task with project name (for list view)
export const TaskWithProject = Task.extend({
  project_name: z.string().nullable(),
  parent_title: z.string().nullable(),
});
export type TaskWithProject = z.infer<typeof TaskWithProject>;

// Project schema
export const Project = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  created_at: z.string(),
});
export type Project = z.infer<typeof Project>;

// Comment schema
export const Comment = z.object({
  id: z.number(),
  task_id: z.number(),
  content: z.string(),
  created_at: z.string(),
});
export type Comment = z.infer<typeof Comment>;

// Attachment schema
export const Attachment = z.object({
  id: z.number(),
  task_id: z.number(),
  filename: z.string(),
  path: z.string(),
  created_at: z.string(),
});
export type Attachment = z.infer<typeof Attachment>;

// Tag schema
export const Tag = z.object({
  id: z.number(),
  name: z.string(),
  created_at: z.string(),
});
export type Tag = z.infer<typeof Tag>;

// Tag with usage count (for listing)
export const TagWithCount = Tag.extend({
  task_count: z.number(),
});
export type TagWithCount = z.infer<typeof TagWithCount>;

// Tag management input schemas
export const CreateTagInput = z.object({
  name: z.string().min(1).max(50),
});
export type CreateTagInput = z.infer<typeof CreateTagInput>;

export const RenameTagInput = z.object({
  name: z.string().min(1).max(50),
});
export type RenameTagInput = z.infer<typeof RenameTagInput>;

export const AddTagsToTaskInput = z.object({
  tags: z.array(z.string().min(1).max(50)).min(1),
});
export type AddTagsToTaskInput = z.infer<typeof AddTagsToTaskInput>;

// Full task with relations
export const TaskFull = TaskWithProject.extend({
  parent_title: z.string().nullable(),
  subtasks: z.array(Task.pick({ id: true, title: true, status: true })),
  comments: z.array(
    Comment.pick({ id: true, content: true, created_at: true }),
  ),
  attachments: z.array(
    Attachment.pick({ id: true, filename: true, path: true, created_at: true }),
  ),
  tags: z.array(Tag.pick({ id: true, name: true })),
});
export type TaskFull = z.infer<typeof TaskFull>;

// Task context for AI agent integration
export const TaskContextFile = z.object({
  path: z.string(),
  line_start: z.number().optional(),
  line_end: z.number().optional(),
  snippet: z.string().optional(),
});
export type TaskContextFile = z.infer<typeof TaskContextFile>;

export const TaskContextUrl = z.object({
  url: z.string().url(),
  title: z.string().optional(),
  type: z.enum(["github-issue", "github-pr", "jira", "docs", "other"])
    .optional(),
});
export type TaskContextUrl = z.infer<typeof TaskContextUrl>;

export const TaskContextConversation = z.object({
  session_id: z.string().optional(),
  message_excerpt: z.string().optional(),
  created_by: z.string().optional(), // "claude-code", "user", etc.
});
export type TaskContextConversation = z.infer<typeof TaskContextConversation>;

export const TaskContextGit = z.object({
  repo: z.string().optional(),
  branch: z.string().optional(),
  commit: z.string().optional(),
});
export type TaskContextGit = z.infer<typeof TaskContextGit>;

export const TaskContext = z.object({
  files: z.array(TaskContextFile).optional(),
  urls: z.array(TaskContextUrl).optional(),
  conversation: TaskContextConversation.optional(),
  git: TaskContextGit.optional(),
  tags: z.array(z.string()).optional(),
  workspace: z.string().optional(), // Path to linked workspace
});
export type TaskContext = z.infer<typeof TaskContext>;

// Request schemas
export const CreateTaskInput = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  project: z.string().optional(),
  parent_id: z.number().optional(),
  due_date: z.string().optional(),
  due_date_natural: z.string().optional(), // "tomorrow", "next Monday", etc.
  context: TaskContext.optional(), // AI agent context (files, urls, git, etc.)
  tags: z.array(z.string()).optional(), // Tags to assign on creation
  recurrence: RecurrenceRule.optional(), // Recurring task schedule
  duration_hours: z.number().min(0.25).max(24).optional(), // Task duration in hours
});
export type CreateTaskInput = z.infer<typeof CreateTaskInput>;

export const UpdateTaskInput = z.object({
  status: TaskStatus.optional(),
  priority: TaskPriority.optional(),
  due_date: z.string().nullable().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  project_id: z.number().nullable().optional(),
  order: z.number().optional(),
  context: TaskContext.optional(),
  recurrence: RecurrenceRule.nullable().optional(), // null to remove, object to set
  duration_hours: z.number().min(0.25).max(24).nullable().optional(), // null to remove, number to set
});
export type UpdateTaskInput = z.infer<typeof UpdateTaskInput>;

// Reorder direction for task ordering
export const ReorderDirection = z.enum(["up", "down"]);
export type ReorderDirection = z.infer<typeof ReorderDirection>;

export const ReorderTaskInput = z.object({
  direction: ReorderDirection,
});
export type ReorderTaskInput = z.infer<typeof ReorderTaskInput>;

export const ListTasksQuery = z.object({
  all: z.coerce.boolean().optional().default(false),
  project: z.string().optional(),
  // Search & filter options
  q: z.string().optional(),
  due_before: z.string().optional(),
  due_after: z.string().optional(),
  overdue: z.coerce.boolean().optional(),
  priority: z.coerce.number().min(0).max(2).optional(),
  status: TaskStatus.optional(),
  tag: z.string().optional(), // Filter by tag name
  // Semantic search
  semantic: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(10),
});
export type ListTasksQuery = z.infer<typeof ListTasksQuery>;

export const CreateProjectInput = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});
export type CreateProjectInput = z.infer<typeof CreateProjectInput>;

export const CreateCommentInput = z.object({
  content: z.string().min(1),
});
export type CreateCommentInput = z.infer<typeof CreateCommentInput>;

// Bulk operations
export const BulkUpdateInput = z.object({
  ids: z.array(z.number()).min(1),
  update: UpdateTaskInput,
});
export type BulkUpdateInput = z.infer<typeof BulkUpdateInput>;

export const BulkDeleteInput = z.object({
  ids: z.array(z.number()).min(1),
});
export type BulkDeleteInput = z.infer<typeof BulkDeleteInput>;

// Stats response
export const StatsResponse = z.object({
  total: z.number(),
  by_status: z.object({
    todo: z.number(),
    "in-progress": z.number(),
    done: z.number(),
  }),
  by_priority: z.object({
    normal: z.number(),
    high: z.number(),
    urgent: z.number(),
  }),
  by_project: z.array(
    z.object({
      project_id: z.number().nullable(),
      project_name: z.string().nullable(),
      count: z.number(),
    }),
  ),
  overdue: z.number(),
});
export type StatsResponse = z.infer<typeof StatsResponse>;

// Batch task creation schemas
export const SubtaskInput = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  due_date: z.string().optional(),
  due_date_natural: z.string().optional(),
  priority: TaskPriority.optional(),
  context: TaskContext.optional(),
});
export type SubtaskInput = z.infer<typeof SubtaskInput>;

export const BatchTaskInput = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  project: z.string().optional(),
  parent_id: z.number().optional(), // For adding subtasks to existing task
  due_date: z.string().optional(),
  due_date_natural: z.string().optional(),
  priority: TaskPriority.optional(),
  context: TaskContext.optional(),
  subtasks: z.array(SubtaskInput).optional(),
});
export type BatchTaskInput = z.infer<typeof BatchTaskInput>;

export const BatchCreateInput = z.object({
  tasks: z.array(BatchTaskInput).min(1).max(50),
});
export type BatchCreateInput = z.infer<typeof BatchCreateInput>;

export const CreatedSubtask = z.object({
  id: z.number(),
  title: z.string(),
});
export type CreatedSubtask = z.infer<typeof CreatedSubtask>;

export const CreatedTask = z.object({
  id: z.number(),
  title: z.string(),
  parent_id: z.number().nullable(),
  subtasks: z.array(CreatedSubtask).optional(),
});
export type CreatedTask = z.infer<typeof CreatedTask>;

export const BatchCreateResponse = z.object({
  created: z.array(CreatedTask),
  count: z.number(),
});
export type BatchCreateResponse = z.infer<typeof BatchCreateResponse>;

// Parse endpoint schemas
export const ParseTasksInput = z.object({
  format: z.enum(["json", "text", "markdown"]).default("text"),
  content: z.string().min(1),
  defaults: z.object({
    project: z.string().optional(),
    priority: TaskPriority.optional(),
  }).optional(),
});
export type ParseTasksInput = z.infer<typeof ParseTasksInput>;

export const ParseTasksResponse = z.object({
  tasks: z.array(BatchTaskInput),
  warnings: z.array(z.string()).optional(),
});
export type ParseTasksResponse = z.infer<typeof ParseTasksResponse>;

// Workspace creation schemas
export const CreateWorkspaceInput = z.object({
  template: z.string().optional(),
  name: z.string().optional(),
  noOpen: z.boolean().optional(),
});
export type CreateWorkspaceInput = z.infer<typeof CreateWorkspaceInput>;

export const WorkspaceResponse = z.object({
  path: z.string(),
  name: z.string(),
  opened: z.boolean(),
  existed: z.boolean().optional(), // True if workspace already existed
});
export type WorkspaceResponse = z.infer<typeof WorkspaceResponse>;

// Report schemas
export const ReportPeriod = z.enum(["week", "month", "quarter"]);
export type ReportPeriod = z.infer<typeof ReportPeriod>;

export const ReportQuery = z.object({
  period: ReportPeriod.optional(),
  from: z.string().optional(), // ISO date YYYY-MM-DD
  to: z.string().optional(), // ISO date YYYY-MM-DD
  project: z.string().optional(),
});
export type ReportQuery = z.infer<typeof ReportQuery>;

export const ReportPeriodInfo = z.object({
  from: z.string(),
  to: z.string(),
  label: z.string(),
});
export type ReportPeriodInfo = z.infer<typeof ReportPeriodInfo>;

export const ReportSummary = z.object({
  completed_count: z.number(),
  in_progress_count: z.number(),
  added_count: z.number(),
});
export type ReportSummary = z.infer<typeof ReportSummary>;

export const ReportResponse = z.object({
  period: ReportPeriodInfo,
  completed: z.array(TaskWithProject),
  in_progress: z.array(TaskWithProject),
  added: z.array(TaskWithProject),
  summary: ReportSummary,
});
export type ReportResponse = z.infer<typeof ReportResponse>;

// Google Calendar sync schemas
export const GcalSyncInput = z.object({
  durationHours: z.number().min(0.25).max(24).optional(),
  calendarId: z.string().optional(),
  dueDate: z.string().optional(), // ISO datetime, for tasks without due_date
});
export type GcalSyncInput = z.infer<typeof GcalSyncInput>;

export const GcalSyncResponse = z.object({
  success: z.boolean(),
  eventId: z.string().optional(),
  eventUrl: z.string().optional(),
  action: z.enum(["created", "updated", "skipped"]),
  error: z.string().optional(),
});
export type GcalSyncResponse = z.infer<typeof GcalSyncResponse>;

export const GcalBatchSyncInput = z.object({
  taskIds: z.array(z.number()).min(1).max(50),
  durationHours: z.number().min(0.25).max(24).optional(),
  calendarId: z.string().optional(),
});
export type GcalBatchSyncInput = z.infer<typeof GcalBatchSyncInput>;

export const GcalStatusResponse = z.object({
  authenticated: z.boolean(),
  calendarId: z.string().optional(),
  email: z.string().optional(),
});
export type GcalStatusResponse = z.infer<typeof GcalStatusResponse>;

export const GcalCalendar = z.object({
  id: z.string(),
  summary: z.string(),
  primary: z.boolean().optional(),
});
export type GcalCalendar = z.infer<typeof GcalCalendar>;

export const GcalCalendarsResponse = z.object({
  calendars: z.array(GcalCalendar),
});
export type GcalCalendarsResponse = z.infer<typeof GcalCalendarsResponse>;
