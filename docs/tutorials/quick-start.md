# Quick Start

Get up and running with Task in 5 minutes.

## Prerequisites

- A terminal (macOS, Linux, or WSL on Windows)
- Internet connection (for installation)

## Step 1: Install Task

Download the binary for your platform:

```bash
# Linux x86_64
curl -L https://github.com/lauriliivamagi/task/releases/latest/download/task-linux-x86_64 -o task
chmod +x task
sudo mv task /usr/local/bin/
```

Verify the installation:

```bash
task --version
```

You should see output like `task 1.x.x`.

## Step 2: Create Your First Task

```bash
task add "Learn Task"
```

Output:

```
Created task #1: Learn Task
```

## Step 3: View Your Tasks

```bash
task list
```

Output:

```
ID   Title           Status   Priority   Due   Project
──────────────────────────────────────────────────────
1    Learn Task  todo     normal     -     -
```

## Step 4: Add More Details

Create a task with a due date and project:

```bash
task add "Review documentation" --due tomorrow --project Learning
```

Create a task with tags:

```bash
task add "Try the TUI" --tag tutorial --tag quick-start
```

List your tasks again:

```bash
task list
```

## Step 5: View Task Details

```bash
task view 1
```

This shows the full task with description, comments, subtasks, and metadata.

## Step 6: Update a Task

Mark your first task as in-progress:

```bash
task update 1 --status in-progress
```

## Step 7: Complete a Task

```bash
task update 1 --status done
```

Or use the shorter form:

```bash
task list  # Note the ID of the task you want to complete
task update 2 --status done
```

## Step 8: Launch the TUI

For a more interactive experience:

```bash
task tui
```

Navigate with:

- `j/k` or arrow keys to move
- `n` to create a new task
- `x` to toggle done
- `q` to quit

## What You've Accomplished

You can now:

- Install Task
- Create tasks with due dates, projects, and tags
- List and filter tasks
- View task details
- Update task status
- Use the terminal UI

## Next Steps

- [AI Integration Tutorial](ai-integration.md) — Use Task with Claude Code
- [CLI Reference](../reference/cli.md) — All commands and options
- [How to Set Up Semantic Search](../how-to/semantic-search.md) — Search by
  meaning
