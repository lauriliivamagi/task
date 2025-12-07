import type { TaskListOptions } from "../sdk/client.ts";
import type {
  Attachment,
  Comment,
  CreateCommentInput,
  CreateProjectInput,
  CreateTaskInput,
  Project,
  ReorderDirection,
  Task,
  TaskFull,
  TaskWithProject,
  UpdateTaskInput,
} from "../shared/schemas.ts";
import type { ITaskClient } from "./machines/tui.types.ts";

export class MockTaskClient implements ITaskClient {
  private tasks: TaskFull[] = [];
  private projects: Project[] = [];

  constructor() {
    this.seed();
  }

  private seed(): void {
    this.projects = [
      {
        id: 1,
        name: "Personal",
        description: "Personal tasks",
        created_at: new Date().toISOString(),
      },
      {
        id: 2,
        name: "Work",
        description: "Work related stuff",
        created_at: new Date().toISOString(),
      },
    ];

    this.tasks = [
      {
        id: 1,
        title: "Buy groceries",
        status: "todo",
        priority: 1,
        order: 0,
        project_id: 1,
        project_name: "Personal",
        parent_id: null,
        parent_title: null,
        description: "Milk, eggs, bread",
        due_date: "2023-12-01",
        recurrence: null,
        gcal_event_id: null,
        gcal_event_url: null,
        duration_hours: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        completed_at: null,
        subtasks: [],
        comments: [],
        attachments: [],
        tags: [],
      },
      {
        id: 2,
        title: "Finish report",
        status: "in-progress",
        priority: 2,
        order: 1,
        project_id: 2,
        project_name: "Work",
        parent_id: null,
        parent_title: null,
        description: "Q4 financial report",
        due_date: "2023-11-30",
        recurrence: null,
        gcal_event_id: null,
        gcal_event_url: null,
        duration_hours: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        completed_at: null,
        subtasks: [
          { id: 3, title: "Gather data", status: "done" },
          { id: 4, title: "Write summary", status: "todo" },
        ],
        comments: [
          {
            id: 1,
            content: "Waiting for data from sales",
            created_at: new Date().toISOString(),
          },
        ],
        attachments: [],
        tags: [],
      },
      {
        id: 5,
        title: "Walk the dog",
        status: "todo",
        priority: 0,
        order: 2,
        project_id: 1,
        project_name: "Personal",
        parent_id: null,
        parent_title: null,
        description: null,
        due_date: null,
        recurrence: null,
        gcal_event_id: null,
        gcal_event_url: null,
        duration_hours: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        completed_at: null,
        subtasks: [],
        comments: [],
        attachments: [],
        tags: [],
      },
      {
        id: 6,
        title: "Plan vacation",
        status: "todo",
        priority: 1,
        order: 3,
        project_id: 1,
        project_name: "Personal",
        parent_id: null,
        parent_title: null,
        description: "Look for hotels in Italy",
        due_date: null,
        recurrence: null,
        gcal_event_id: null,
        gcal_event_url: null,
        duration_hours: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        completed_at: null,
        subtasks: [],
        comments: [],
        attachments: [],
        tags: [],
      },
    ];

    // Add more tasks to test scrolling
    for (let i = 0; i < 15; i++) {
      this.tasks.push({
        id: 100 + i,
        title: `Extra Task ${i + 1}`,
        status: "todo",
        priority: 0,
        order: 4 + i,
        project_id: 1,
        project_name: "Personal",
        parent_id: null,
        parent_title: null,
        description: `Description for extra task ${i + 1}`,
        due_date: null,
        recurrence: null,
        gcal_event_id: null,
        gcal_event_url: null,
        duration_hours: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        completed_at: null,
        subtasks: [],
        comments: [],
        attachments: [],
        tags: [],
      });
    }
  }

  listTasks(_options: TaskListOptions = {}): Promise<TaskWithProject[]> {
    return Promise.resolve(
      this.tasks.map((t) => {
        const { subtasks: _, comments: __, attachments: ___, ...rest } = t;
        return rest;
      }),
    );
  }

  getTask(id: number): Promise<TaskFull> {
    const task = this.tasks.find((t) => t.id === id);
    if (!task) return Promise.reject(new Error("Task not found"));
    return Promise.resolve(task);
  }

  createTask(input: CreateTaskInput): Promise<Task> {
    // Find parent title if parent_id is provided
    const parentTask = input.parent_id
      ? this.tasks.find((t) => t.id === input.parent_id)
      : null;

    // Calculate next order value
    const maxOrder = Math.max(...this.tasks.map((t) => t.order), -1);

    const newTask: TaskFull = {
      id: this.tasks.length + 1,
      title: input.title,
      description: input.description || null,
      project_id: null, // Simplified
      project_name: null,
      parent_id: input.parent_id || null,
      parent_title: parentTask?.title ?? null,
      status: "todo",
      priority: 0,
      order: maxOrder + 1,
      due_date: input.due_date || null,
      recurrence: null,
      gcal_event_id: null,
      gcal_event_url: null,
      duration_hours: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: null,
      subtasks: [],
      comments: [],
      attachments: [],
      tags: [],
    };
    this.tasks.push(newTask);
    const { subtasks: _, comments: __, attachments: ___, ...rest } = newTask;
    return Promise.resolve(rest);
  }

  updateTask(id: number, input: UpdateTaskInput): Promise<Task> {
    const taskIndex = this.tasks.findIndex((t) => t.id === id);
    if (taskIndex === -1) return Promise.reject(new Error("Task not found"));

    // Handle project_id update - also update project_name
    let projectName: string | null = this.tasks[taskIndex].project_name;
    if (input.project_id !== undefined) {
      if (input.project_id === null) {
        projectName = null;
      } else {
        const project = this.projects.find((p) => p.id === input.project_id);
        projectName = project?.name ?? null;
      }
    }

    this.tasks[taskIndex] = {
      ...this.tasks[taskIndex],
      ...input,
      project_name: projectName,
      updated_at: new Date().toISOString(),
    };

    const { subtasks: _, comments: __, attachments: ___, ...rest } = this.tasks[
      taskIndex
    ];
    void _, void __, void ___;
    return Promise.resolve(rest);
  }

  deleteTask(id: number): Promise<{ deleted: boolean }> {
    this.tasks = this.tasks.filter((t) => t.id !== id);
    return Promise.resolve({ deleted: true });
  }

  listProjects(): Promise<Project[]> {
    return Promise.resolve(this.projects);
  }

  getProject(id: number): Promise<Project> {
    const project = this.projects.find((p) => p.id === id);
    if (!project) return Promise.reject(new Error("Project not found"));
    return Promise.resolve(project);
  }

  createProject(input: CreateProjectInput): Promise<Project> {
    const newProject: Project = {
      id: this.projects.length + 1,
      name: input.name,
      description: input.description || null,
      created_at: new Date().toISOString(),
    };
    this.projects.push(newProject);
    return Promise.resolve(newProject);
  }

  deleteProject(id: number): Promise<{ deleted: boolean }> {
    this.projects = this.projects.filter((p) => p.id !== id);
    return Promise.resolve({ deleted: true });
  }

  listComments(taskId: number): Promise<Comment[]> {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return Promise.reject(new Error("Task not found"));
    return Promise.resolve(
      task.comments.map((c) => ({
        ...c,
        task_id: taskId,
      })),
    );
  }

  addComment(
    taskId: number,
    input: CreateCommentInput,
  ): Promise<Comment> {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return Promise.reject(new Error("Task not found"));
    const newComment = {
      id: Math.random(),
      content: input.content,
      created_at: new Date().toISOString(),
    };
    task.comments.push(newComment);
    return Promise.resolve({ ...newComment, task_id: taskId });
  }

  deleteComment(
    taskId: number,
    commentId: number,
  ): Promise<{ deleted: boolean }> {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return Promise.reject(new Error("Task not found"));
    task.comments = task.comments.filter((c) => c.id !== commentId);
    return Promise.resolve({ deleted: true });
  }

  listAttachments(taskId: number): Promise<Attachment[]> {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return Promise.reject(new Error("Task not found"));
    return Promise.resolve(
      task.attachments.map((a) => ({
        ...a,
        task_id: taskId,
      })),
    );
  }

  addAttachment(taskId: number, filepath: string): Promise<Attachment> {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return Promise.reject(new Error("Task not found"));
    const newAttachment = {
      id: Math.random(),
      filename: filepath.split("/").pop() || "file",
      path: filepath,
      created_at: new Date().toISOString(),
    };
    task.attachments.push(newAttachment);
    return Promise.resolve({ ...newAttachment, task_id: taskId });
  }

  deleteAttachment(
    taskId: number,
    attachmentId: number,
  ): Promise<{ deleted: boolean }> {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return Promise.reject(new Error("Task not found"));
    task.attachments = task.attachments.filter((a) => a.id !== attachmentId);
    return Promise.resolve({ deleted: true });
  }

  health(): Promise<{ status: string }> {
    return Promise.resolve({ status: "ok" });
  }

  addTagsToTask(
    taskId: number,
    tags: string[],
  ): Promise<{ tags: Array<{ id: number; name: string }> }> {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return Promise.reject(new Error("Task not found"));

    const addedTags: Array<{ id: number; name: string }> = [];
    for (const tagName of tags) {
      const trimmed = tagName.trim();
      if (!trimmed) continue;

      // Check if tag already exists on task
      const existing = task.tags?.find(
        (t) => t.name.toLowerCase() === trimmed.toLowerCase(),
      );
      if (!existing) {
        const newTag = { id: Math.floor(Math.random() * 10000), name: trimmed };
        task.tags = task.tags || [];
        task.tags.push(newTag);
        addedTags.push(newTag);
      }
    }

    return Promise.resolve({ tags: addedTags });
  }

  setTagsForTask(
    taskId: number,
    tags: string[],
  ): Promise<{ tags: Array<{ id: number; name: string }> }> {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return Promise.reject(new Error("Task not found"));

    // Clear existing tags and set new ones
    const newTags: Array<{ id: number; name: string }> = [];
    for (const tagName of tags) {
      const trimmed = tagName.trim();
      if (!trimmed) continue;
      newTags.push({ id: Math.floor(Math.random() * 10000), name: trimmed });
    }
    task.tags = newTags;

    return Promise.resolve({ tags: newTags });
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
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return Promise.reject(new Error("Task not found"));

    const currentOrder = task.order;
    const parentId = task.parent_id;

    // Find adjacent task in the same scope
    const sameScopeTasks = this.tasks.filter((t) => t.parent_id === parentId);
    sameScopeTasks.sort((a, b) => a.order - b.order);

    const currentIndex = sameScopeTasks.findIndex((t) => t.id === taskId);
    const adjacentIndex = direction === "up"
      ? currentIndex - 1
      : currentIndex + 1;

    if (adjacentIndex < 0 || adjacentIndex >= sameScopeTasks.length) {
      return Promise.resolve({
        swapped: false,
        message: "Already at boundary",
      });
    }

    const adjacentTask = sameScopeTasks[adjacentIndex];
    const adjacentOrder = adjacentTask.order;

    // Swap orders
    task.order = adjacentOrder;
    adjacentTask.order = currentOrder;

    return Promise.resolve({
      swapped: true,
      task: { id: taskId, order: adjacentOrder },
      swappedWith: { id: adjacentTask.id, order: currentOrder },
    });
  }

  createWorkspace(
    taskId: number,
    _input?: { template?: string; name?: string; noOpen?: boolean },
  ): Promise<
    { path: string; name: string; opened: boolean; existed?: boolean }
  > {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return Promise.reject(new Error("Task not found"));

    return Promise.resolve({
      path: `/tmp/mock-workspace-${taskId}`,
      name: `workspace-${taskId}`,
      opened: true,
      existed: false,
    });
  }

  syncToCalendar(
    taskId: number,
    _options?: { durationHours?: number; calendarId?: string },
  ): Promise<{
    success: boolean;
    eventId?: string;
    eventUrl?: string;
    action: "created" | "updated" | "skipped";
    error?: string;
  }> {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) return Promise.reject(new Error("Task not found"));

    // Mock: pretend to sync successfully
    return Promise.resolve({
      success: true,
      eventId: `mock-event-${taskId}`,
      eventUrl: `https://calendar.google.com/calendar/event?eid=mock-${taskId}`,
      action: "created",
    });
  }

  getGcalStatus(): Promise<{ authenticated: boolean; calendarId?: string }> {
    // Mock: pretend we're not authenticated (TUI will show error)
    return Promise.resolve({
      authenticated: false,
    });
  }
}
