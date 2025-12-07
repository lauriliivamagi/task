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

```
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
| `limit`      | number  | Maximum results (default: 50)                        |

### Create Task

```
POST /tasks
```

Body:

```json
{
  "title": "Task title",
  "description": "Optional description",
  "status": "todo",
  "priority": 1,
  "due_date": "2025-12-31T10:00:00Z",
  "project": "Project Name",
  "parent_id": 42,
  "recurrence": "every Monday"
}
```

### Get Task

```
GET /tasks/:id
```

### Update Task

```
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
  "project": "New Project"
}
```

### Delete Task

```
DELETE /tasks/:id
```

### Bulk Update

```
PATCH /tasks/bulk
```

Body:

```json
{
  "ids": [1, 2, 3],
  "status": "done"
}
```

### Bulk Delete

```
DELETE /tasks/bulk
```

Body:

```json
{
  "ids": [4, 5, 6]
}
```

### Batch Create

```
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

```
POST /tasks/:id/complete-subtasks
```

## Comment Endpoints

### List Comments

```
GET /tasks/:id/comments
```

### Add Comment

```
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

```
GET /tasks/:id/attachments
```

### Add Attachment

```
POST /tasks/:id/attachments
```

Multipart form data with file upload.

## Tag Endpoints

### List All Tags

```
GET /tags
```

### Create Tag

```
POST /tags
```

Body:

```json
{
  "name": "tag-name"
}
```

### Rename Tag

```
PATCH /tags/:id
```

Body:

```json
{
  "name": "new-name"
}
```

### Delete Tag

```
DELETE /tags/:id
```

### List Tags on Task

```
GET /tasks/:id/tags
```

### Add Tags to Task

```
POST /tasks/:id/tags
```

Body:

```json
{
  "tags": ["bug", "urgent"]
}
```

### Remove Tag from Task

```
DELETE /tasks/:id/tags/:tagId
```

## Project Endpoints

### List Projects

```
GET /projects
```

### Create Project

```
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

```
GET /gcal/status
```

### List Calendars

```
GET /gcal/calendars
```

### Sync Task

```
POST /gcal/sync/:taskId
```

Body:

```json
{
  "durationHours": 2,
  "calendarId": "primary"
}
```

### Batch Sync

```
POST /gcal/sync/batch
```

Body:

```json
{
  "taskIds": [1, 2, 3]
}
```

### List Synced Tasks

```
GET /gcal/synced
```

### List Unsynced Tasks

```
GET /gcal/unsynced
```

## Other Endpoints

### Health Check

```
GET /health
```

### Statistics

```
GET /stats
```

### Activity Reports

```
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

```
POST /parse
```

Body:

```json
{
  "text": "- Task 1\n- Task 2",
  "format": "markdown"
}
```
