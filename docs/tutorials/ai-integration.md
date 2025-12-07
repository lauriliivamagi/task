# AI Integration Tutorial

Learn how to use Task with AI coding assistants like Claude Code.

## Prerequisites

- Task installed ([Quick Start](quick-start.md))
- Claude Code or another AI assistant
- A few tasks in your database

## The Easy Way: Claude Code Skill

If you're using Claude Code, install the task-assistant skill for the simplest
experience:

```
/plugin marketplace add lauriliivamagi/task
/plugin install task-assistant@task
```

Then just ask naturally: "Add a task for the auth feature, due Friday"

See [How to Use the Claude Code Skill](../how-to/claude-code-skill.md) for
details.

The rest of this tutorial covers direct CLI integration for scripts, other AI
tools, or when you want explicit control.

---

## What You'll Build

By the end of this tutorial, you'll use AI to:

1. Create multiple tasks from a single prompt
2. Search tasks by meaning
3. Generate a task workspace for focused work

## Part 1: Batch Create Tasks from AI

AI assistants can create multiple tasks at once using JSON.

### Step 1: Ask your AI to generate tasks

Give Claude Code a prompt like:

```
I need to implement user authentication. Generate a task list for me in
JSON format that I can use with `task batch-add`.
```

### Step 2: Pipe the output to Task

The AI will output JSON like:

```json
{
  "tasks": [
    {
      "title": "Set up auth middleware",
      "priority": 2,
      "tags": ["auth", "backend"]
    },
    {
      "title": "Create login endpoint",
      "subtasks": [
        { "title": "Validate credentials" },
        { "title": "Generate JWT token" },
        { "title": "Set refresh token cookie" }
      ]
    },
    {
      "title": "Add password hashing",
      "tags": ["security"]
    }
  ]
}
```

Save it to a file and import:

```bash
task batch-add --file tasks.json
```

Or pipe directly:

```bash
echo '{"tasks":[{"title":"Quick task"}]}' | task batch-add
```

### Step 3: Verify the import

```bash
task list
```

You'll see all tasks created with their subtasks intact.

## Part 2: Semantic Search

Find tasks by meaning, not just keywords.

### Step 1: Set up embeddings

Configure an embedding provider (Ollama for local, or OpenAI/Gemini):

```bash
export EMBEDDING_PROVIDER=ollama
```

### Step 2: Generate embeddings for existing tasks

```bash
task embeddings backfill
```

### Step 3: Search by meaning

```bash
task list --semantic "security vulnerabilities"
```

This finds tasks related to security even if they don't contain those exact
words.

Ask your AI assistant to search for you:

```
Find all tasks related to user authentication issues.
```

The AI can run:

```bash
task list --semantic "user authentication issues" --json
```

## Part 3: Create a Workspace

Use `task work` to create a focused workspace for a task.

### Step 1: Pick a task

```bash
task list
# Note the ID of a task you want to work on
```

### Step 2: Create the workspace

```bash
task work 42
```

This creates:

```
~/git/42-implement-auth/
├── README.md           # Task context for you
├── CLAUDE.md           # Instructions for AI assistants
├── input/              # Reference materials
│   └── .task-ref.json  # Link back to task
└── output/             # Place deliverables here
```

### Step 3: Work with your AI

The `CLAUDE.md` file contains task context that Claude Code reads automatically.
Your AI assistant now understands:

- What the task is
- Its priority and due date
- Related subtasks
- Any attached files

## Part 4: Share Task Context

Use `task share` to give AI assistants full task context.

### Step 1: Generate a shareable prompt

```bash
task share 42
```

Output:

```
## Task: Implement user authentication

**Status:** in-progress
**Priority:** High
**Due:** 2025-12-15

### Description
Set up JWT-based authentication for the API...

### Subtasks
- [ ] Set up auth middleware
- [ ] Create login endpoint
- [ ] Add password hashing
```

### Step 2: Use with AI

Copy the output into your AI conversation, or use JSON for programmatic access:

```bash
task share 42 --raw
```

## What You've Accomplished

You can now:

- Batch create tasks from AI-generated JSON
- Search tasks by semantic meaning
- Create focused workspaces for AI-assisted work
- Share task context with AI assistants

## Next Steps

- [How to Set Up Semantic Search](../how-to/semantic-search.md) — Provider
  options
- [CLI Reference](../reference/cli.md) — All commands
- [Architecture](../explanation/architecture.md) — How it all works
