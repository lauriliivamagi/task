# Task CLI API Reference

## HTTP API Endpoints

Base URL: `http://localhost:3000` (default when running `task serve`)

### Tasks

#### List Tasks

```
GET /tasks
```

Query parameters:

| Parameter    | Type    | Description                              |
| ------------ | ------- | ---------------------------------------- |
| `q`          | string  | Text search in title/description         |
| `semantic`   | string  | AI-powered similarity search             |
| `status`     | string  | Filter: `todo`, `in-progress`, `done`    |
| `priority`   | number  | Filter: 0 (normal), 1 (high), 2 (urgent) |
| `project`    | string  | Filter by project name                   |
| `tag`        | string  | Filter by tag name                       |
| `overdue`    | boolean | Show only overdue tasks                  |
| `due_before` | string  | Tasks due before date (YYYY-MM-DD)       |
| `due_after`  | string  | Tasks due after date (YYYY-MM-DD)        |
| `all`        | boolean | Include completed tasks                  |
| `limit`      | number  | Max results (default 10 for semantic)    |

#### Create Task

```
POST /tasks
Content-Type: application/json

{
  "title": "string (required)",
  "description": "string",
  "project": "string (creates if not exists)",
  "parent_id": "number (for subtasks)",
  "due_date": "YYYY-MM-DD or YYYY-MM-DDTHH:MM:SSZ (date-only stored as UTC midnight, datetime with time interpreted as local and converted to UTC)",
  "due_date_natural": "string (e.g. 'tomorrow', 'tomorrow at 15:00', 'next friday 14:00')",
  "priority": "number (0, 1, 2)",
  "tags": ["string (creates if not exists)"],
  "recurrence": {
    "type": "daily|weekly|monthly|yearly",
    "interval": "number (1-365)",
    "daysOfWeek": "[number] (0=Sun..6=Sat, for weekly)",
    "dayOfMonth": "number|'last' (1-31, for monthly)",
    "weekOfMonth": "number (1-5, for 'first Monday' patterns)",
    "weekday": "number (0-6, used with weekOfMonth)"
  },
  "context": {
    "files": [{"path": "string", "line_start": "number", "line_end": "number"}],
    "urls": [{"url": "string", "type": "github-issue|github-pr|jira|docs|other"}],
    "conversation": {"created_by": "string", "message_excerpt": "string"},
    "git": {"repo": "string", "branch": "string", "commit": "string"},
    "tags": ["string"],
    "workspace": "string (path to linked workspace)"
  }
}
```

Note: Subtasks (tasks with `parent_id`) cannot have recurrence.

#### Batch Create Tasks

```
POST /tasks/batch
Content-Type: application/json

{
  "tasks": [{
    "title": "string (required)",
    "description": "string",
    "project": "string",
    "due_date_natural": "string",
    "priority": "number",
    "context": {...},
    "subtasks": [
      {"title": "string", "priority": "number"}
    ]
  }]
}
```

Response:

```json
{
  "created": [
    { "id": 1, "title": "Main task", "subtask_ids": [2, 3] }
  ]
}
```

#### Get Task Details

```
GET /tasks/:id
```

Returns task with subtasks, comments, attachments, and parsed context.

#### Update Task

```
PATCH /tasks/:id
Content-Type: application/json

{
  "title": "string",
  "description": "string",
  "status": "todo|in-progress|done",
  "priority": "number",
  "due_date": "YYYY-MM-DD",
  "recurrence": {...} | null,
  "context": {...}
}
```

When updating status to `done` on a recurring task, the response includes
`recurring_next_task_id` with the ID of the newly created task.

#### Delete Task

```
DELETE /tasks/:id
```

Deletes the task and all its subtasks (cascade delete).

#### Bulk Update

```
PATCH /tasks/bulk
Content-Type: application/json

{
  "ids": [1, 2, 3],
  "updates": {
    "status": "done",
    "priority": 1
  }
}
```

#### Bulk Delete

```
DELETE /tasks/bulk
Content-Type: application/json

{
  "ids": [1, 2, 3]
}
```

#### Complete Subtasks

```
POST /tasks/:id/complete-subtasks
```

Marks all subtasks of the specified task as done.

#### Reorder Task

```
POST /tasks/:id/reorder
Content-Type: application/json

{
  "direction": "up|down"
}
```

### Tags

#### List Tags

```
GET /tags
```

Returns all tags with usage counts.

#### Create Tag

```
POST /tags
Content-Type: application/json

{
  "name": "string (required)"
}
```

#### Rename Tag

```
PATCH /tags/:id
Content-Type: application/json

{
  "name": "string (required)"
}
```

#### Delete Tag

```
DELETE /tags/:id
```

#### List Task Tags

```
GET /tasks/:taskId/tags
```

#### Add Tags to Task

```
POST /tasks/:taskId/tags
Content-Type: application/json

{
  "tags": ["string"]
}
```

Creates tags if they don't exist.

#### Remove Tag from Task

```
DELETE /tasks/:taskId/tags/:tagId
```

### Projects

#### List Projects

```
GET /projects
```

#### Create Project

```
POST /projects
Content-Type: application/json

{
  "name": "string (required)",
  "description": "string"
}
```

#### Delete Project

```
DELETE /projects/:id
```

### Comments

#### List Comments

```
GET /tasks/:taskId/comments
```

#### Add Comment

```
POST /tasks/:taskId/comments
Content-Type: application/json

{
  "content": "string (required)"
}
```

Automatically generates embedding if provider configured.

### Attachments

#### List Attachments

```
GET /tasks/:taskId/attachments
```

#### Upload Attachment

```
POST /tasks/:taskId/attachments
Content-Type: multipart/form-data

file: <binary>
```

### Parse

Convert text/markdown into structured tasks:

```
POST /parse
Content-Type: application/json

{
  "format": "text|markdown",
  "content": "Review PR @work due:tomorrow priority:high\n  - Check tests\n  - Approve"
}
```

Text format markers:

- `@project` - Assign to project
- `due:DATE` - Due date (natural language supported)
- `priority:high` or `p:1` - Priority level

Response returns `BatchTaskInput` array ready for `/tasks/batch`.

### Statistics

```
GET /stats
```

Returns counts by status, priority, and project.

### Reports

```
GET /reports
```

Query parameters:

| Parameter | Type   | Description                               |
| --------- | ------ | ----------------------------------------- |
| `period`  | string | Preset period: `week`, `month`, `quarter` |
| `from`    | string | Start date (YYYY-MM-DD) for custom range  |
| `to`      | string | End date (YYYY-MM-DD) for custom range    |
| `project` | string | Filter by project name                    |

Response:

```json
{
  "period": {
    "from": "2025-12-01",
    "to": "2025-12-07",
    "label": "Week of Dec 1-7, 2025"
  },
  "completed": [...],
  "in_progress": [...],
  "added": [...],
  "summary": {
    "completed_count": 5,
    "in_progress_count": 3,
    "added_count": 10
  }
}
```

Period definitions:

- `week`: Current calendar week (Monday to Sunday)
- `month`: Current calendar month
- `quarter`: Current calendar quarter (Q1-Q4)

If no parameters provided, defaults to current week.

### Health

```
GET /health
```

Returns `{"status": "ok"}`.

## CLI Command Reference

All commands support `--json` for structured output and `--attach <url>` to
connect to external server.

### task add

```bash
task add <title> [description] [options]

Options:
  -p, --project <name>    Assign to project
  -P, --parent <id>       Create as subtask
  -d, --due <date>        Due date (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SSZ)
  -t, --tag <name>        Add tag (repeatable)
  -r, --recurrence <rule> Recurrence rule (e.g. "every day", "every Monday")
  --due-natural <text>    Natural language date (e.g. "tomorrow at 15:00")
```

### task list

```bash
task list [options]

Options:
  -a, --all               Include completed tasks
  -p, --project <name>    Filter by project
  -t, --tag <name>        Filter by tag
  -q, --search <text>     Text search
  -s, --semantic <query>  Semantic search
  -n, --limit <number>    Limit results
  --status <status>       Filter: todo, in-progress, done
  --priority <level>      Filter: 0, 1, 2
  --overdue              Show overdue only
  --due-before <date>    Before date
  --due-after <date>     After date
```

### task update

```bash
task update <id> [options]

Options:
  -t, --title <title>      Set new title
  -D, --description <desc> Set new description
  -s, --status <status>    Set status
  -p, --priority <level>   Set priority
  -d, --due <date>         Set due date (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SSZ)
  --project <name>         Move task to project (creates if needed)
  --clear-project          Remove task from its project
  -r, --recurrence <rule>  Set recurrence (e.g. "every day", "weekly")
  --clear-recurrence       Remove recurrence from task
```

### task view

```bash
task view <id>
```

### task comment

```bash
task comment <id> <content>
```

### task attach

```bash
task attach <id> <filepath>
```

### task batch-add

```bash
task batch-add [options]

Options:
  -f, --file <path>    Read JSON from file (otherwise stdin)
```

### task bulk

```bash
task bulk update <ids...> [options]
task bulk delete <ids...> [options]

Update options:
  -s, --status <status>
  -p, --priority <level>

Delete options:
  -y, --yes    Skip confirmation
```

### task complete-subtasks

```bash
task complete-subtasks <id>
```

### task share

```bash
task share <id> [options]

Options:
  -t, --template <name>   Use template from ~/.task-cli/templates/
  --raw                   Output raw JSON
  --list-templates        List available templates
```

### task work

```bash
task work <id> [options]

Options:
  -t, --template <name>   Use workspace template
  -n, --name <name>       Custom workspace name (default: id-slug)
  --no-open               Create but don't open IDE
  -o, --open              Open existing workspace in IDE
  --list-templates        List available workspace templates
```

Creates a git repository at `~/git/<id>-<slug>/` with:

- `README.md` - Task context for humans
- `CLAUDE.md` - Instructions for AI assistants
- `input/` - Attachments and `.task-ref.json` (bidirectional link)
- `output/` - Place for deliverables

Workspace templates stored in `~/.task-cli/workspace-templates/`.

### task embeddings

```bash
task embeddings status     # Show coverage stats
task embeddings backfill   # Generate for all tasks
task embeddings provider   # Show provider config
```

### task tag

```bash
task tag list                      # List all tags with usage counts
task tag add <taskId> <tags...>    # Add tags to a task
task tag remove <taskId> <tag>     # Remove tag from a task
task tag rename <tagId> <newName>  # Rename a tag
task tag delete <tagId>            # Delete a tag
```

### task stats

```bash
task stats
```

### task report

```bash
task report [options]

Options:
  --period <period>    Calendar period: week, month, quarter
  --from <date>        Start date (YYYY-MM-DD) for custom range
  --to <date>          End date (YYYY-MM-DD) for custom range
  -p, --project <name> Filter by project
  --json               Output as JSON
```

Report sections:

- **Completed**: Tasks marked done during the period (uses `completed_at`)
- **In Progress**: Tasks with `status=in-progress` updated during period
- **Added**: Tasks created during the period

Period definitions:

- `week`: Monday to Sunday of current week
- `month`: First to last day of current month
- `quarter`: Current Q1-Q4 calendar quarter

### task serve

```bash
task serve [options]

Options:
  --port <number>      Port (default: 3000)
  --hostname <string>  Hostname (default: 127.0.0.1)
```

### task tui

```bash
task tui [options]

Options:
  --attach <url>    Connect to external server
  --port <number>   Port for local server
```

**Keyboard shortcuts:**

Global: `q` (quit), `r` (refresh), `Tab` (switch panels), `Shift+P` (command
palette)

List panel:

- `↑/↓` - Navigate
- `e` - Edit title inline
- `n` - New task
- `o` - Add subtask
- `x` - Mark done
- `w` - Start work (create workspace)
- `y` - Yank (copy prompt)
- `Shift+K/J` - Reorder task

Detail panel:

- `e` - Edit title
- `s` - Change status
- `p` - Change priority
- `o` - Change project
- `u` - Change due date
- `t` - Manage tags
- `r` - Edit recurrence
- `c` - Add comment
- `d` - Edit description
- `a` - Add attachment
- `w` - Start work
- `y` - Yank
- `Shift+G` - Sync to Google Calendar

### task truncate

```bash
task truncate [--yes]
```

Deletes all data (tasks, projects, comments, attachments).

### task db

```bash
task db list                   # List all databases with task/project counts
task db create <name>          # Create new database (lowercase, numbers, hyphens, underscores)
task db use <name>             # Switch to a database
task db current [--json]       # Show active database
task db rename <old> <new>     # Rename a database (cannot rename 'default')
task db delete <name> [--force] # Delete a database (with confirmation)
```

Database names: lowercase letters, numbers, hyphens, underscores only (max 50
chars). Cannot delete the last database or the currently active database.

### task gcal

```bash
task gcal auth                    # Authenticate with Google (OAuth 2.0)
task gcal status                  # Check authentication status
task gcal logout                  # Clear stored credentials
task gcal calendars               # List available calendars
task gcal sync <taskId>           # Sync a task to Google Calendar
task gcal use <calendar-id>       # Set default calendar for syncing
```

**Sync options:**

| Option                  | Description                             |
| ----------------------- | --------------------------------------- |
| `-d, --duration <hrs>`  | Event duration in hours (default: 1)    |
| `-c, --calendar <name>` | Target calendar name (default: primary) |
| `--date <datetime>`     | Override due date (natural language)    |
| `--json`                | Output in JSON format                   |

**Setup:**

1. Create a Google Cloud project at https://console.cloud.google.com
2. Enable the Google Calendar API
3. Create OAuth 2.0 credentials (Desktop app type)
4. Run `task gcal auth` and enter your Client ID and Secret

## Google Calendar API Endpoints

### Check Auth Status

```
GET /gcal/status
```

Response: `{ "authenticated": true, "calendarId": "primary" }`

### List Calendars

```
GET /gcal/calendars
```

Response: `{ "calendars": [{ "id": "...", "name": "..." }] }`

### Sync Single Task

```
POST /gcal/sync/:taskId
Content-Type: application/json

{
  "durationHours": 1,
  "calendarId": "primary"
}
```

Response:
`{ "success": true, "eventId": "...", "eventUrl": "...", "action": "created" }`

### Batch Sync Tasks

```
POST /gcal/sync/batch
Content-Type: application/json

{
  "taskIds": [1, 2, 3],
  "durationHours": 1
}
```

Response:
`{ "results": [...], "summary": { "total": 3, "success": 2, "failed": 1 } }`

### List Synced Tasks

```
GET /gcal/synced
```

Response: `{ "tasks": [{ "id": 1, "title": "...", "gcal_event_id": "..." }] }`

### List Unsynced Tasks with Due Dates

```
GET /gcal/unsynced
```

Response: `{ "tasks": [{ "id": 2, "title": "...", "due_date": "..." }] }`

## Data Storage

Multi-database structure for context separation (work, home, projects):

```
~/.task-cli/
├── config.json              # Configuration (includes activeDb)
├── logs/                    # Daily rotated log files
├── templates/               # Task sharing templates (.txt)
├── workspace-templates/     # Workspace project templates
└── databases/
    ├── default/
    │   ├── data.db          # SQLite database
    │   ├── attachments/     # Uploaded files
    │   └── tui-state.json   # TUI state persistence
    ├── work/
    │   ├── data.db
    │   ├── attachments/
    │   └── tui-state.json
    └── home/
        └── ...
```

Each database is isolated with its own tasks, attachments, and TUI state.
Automatic migration from single-db layout occurs on first run.

## Environment Variables

| Variable                      | Description                                         |
| ----------------------------- | --------------------------------------------------- |
| `EMBEDDING_PROVIDER`          | `ollama`, `openai`, or `gemini`                     |
| `OLLAMA_URL`                  | Ollama server URL (default: http://localhost:11434) |
| `OLLAMA_MODEL`                | Ollama model (default: nomic-embed-text)            |
| `OPENAI_API_KEY`              | OpenAI API key                                      |
| `OPENAI_EMBEDDING_MODEL`      | OpenAI model (default: text-embedding-3-small)      |
| `GEMINI_API_KEY`              | Google Gemini API key                               |
| `GEMINI_EMBEDDING_DIMENSIONS` | Dimensions: 768, 1536, or 3072                      |
| `TASK_CLI_LOG_LEVEL`          | Log level: debug, info, warn, error                 |
| `TASK_CLI_LOG_DISABLED`       | Set to 1 to disable file logging                    |
| `TASK_CLI_DB_URL`             | Database path (default: ~/.task-cli/data.db)        |
| `TASK_CLI_REPOS_DIR`          | Workspace directory (default: ~/git)                |
| `TASK_CLI_IDE_COMMAND`        | IDE command for `task work` (default: claude)       |
