# Advanced Features

This reference covers advanced task-assistant capabilities beyond core
operations.

## Context Metadata

Attach rich metadata when creating tasks via API or batch-add:

```json
{
  "title": "Fix auth bug",
  "context": {
    "files": [{ "path": "/src/auth.ts", "line_start": 45 }],
    "urls": [
      {
        "url": "https://github.com/org/repo/issues/123",
        "type": "github-issue"
      }
    ],
    "git": { "branch": "fix/auth", "commit": "abc123" },
    "tags": ["bug", "security"]
  }
}
```

## Workspace Automation

Create a ready-to-work git repository from a task:

```bash
task work <id>                    # Create workspace and open IDE
task work <id> --template python  # Use specific template
task work <id> --name my-project  # Custom directory name
task work <id> --no-open          # Create but don't open IDE
task work <id> --open             # Open existing workspace
task work --list-templates        # Show available templates
```

Generated workspace structure:

```
~/git/42-fix-auth-bug/
├── README.md           # Task context for humans
├── CLAUDE.md           # Instructions for AI assistants
├── input/              # Attachments and .task-ref.json
└── output/             # Place deliverables here
```

The task context is automatically updated with the workspace path, enabling
bidirectional linking.

## Task Sharing

Export tasks as formatted prompts for AI context:

```bash
task share <id>              # Default template
task share <id> --raw        # Raw JSON
task share <id> --template work  # Custom template from ~/.task-cli/templates/
```

## Multi-Database Support

Separate your tasks into different databases for context separation (work, home,
projects):

```bash
task db list             # List all databases with task counts
task db create work      # Create a new database
task db use work         # Switch to 'work' database
task db current          # Show active database
task db rename old new   # Rename a database
task db delete old       # Delete a database (with confirmation)
```

Each database is isolated with its own tasks, projects, attachments, and TUI
state.

## Activity Reports

Generate reports showing task activity over time periods (useful for standups,
weekly reports, or AI agent summaries):

```bash
task report --period week      # Current calendar week (Mon-Sun)
task report --period month     # Current calendar month
task report --period quarter   # Current calendar quarter (Q1-Q4)

# Custom date range
task report --from 2025-01-01 --to 2025-01-31

# Filter by project
task report --period week --project "Backend"

# JSON output for AI agents
task report --period week --json
```

**Report sections:**

- **Completed**: Tasks marked done during the period (uses `completed_at`
  timestamp)
- **In Progress**: Tasks actively worked on during the period
- **Added**: Tasks created during the period

The `completed_at` timestamp is automatically set when a task's status changes
to "done" and cleared if the status changes back.

## Recurring Tasks

Create tasks that automatically repeat on a schedule:

```bash
# Create recurring tasks
task add "Daily standup" --recurrence "every day"
task add "Weekly review" -r "every Monday"
task add "Monthly report" -r "1st of month"

# Update recurrence on existing task
task update 42 --recurrence "every 2 weeks"

# Remove recurrence
task update 42 --clear-recurrence
```

**Supported patterns:**

- **Daily**: `daily`, `every day`, `every 3 days`
- **Weekly**: `weekly`, `biweekly`, `every Monday`, `every Mon, Wed, Fri`
- **Monthly**: `monthly`, `1st of month`, `last day of month`,
  `first Monday of month`
- **Yearly**: `yearly`, `annually`, `every 2 years`

**Behavior:**

- Only top-level tasks (not subtasks) can have recurrence
- When a recurring task is marked done, a new task is automatically created with
  the same properties
- The new task's due date is calculated from the original due date + interval
- All subtasks are recreated with "todo" status
- The API returns `recurring_next_task_id` when completing a recurring task

## Other Commands

```bash
task stats                    # Task counts by status/priority/project
task complete-subtasks <id>   # Mark all subtasks done
task serve --port 3000        # Run HTTP API server
```
