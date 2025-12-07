import type {
  Attachment,
  BatchCreateInput,
  BatchCreateResponse,
  BulkUpdateInput,
  Comment,
  CreateCommentInput,
  CreateProjectInput,
  CreateTaskInput,
  CreateWorkspaceInput,
  GcalCalendarsResponse,
  GcalStatusResponse,
  GcalSyncInput,
  GcalSyncResponse,
  ParseTasksInput,
  ParseTasksResponse,
  Project,
  ReorderDirection,
  ReportPeriod,
  ReportResponse,
  StatsResponse,
  Tag,
  TagWithCount,
  Task,
  TaskFull,
  TaskStatus,
  TaskWithProject,
  UpdateTaskInput,
  WorkspaceResponse,
} from "../shared/schemas.ts";
import {
  assert,
  assertNonEmptyString,
  assertPositive,
} from "../shared/assert.ts";

export interface SDKConfig {
  baseUrl: string;
}

export interface TaskListOptions {
  all?: boolean;
  project?: string;
  q?: string;
  due_before?: string;
  due_after?: string;
  overdue?: boolean;
  priority?: number;
  status?: TaskStatus;
  tag?: string;
  semantic?: string;
  limit?: number;
}

export interface ReportOptions {
  period?: ReportPeriod;
  from?: string;
  to?: string;
  project?: string;
}

export class TaskClient {
  private baseUrl: string;

  constructor(config: SDKConfig) {
    // Assert: Base URL must be a non-empty string.
    assertNonEmptyString(config.baseUrl, "Base URL must not be empty", "sdk");
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        error: response.statusText,
      }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Tasks
  listTasks(options: TaskListOptions = {}): Promise<TaskWithProject[]> {
    const params = new URLSearchParams();
    if (options.all) params.set("all", "true");
    if (options.project) params.set("project", options.project);
    if (options.q) params.set("q", options.q);
    if (options.due_before) params.set("due_before", options.due_before);
    if (options.due_after) params.set("due_after", options.due_after);
    if (options.overdue) params.set("overdue", "true");
    if (options.priority !== undefined) {
      params.set("priority", String(options.priority));
    }
    if (options.status) params.set("status", options.status);
    if (options.tag) params.set("tag", options.tag);
    if (options.semantic) params.set("semantic", options.semantic);
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    const query = params.toString();
    return this.request<TaskWithProject[]>(`/tasks${query ? `?${query}` : ""}`);
  }

  getTask(id: number): Promise<TaskFull> {
    assertPositive(id, "Task ID must be positive", "sdk");
    return this.request<TaskFull>(`/tasks/${id}`);
  }

  createTask(input: CreateTaskInput): Promise<Task> {
    return this.request<Task>("/tasks", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  updateTask(id: number, input: UpdateTaskInput): Promise<Task> {
    assertPositive(id, "Task ID must be positive", "sdk");
    return this.request<Task>(`/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  deleteTask(id: number): Promise<{ deleted: boolean }> {
    assertPositive(id, "Task ID must be positive", "sdk");
    return this.request<{ deleted: boolean }>(`/tasks/${id}`, {
      method: "DELETE",
    });
  }

  bulkUpdateTasks(
    ids: number[],
    update: BulkUpdateInput["update"],
  ): Promise<Task[]> {
    assert(ids.length > 0, "IDs array must not be empty", "sdk");
    ids.forEach((id) => assertPositive(id, "Task ID must be positive", "sdk"));
    return this.request<Task[]>("/tasks/bulk", {
      method: "PATCH",
      body: JSON.stringify({ ids, update }),
    });
  }

  bulkDeleteTasks(ids: number[]): Promise<{ deleted: number }> {
    assert(ids.length > 0, "IDs array must not be empty", "sdk");
    ids.forEach((id) => assertPositive(id, "Task ID must be positive", "sdk"));
    return this.request<{ deleted: number }>("/tasks/bulk", {
      method: "DELETE",
      body: JSON.stringify({ ids }),
    });
  }

  batchCreateTasks(input: BatchCreateInput): Promise<BatchCreateResponse> {
    return this.request<BatchCreateResponse>("/tasks/batch", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  parseTasks(input: ParseTasksInput): Promise<ParseTasksResponse> {
    return this.request<ParseTasksResponse>("/parse", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  completeSubtasks(taskId: number): Promise<{ updated: number }> {
    return this.request<{ updated: number }>(
      `/tasks/${taskId}/complete-subtasks`,
      { method: "POST" },
    );
  }

  reorderTask(
    taskId: number,
    direction: ReorderDirection,
  ): Promise<{
    swapped: boolean;
    message?: string;
    task?: { id: number; order: number };
    swappedWith?: { id: number; order: number };
  }> {
    return this.request(`/tasks/${taskId}/reorder`, {
      method: "POST",
      body: JSON.stringify({ direction }),
    });
  }

  createWorkspace(
    taskId: number,
    input: CreateWorkspaceInput = {},
  ): Promise<WorkspaceResponse> {
    return this.request<WorkspaceResponse>(`/tasks/${taskId}/workspace`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  // Stats
  getStats(): Promise<StatsResponse> {
    return this.request<StatsResponse>("/stats");
  }

  // Reports
  getReport(options: ReportOptions = {}): Promise<ReportResponse> {
    const params = new URLSearchParams();
    if (options.period) params.set("period", options.period);
    if (options.from) params.set("from", options.from);
    if (options.to) params.set("to", options.to);
    if (options.project) params.set("project", options.project);
    const query = params.toString();
    return this.request<ReportResponse>(`/reports${query ? `?${query}` : ""}`);
  }

  // Projects
  listProjects(): Promise<Project[]> {
    return this.request<Project[]>("/projects");
  }

  getProject(id: number): Promise<Project> {
    return this.request<Project>(`/projects/${id}`);
  }

  createProject(input: CreateProjectInput): Promise<Project> {
    return this.request<Project>("/projects", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  deleteProject(id: number): Promise<{ deleted: boolean }> {
    return this.request<{ deleted: boolean }>(`/projects/${id}`, {
      method: "DELETE",
    });
  }

  // Comments
  listComments(taskId: number): Promise<Comment[]> {
    return this.request<Comment[]>(`/tasks/${taskId}/comments`);
  }

  addComment(
    taskId: number,
    input: CreateCommentInput,
  ): Promise<Comment> {
    return this.request<Comment>(`/tasks/${taskId}/comments`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  deleteComment(
    taskId: number,
    commentId: number,
  ): Promise<{ deleted: boolean }> {
    return this.request<{ deleted: boolean }>(
      `/tasks/${taskId}/comments/${commentId}`,
      {
        method: "DELETE",
      },
    );
  }

  // Attachments
  listAttachments(taskId: number): Promise<Attachment[]> {
    return this.request<Attachment[]>(`/tasks/${taskId}/attachments`);
  }

  addAttachment(taskId: number, filepath: string): Promise<Attachment> {
    return this.request<Attachment>(`/tasks/${taskId}/attachments`, {
      method: "POST",
      body: JSON.stringify({ filepath }),
    });
  }

  deleteAttachment(
    taskId: number,
    attachmentId: number,
  ): Promise<{ deleted: boolean }> {
    return this.request<{ deleted: boolean }>(
      `/tasks/${taskId}/attachments/${attachmentId}`,
      {
        method: "DELETE",
      },
    );
  }

  // Tags
  listTags(): Promise<TagWithCount[]> {
    return this.request<TagWithCount[]>("/tags");
  }

  createTag(name: string): Promise<Tag> {
    return this.request<Tag>("/tags", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  }

  renameTag(tagId: number, name: string): Promise<Tag> {
    return this.request<Tag>(`/tags/${tagId}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    });
  }

  deleteTag(tagId: number): Promise<{ deleted: boolean }> {
    return this.request<{ deleted: boolean }>(`/tags/${tagId}`, {
      method: "DELETE",
    });
  }

  // Task Tags
  getTaskTags(taskId: number): Promise<Tag[]> {
    return this.request<Tag[]>(`/tasks/${taskId}/tags`);
  }

  addTagsToTask(
    taskId: number,
    tags: string[],
  ): Promise<{ tags: Array<{ id: number; name: string }> }> {
    return this.request<{ tags: Array<{ id: number; name: string }> }>(
      `/tasks/${taskId}/tags`,
      {
        method: "POST",
        body: JSON.stringify({ tags }),
      },
    );
  }

  setTagsForTask(
    taskId: number,
    tags: string[],
  ): Promise<{ tags: Array<{ id: number; name: string }> }> {
    return this.request<{ tags: Array<{ id: number; name: string }> }>(
      `/tasks/${taskId}/tags`,
      {
        method: "PUT",
        body: JSON.stringify({ tags }),
      },
    );
  }

  removeTagFromTask(
    taskId: number,
    tagId: number,
  ): Promise<{ deleted: boolean }> {
    return this.request<{ deleted: boolean }>(
      `/tasks/${taskId}/tags/${tagId}`,
      {
        method: "DELETE",
      },
    );
  }

  // Health
  health(): Promise<{ status: string }> {
    return this.request<{ status: string }>("/health");
  }

  // Google Calendar
  getGcalStatus(): Promise<GcalStatusResponse> {
    return this.request<GcalStatusResponse>("/gcal/status");
  }

  listGcalCalendars(): Promise<GcalCalendarsResponse> {
    return this.request<GcalCalendarsResponse>("/gcal/calendars");
  }

  syncToCalendar(
    taskId: number,
    options: GcalSyncInput = {},
  ): Promise<GcalSyncResponse> {
    assertPositive(taskId, "Task ID must be positive", "sdk");
    return this.request<GcalSyncResponse>(`/gcal/sync/${taskId}`, {
      method: "POST",
      body: JSON.stringify(options),
    });
  }

  batchSyncToCalendar(
    taskIds: number[],
    options?: { durationHours?: number; calendarId?: string },
  ): Promise<{
    results: GcalSyncResponse[];
    summary: { total: number; success: number; failed: number };
  }> {
    assert(taskIds.length > 0, "Task IDs array must not be empty", "sdk");
    taskIds.forEach((id) =>
      assertPositive(id, "Task ID must be positive", "sdk")
    );
    return this.request(`/gcal/sync/batch`, {
      method: "POST",
      body: JSON.stringify({ taskIds, ...options }),
    });
  }

  getSyncedTasks(): Promise<{
    tasks: Array<{ id: number; title: string; gcal_event_id: string }>;
  }> {
    return this.request("/gcal/synced");
  }

  getUnsyncedTasks(): Promise<{
    tasks: Array<{ id: number; title: string; due_date: string }>;
  }> {
    return this.request("/gcal/unsynced");
  }
}

export function createClient(config: SDKConfig): TaskClient {
  return new TaskClient(config);
}
