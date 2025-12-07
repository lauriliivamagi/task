# How to Use the Claude Code Skill

Use Task through natural language in Claude Code.

## What is a Skill?

Skills are instruction packages that Claude loads dynamically. When you ask
about tasks, Claude automatically loads the task-assistant skill and knows how
to use the CLI on your behalf.

## Prerequisites

- Task installed and in PATH (`task --version` should work)
- Claude Code (CLI or IDE extension)

## Installation

### From This Repository

```
/plugin marketplace add lauriliivamagi/task
/plugin install task-assistant@task
```

### Verify Installation

```
/plugins
```

You should see `task-assistant` listed.

## Usage Examples

### Creating Tasks

Simply describe what you need:

- "Add a task to fix the login bug, high priority"
- "Create three tasks for the auth feature: setup middleware, create endpoints,
  add tests"
- "Add a recurring task for weekly standup every Monday at 9am"

### Querying Tasks

- "What are my overdue tasks?"
- "Show tasks in the Backend project"
- "Find tasks related to authentication" (uses semantic search)

### Updating Tasks

- "Mark task 42 as done"
- "Set task 15 to in-progress"
- "Move task 8 to the Frontend project"

### Reports

- "What did I complete this week?"
- "Generate a report for the last month"

## How It Works

1. You ask Claude about tasks
2. Claude recognizes the intent and loads the skill
3. The skill provides CLI command patterns
4. Claude executes commands and reports results

The skill uses progressive disclosure — only loading detailed references when
needed for complex operations.

## Troubleshooting

**Claude doesn't recognize task commands**

Ensure the plugin is installed: `/plugins`

**Commands fail**

Verify `task` is in your PATH: `which task`

## See Also

- [Quick Start](../tutorials/quick-start.md) — Install Task
- [AI Integration Tutorial](../tutorials/ai-integration.md) — Manual CLI
  integration
- [CLI Reference](../reference/cli.md) — All commands
