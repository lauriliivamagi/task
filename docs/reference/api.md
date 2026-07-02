---
type: reference
domain: complicated
audience: practitioner
stability: structural
authority:
  provenance: institutional
  verifiability: executable
  evidence: moderate
  currency: undated
epistemic-layer: practice
---

# HTTP API Reference

Task exposes a REST API when running the server with `task serve`.

## Starting the Server

```bash
task serve --port 3000
```

Options:

| Option       | Default   | Description         |
| ------------ | --------- | ------------------- |
| `--port`     | 3000      | Port to listen on   |
| `--hostname` | 127.0.0.1 | Hostname to bind to |

## Task Endpoints

### List Tasks

```text
GET /tasks
```

Query parameters:

| Parameter    | Type    | Description                                          |
| ------------ | ------- | ---------------------------------------------------- |
| `q`          | string  | Text search in title and description                 |
| `status`     | string  | Filter by status: `todo`, `in-progress`, `done`      |
| `priority`   | number  | Filter by priority: 0 (Normal), 1 (High), 2 (Urgent) |
| `project`    | string  | Filter by project name                               |
| `tag`        | string  | Filter by tag name                                   |
| `overdue`    | boolean | Only overdue tasks                                   |
| `due_before` | string  | Tasks due before date (ISO 8601)                     |
| `due_after`  | string  | Tasks due after date (ISO 8601)                      |
| `semantic`   | string  | Semantic search query                                |
| `all`        | boolean | Include completed tasks                              |
| `limit`      | number  | Maximum results (1-100)                              |

Boolean flags (`all`, `overdue`) accept `true` or `1`; any other value is
treated as false. When `limit` is omitted, semantic search returns 10 results
and normal listing is unlimited.

### Create Task

```text
POST /tasks
```

Body:

```json
{
  "title": "Task title",
  "description": "Optional description",
  "due_date": "2025-12-31T10:00:00Z",
  "due_date_natural": "next friday",
  "project": "Project Name",
  "parent_id": 42,
  "tags": ["bug", "auth"],
  "recurrence": { "type": "weekly", "interval": 1, "daysOfWeek": [1] },
  "duration_hours": 1.5
}
```

Only `title` is required. `project` is created if it doesn't exist. `recurrence`
is a structured rule object (the CLI parses natural language like "every Monday"
into this shape); it is only allowed on top-level tasks. New tasks always start
as `todo` with priority 0 — set status/priority with a follow-up `PATCH`.

### Get Task

```text
GET /tasks/:id
```

### Update Task

```text
PATCH /tasks/:id
```

Body (all fields optional):

```json
{
  "title": "New title",
  "description": "New description",
  "status": "done",
  "priority": 2,
  "due_date": "2025-12-31T10:00:00Z",
  "project_id": 3,
  "order": 5,
  "recurrence": { "type": "daily", "interval": 1 },
  "duration_hours": 2
}
```

`project_id`, `recurrence`, and `duration_hours` accept `null` to clear the
value. Setting `status` to `done` on a recurring task creates the next instance
and returns its id as `recurring_next_task_id`.

### Delete Task

```text
DELETE /tasks/:id
```

Deletes the task and all its subtasks (cascade delete), along with their
comments, attachments, and stored embeddings. Returns 404 if the task doesn't
exist — as do all `DELETE` endpoints for missing resources.

### Bulk Update

```text
PATCH /tasks/bulk
```

Body:

```json
{
  "ids": [1, 2, 3],
  "update": { "status": "done" }
}
```

### Bulk Delete

```text
DELETE /tasks/bulk
```

Body:

```json
{
  "ids": [4, 5, 6]
}
```

### Batch Create

```text
POST /tasks/batch
```

Body:

```json
{
  "tasks": [
    {
      "title": "Parent task",
      "subtasks": [
        { "title": "Subtask 1" },
        { "title": "Subtask 2" }
      ]
    }
  ]
}
```

### Complete Subtasks

```text
POST /tasks/:id/complete-subtasks
```

## Comment Endpoints

### List Comments

```text
GET /tasks/:id/comments
```

### Add Comment

```text
POST /tasks/:id/comments
```

Body:

```json
{
  "content": "Comment text"
}
```

## Attachment Endpoints

### List Attachments

```text
GET /tasks/:id/attachments
```

### Add Attachment

```text
POST /tasks/:id/attachments
```

Multipart form data with file upload.

## Tag Endpoints

### List All Tags

```text
GET /tags
```

### Create Tag

```text
POST /tags
```

Body:

```json
{
  "name": "tag-name"
}
```

### Rename Tag

```text
PATCH /tags/:id
```

Body:

```json
{
  "name": "new-name"
}
```

### Delete Tag

```text
DELETE /tags/:id
```

### List Tags on Task

```text
GET /tasks/:id/tags
```

### Add Tags to Task

```text
POST /tasks/:id/tags
```

Body:

```json
{
  "tags": ["bug", "urgent"]
}
```

### Replace Tags on Task

```text
PUT /tasks/:id/tags
```

Same body as adding tags; replaces the task's full tag set.

### Remove Tag from Task

```text
DELETE /tasks/:id/tags/:tagId
```

Tags left unused by any task are removed automatically.

## Project Endpoints

### List Projects

```text
GET /projects
```

### Create Project

```text
POST /projects
```

Body:

```json
{
  "name": "Project Name"
}
```

## Google Calendar Endpoints

### Auth Status

```text
GET /gcal/status
```

### List Calendars

```text
GET /gcal/calendars
```

### Sync Task

```text
POST /gcal/sync/:taskId
```

Body:

```json
{
  "durationHours": 2,
  "calendarId": "primary",
  "dueDate": "2025-12-31T10:00:00Z"
}
```

All fields optional. `durationHours` must be 0.25-24. `dueDate` provides a start
time for tasks without a due date. If the linked event was deleted in Google
Calendar, a new event is created and the task re-linked.

### Batch Sync

```text
POST /gcal/sync/batch
```

Body:

```json
{
  "taskIds": [1, 2, 3]
}
```

### List Synced Tasks

```text
GET /gcal/synced
```

### List Unsynced Tasks

```text
GET /gcal/unsynced
```

## Other Endpoints

### Health Check

```text
GET /health
```

### Statistics

```text
GET /stats
```

### Activity Reports

```text
GET /reports
```

Query parameters:

| Parameter | Type   | Description                   |
| --------- | ------ | ----------------------------- |
| `period`  | string | `week`, `month`, or `quarter` |
| `from`    | string | Start date (ISO 8601)         |
| `to`      | string | End date (ISO 8601)           |
| `project` | string | Filter by project             |

### Parse Text to Tasks

```text
POST /parse
```

Body:

```json
{
  "content": "- Task 1\n- Task 2",
  "format": "markdown",
  "defaults": { "project": "Inbox", "priority": 1 }
}
```

`format` is `text` (default), `markdown`, or `json`. `defaults` is optional.
