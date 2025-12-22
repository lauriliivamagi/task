# CLI Reference

Complete command reference for Task. For a quick start, see the
[README](../README.md).

## Global Options

All commands support these options:

| Option           | Description                |
| ---------------- | -------------------------- |
| `--json`         | Output in JSON format      |
| `--attach <url>` | Connect to external server |
| `--help`         | Show help for command      |
| `--version`      | Show version number        |

---

## Task Commands

### `task add <title> [description]`

Create a new task.

```bash
task add "Buy groceries" --project "Personal" --due "2025-12-31"
task add "Fix login bug" --tag bug --tag auth
task add "Submit report" --due "next friday"
```

| Option                 | Description                                  |
| ---------------------- | -------------------------------------------- |
| `-p, --project <name>` | Assign to project (creates if doesn't exist) |
| `-P, --parent <id>`    | Set as subtask of another task               |
| `-d, --due <date>`     | Set due date (ISO 8601 or natural language)  |
| `-t, --tag <name>`     | Add tag (can be used multiple times)         |
| `-r, --recurrence`     | Set recurrence pattern                       |

### `task list`

List tasks with optional filtering.

```bash
task list                              # Active tasks
task list -a                           # All tasks including done
task list -q "groceries"               # Text search
task list --overdue                    # Overdue tasks
task list --status in-progress         # Filter by status
task list --priority 2                 # Filter by priority
task list --tag bug                    # Filter by tag
task list -s "API integration" -n 5    # Semantic search
```

| Option                   | Description                                          |
| ------------------------ | ---------------------------------------------------- |
| `-a, --all`              | Show all tasks including completed                   |
| `-p, --project <name>`   | Filter by project                                    |
| `-t, --tag <name>`       | Filter by tag                                        |
| `-q, --search <text>`    | Search in title and description                      |
| `--due-before <date>`    | Tasks due before date (YYYY-MM-DD)                   |
| `--due-after <date>`     | Tasks due after date (YYYY-MM-DD)                    |
| `--overdue`              | Show only overdue tasks                              |
| `--priority <level>`     | Filter by priority: 0 (Normal), 1 (High), 2 (Urgent) |
| `--status <status>`      | Filter by status: todo, in-progress, done            |
| `-s, --semantic <query>` | Semantic search (requires embedding provider)        |
| `-n, --limit <number>`   | Limit results (default: 10)                          |

### `task view <id>`

View task details including subtasks, comments, and attachments.

```bash
task view 42
task view 42 --json
```

### `task update <id>`

Update a task.

```bash
task update 1 --status done
task update 1 --title "New title"
task update 42 --project "Work"
task update 42 --recurrence "every Monday"
task update 42 --clear-recurrence
task update 42 --clear-project
```

| Option                     | Description                                    |
| -------------------------- | ---------------------------------------------- |
| `-t, --title <title>`      | Set new title                                  |
| `-D, --description <desc>` | Set new description                            |
| `-s, --status <status>`    | Set status: todo, in-progress, done            |
| `-p, --priority <level>`   | Set priority: 0 (Normal), 1 (High), 2 (Urgent) |
| `-d, --due <date>`         | Set due date                                   |
| `--project <name>`         | Move task to project (creates if needed)       |
| `--clear-project`          | Remove task from its project                   |
| `-r, --recurrence <rule>`  | Set recurrence pattern                         |
| `--clear-recurrence`       | Remove recurrence                              |

### `task delete <id>`

Delete a task and its subtasks (cascade delete). Use bulk delete for single or
multiple tasks:

```bash
task bulk delete 42 --yes        # Delete single task
task bulk delete 1 2 3 --yes     # Delete multiple tasks
```

### `task comment <id> <content>`

Add a comment to a task.

```bash
task comment 1 "Purchased organic vegetables"
```

### `task attach <id> <filepath>`

Attach a file to a task.

```bash
task attach 1 ./receipt.pdf
```

---

## Bulk Operations

### `task bulk update <ids...>`

Update multiple tasks at once.

```bash
task bulk update 1 2 3 --status done
task bulk update 1 2 3 --priority 2
```

| Option                   | Description                                    |
| ------------------------ | ---------------------------------------------- |
| `-s, --status <status>`  | Set status: todo, in-progress, done            |
| `-p, --priority <level>` | Set priority: 0 (Normal), 1 (High), 2 (Urgent) |

### `task bulk delete <ids...>`

Delete multiple tasks at once.

```bash
task bulk delete 4 5 6 --yes
```

| Option      | Description       |
| ----------- | ----------------- |
| `-y, --yes` | Skip confirmation |

### `task complete-subtasks <id>`

Mark all subtasks of a task as done.

```bash
task complete-subtasks 1
```

---

## Batch Operations

### `task batch-add`

Create multiple tasks with subtasks in a single operation.

```bash
task batch-add --file tasks.json
echo '{"tasks":[...]}' | task batch-add
```

| Option       | Description               |
| ------------ | ------------------------- |
| `-f, --file` | Read JSON input from file |

**Input format:**

```json
{
  "tasks": [
    {
      "title": "Main task",
      "description": "Optional description",
      "project": "ProjectName",
      "due_date": "2025-12-31",
      "due_date_natural": "next friday",
      "priority": 1,
      "tags": ["bug", "auth"],
      "context": {
        "files": [{ "path": "/src/auth.ts", "line_start": 10 }],
        "tags": ["auth", "security"]
      },
      "subtasks": [
        { "title": "Subtask 1" },
        { "title": "Subtask 2", "priority": 2 }
      ]
    }
  ]
}
```

---

## Tag Management

### `task tag list`

List all tags with usage counts.

### `task tag add <taskId> <tags...>`

Add one or more tags to a task.

```bash
task tag add 1 bug priority
```

### `task tag remove <taskId> <tag>`

Remove a tag from a task.

```bash
task tag remove 1 priority
```

### `task tag rename <tagId> <newName>`

Rename a tag by ID.

```bash
task tag rename 3 "high-priority"
```

### `task tag delete <tagId>`

Delete a tag.

```bash
task tag delete 3
```

---

## Project Management

### `task project list`

List all projects.

### `task project create <name>`

Create a new project.

---

## Database Management

### `task db list`

List all databases with task/project counts.

### `task db create <name>`

Create a new database. Names must be lowercase with numbers, hyphens, or
underscores.

### `task db use <name>`

Switch to a different database.

### `task db current`

Show the active database.

### `task db rename <old> <new>`

Rename a database.

### `task db delete <name>`

Delete a database (with confirmation).

---

## Embeddings & Semantic Search

### `task embeddings status`

Show embedding coverage statistics for tasks and comments.

### `task embeddings backfill`

Generate embeddings for all tasks that don't have them.

### `task embeddings provider`

Show current embedding provider configuration.

**Semantic search usage:**

```bash
task list --semantic "tasks about API integration"
task list -s "bug fixes" --limit 5
```

---

## Google Calendar Integration

### `task gcal auth`

Authenticate with Google (OAuth 2.0).

### `task gcal status`

Check authentication status.

### `task gcal logout`

Clear stored credentials.

### `task gcal calendars`

List available calendars.

### `task gcal sync <taskId>`

Sync a task to Google Calendar.

```bash
task gcal sync 42                    # Use due_date, 1 hour duration
task gcal sync 42 --duration 2       # Custom duration
task gcal sync 42 --calendar "Work"  # Specific calendar
task gcal sync 42 --date "tomorrow 14:00" --duration 1.5  # Override date
```

| Option                  | Description                             |
| ----------------------- | --------------------------------------- |
| `-d, --duration <hrs>`  | Event duration in hours (default: 1)    |
| `-c, --calendar <name>` | Target calendar name (default: primary) |
| `--date <datetime>`     | Override due date (natural language)    |

### `task gcal use <calendar-id>`

Set default calendar for future syncs.

---

## Git Sync

### `task sync init [remote-url]`

Initialize git repo in ~/.task-cli/ for syncing.

### `task sync status`

Check sync status (branch, remote, ahead/behind).

### `task sync push [-m <message>]`

Commit and push changes.

### `task sync pull [--force]`

Pull changes from remote.

---

## Workspace Automation

### `task work <id>`

Create a workspace for a task and start working.

```bash
task work 42                      # Create workspace, open IDE
task work 42 --template python    # Use specific template
task work 42 --name my-project    # Custom directory name
task work 42 --no-open            # Create but don't open IDE
task work 42 --open               # Open existing workspace
task work --list-templates        # Show available templates
```

| Option                  | Description                              |
| ----------------------- | ---------------------------------------- |
| `-t, --template <name>` | Use specific workspace template          |
| `-n, --name <name>`     | Custom workspace name (default: id-slug) |
| `--no-open`             | Create workspace but don't open IDE      |
| `-o, --open`            | Open existing workspace in IDE           |
| `--list-templates`      | List available workspace templates       |

**Generated workspace structure:**

```
~/git/42-fix-auth-bug/
├── .git/
├── README.md           # Task context for humans
├── CLAUDE.md           # Instructions for AI assistants
├── input/              # Attachments and reference materials
│   └── .task-ref.json  # Bidirectional link back to task
└── output/             # Place deliverables here
```

---

## Task Sharing

### `task share <id>`

Output a formatted prompt for sharing with AI agents.

```bash
task share 42                    # Default template
task share 42 --template work    # Custom template
task share 42 --raw              # Raw JSON
task share --list-templates      # List templates
```

| Option                  | Description                                    |
| ----------------------- | ---------------------------------------------- |
| `-t, --template <name>` | Use named template from ~/.task-cli/templates/ |
| `--raw`                 | Output raw JSON instead of formatted prompt    |
| `--list-templates`      | List available templates                       |

---

## Reports

### `task report`

Generate activity reports.

```bash
task report --period week      # Current calendar week
task report --period month     # Current calendar month
task report --period quarter   # Current calendar quarter
task report --from 2025-01-01 --to 2025-01-31  # Custom range
task report --period week --project "My Project"  # Filter by project
task report --period week --json  # JSON output
```

| Option              | Description             |
| ------------------- | ----------------------- |
| `--period <period>` | week, month, or quarter |
| `--from <date>`     | Start date (YYYY-MM-DD) |
| `--to <date>`       | End date (YYYY-MM-DD)   |
| `--project <name>`  | Filter by project       |

---

## Statistics

### `task stats`

Show task statistics including counts by status, priority, and project.

---

## Server & Modes

### `task serve`

Start the HTTP API server.

```bash
task serve --port 3000
```

| Option                | Description                              |
| --------------------- | ---------------------------------------- |
| `--port <number>`     | Port to listen on (default: 3000)        |
| `--hostname <string>` | Hostname to bind to (default: 127.0.0.1) |

### `task tui`

Start the interactive terminal UI.

```bash
task tui
task tui --attach http://localhost:3000
```

| Option            | Description                              |
| ----------------- | ---------------------------------------- |
| `--attach <url>`  | Connect to external server               |
| `--port <number>` | Port for local server (if not attaching) |

---

## Maintenance

### `task truncate`

Delete all data from the database.

| Option  | Description              |
| ------- | ------------------------ |
| `--yes` | Skip confirmation prompt |

### `task upgrade`

Check for and install updates.

```bash
task upgrade           # Check and install latest version
task upgrade --check   # Only check, don't install
```

---

## Connecting to External Server

CLI commands can connect to an existing server:

```bash
task list --attach http://localhost:3000
task add "Remote task" --attach http://localhost:3000
```
