# Setup Guide

This guide covers one-time setup procedures for task-assistant features.

## Semantic Search Setup

Configure an embedding provider for AI-powered similarity search:

```bash
# Check provider status
task embeddings provider

# Generate embeddings for existing tasks
task embeddings backfill
```

### Environment Variables

Set one of these provider configurations:

```bash
# Option 1: Ollama (local, free)
EMBEDDING_PROVIDER=ollama
OLLAMA_URL=http://localhost:11434

# Option 2: OpenAI
EMBEDDING_PROVIDER=openai
OPENAI_API_KEY=sk-...

# Option 3: Gemini
EMBEDDING_PROVIDER=gemini
GEMINI_API_KEY=...
```

Once configured, use semantic search:

```bash
task list --semantic "bug fixes related to authentication"
```

## Google Calendar Integration

Sync tasks to Google Calendar (one-way: tasks → calendar events).

### Initial Setup

1. Create a Google Cloud project at https://console.cloud.google.com
2. Enable the Google Calendar API
3. Create OAuth 2.0 credentials (Desktop app type)
4. Run `task gcal auth` and enter your Client ID and Secret

### Commands

```bash
# Authenticate with Google
task gcal auth

# Check authentication status
task gcal status

# List available calendars
task gcal calendars

# Set default calendar for all future syncs
task gcal use <calendar-id>

# Logout (clear tokens)
task gcal logout
```

### Syncing Tasks

```bash
# Sync a task to calendar (uses due_date as event start, 1h default)
task gcal sync 42

# Sync with custom duration (hours)
task gcal sync 42 --duration 2

# Sync to specific calendar
task gcal sync 42 --calendar "Work"
```

Tasks require a `due_date` to be synced. The event duration defaults to 1 hour.
