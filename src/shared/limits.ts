// TigerStyle: Put a limit on everything.
// All loops and queues must have a fixed upper bound to prevent infinite loops
// or tail latency spikes. This follows the "fail-fast" principle.

/**
 * Maximum number of tasks to return per page in list queries.
 * Prevents unbounded memory usage from large result sets.
 */
export const MAX_TASKS_PER_PAGE = 1000;

/**
 * Maximum length of a task title in characters.
 * Titles should be concise summaries.
 */
export const MAX_TITLE_LENGTH = 500;

/**
 * Maximum length of a task description in characters.
 * Descriptions can contain detailed information.
 */
export const MAX_DESCRIPTION_LENGTH = 50_000;

/**
 * Maximum length of a comment in characters.
 */
export const MAX_COMMENT_LENGTH = 50_000;

/**
 * Maximum file size for attachments in bytes.
 * 100 MB limit to prevent disk exhaustion.
 */
export const MAX_ATTACHMENT_SIZE = 100 * 1024 * 1024;

/**
 * Maximum length of a project name in characters.
 */
export const MAX_PROJECT_NAME_LENGTH = 200;

/**
 * Maximum length of a tag name in characters.
 */
export const MAX_TAG_NAME_LENGTH = 100;

/**
 * Maximum number of results for search queries.
 * Prevents expensive full-table scans.
 */
export const MAX_SEARCH_RESULTS = 500;

/**
 * Maximum number of tasks in a batch operation.
 * Prevents timeout and memory issues.
 */
export const MAX_BATCH_SIZE = 100;

/**
 * Maximum depth of task hierarchy (subtasks of subtasks).
 * Prevents infinite recursion and deeply nested structures.
 */
export const MAX_TASK_DEPTH = 10;

/**
 * Maximum number of tags per task.
 * Keeps tag management reasonable.
 */
export const MAX_TAGS_PER_TASK = 20;

/**
 * Maximum number of attachments per task.
 */
export const MAX_ATTACHMENTS_PER_TASK = 50;

/**
 * Maximum number of comments per task.
 */
export const MAX_COMMENTS_PER_TASK = 1000;

/**
 * Maximum iterations for any loop that should terminate.
 * Safety valve to prevent infinite loops in algorithms.
 */
export const MAX_LOOP_ITERATIONS = 10_000;

/**
 * Maximum length of a context JSON field in characters.
 */
export const MAX_CONTEXT_LENGTH = 10_000;

/**
 * Maximum length of a database name in characters.
 * Database names: a-z, 0-9, -, _ (lowercase only)
 */
export const MAX_DB_NAME_LENGTH = 50;

/**
 * Maximum number of databases a user can create.
 * Prevents unbounded directory growth.
 */
export const MAX_DATABASES = 100;

/**
 * Maximum number of tasks returned per section in a report.
 * Prevents extremely large report responses.
 */
export const MAX_REPORT_TASKS_PER_SECTION = 500;

/**
 * Maximum number of tasks to sync in a single Google Calendar batch operation.
 */
export const MAX_GCAL_BATCH_SYNC = 50;

/**
 * OAuth callback server timeout in milliseconds.
 * 5 minutes to complete authentication flow.
 */
export const GCAL_AUTH_TIMEOUT_MS = 300_000;

/**
 * Maximum event duration in hours for Google Calendar events.
 */
export const MAX_GCAL_DURATION_HOURS = 24;

/**
 * Default event duration in hours for Google Calendar events.
 */
export const DEFAULT_GCAL_DURATION_HOURS = 1;

/**
 * OAuth callback server port for Google Calendar authentication.
 */
export const GCAL_AUTH_PORT = 8484;

/**
 * Maximum number of custom keybindings per mode in TUI.
 * Prevents unbounded configuration parsing.
 */
export const MAX_KEYBINDINGS_PER_MODE = 50;
