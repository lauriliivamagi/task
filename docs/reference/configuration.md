---
type: reference
domain: clear
audience: practitioner
stability: structural
authority:
  provenance: institutional
  verifiability: auditable
  evidence: moderate
  currency: undated
epistemic-layer: practice
---

# Configuration Reference

Task stores configuration in `~/.task-cli/config.json`.

## File Locations

| Path                                         | Purpose                                 |
| -------------------------------------------- | --------------------------------------- |
| `~/.task-cli/config.json`                    | Main configuration                      |
| `~/.task-cli/databases/`                     | SQLite databases (one directory per db) |
| `~/.task-cli/databases/<name>/data.db`       | Task data (synced by `task sync`)       |
| `~/.task-cli/databases/<name>/embeddings.db` | Vector index (git-ignored, rebuildable) |
| `~/.task-cli/logs/`                          | Daily rotated logs                      |
| `~/.task-cli/templates/`                     | Task sharing templates                  |
| `~/.task-cli/workspace-templates/`           | Built-in workspace templates            |
| `~/.task-cli/secrets.json`                   | OAuth tokens, mode 0600 (git-ignored)   |

If `config.json` contains invalid JSON, Task warns on stderr and runs with
defaults (including `activeDb: "default"`); commands that would rewrite the file
refuse to overwrite it until the JSON is fixed.

## Configuration Options

### Log Level

```json
{
  "logLevel": "info",
  "logFormat": "json"
}
```

`logLevel` values: `debug`, `info`, `warn`, `error`. `logFormat` values: `json`
(default) or `pretty`.

### Active Database

```json
{
  "activeDb": "work"
}
```

Set via `task db use <name>`.

### Workspace Settings

```json
{
  "work": {
    "repos_dir": "~/git",
    "ide_command": "claude",
    "templates": [
      {
        "name": "Knowledge Work",
        "path": "/home/user/git/knowledge-template",
        "description": "Template for research and writing"
      },
      {
        "name": "Software",
        "path": "/home/user/git/software-template"
      }
    ]
  }
}
```

| Option             | Default                     | Description                                    |
| ------------------ | --------------------------- | ---------------------------------------------- |
| `repos_dir`        | `~/git`                     | Where workspaces are created                   |
| `ide_command`      | `claude`                    | Command to open IDE                            |
| `ide_args`         | `["-n"]`                    | Arguments passed to the IDE command            |
| `naming`           | `{{task.id}}-{{task.slug}}` | Workspace directory naming pattern             |
| `auto_commit`      | `true`                      | Commit the initial workspace contents          |
| `default_template` | `default`                   | Built-in template used when none is specified  |
| `templates`        | `undefined`                 | External workspace templates (see table below) |

**Template entry fields:**

| Field         | Required | Description                         |
| ------------- | -------- | ----------------------------------- |
| `name`        | Yes      | Display name in the template picker |
| `path`        | Yes      | Absolute path to template directory |
| `description` | No       | Description shown in picker         |

See [How to Use Workspace Templates](../how-to/workspace-templates.md) for
details.

### Git Sync

```json
{
  "sync": {
    "auto": true,
    "remote": "git@github.com:user/task-data.git"
  }
}
```

| Option   | Default     | Description                          |
| -------- | ----------- | ------------------------------------ |
| `auto`   | `false`     | Enable auto-sync on startup/shutdown |
| `remote` | `undefined` | Git remote URL for `task sync`       |

### Google Calendar

```json
{
  "gcal": {
    "calendar_id": "primary",
    "default_duration_hours": 1
  }
}
```

| Option                   | Default   | Description                       |
| ------------------------ | --------- | --------------------------------- |
| `calendar_id`            | `primary` | Default calendar for sync         |
| `default_duration_hours` | `1`       | Event duration when task has none |

Set the calendar with `task gcal use <calendar-id>` rather than editing the file
by hand.

### TUI Keybindings

```json
{
  "keybindings": {
    "listView": {},
    "detailView": {},
    "global": {}
  }
}
```

See [How to Customize TUI Keyboard Shortcuts](../how-to/customize-tui.md).

## Environment Variables

Environment variables override configuration file settings.

### Core

| Variable                | Description                           |
| ----------------------- | ------------------------------------- |
| `TASK_CLI_DB_URL`       | SQLite database URL                   |
| `TASK_CLI_LOG_DISABLED` | Disable file logging (`1` to disable) |
| `TASK_CLI_LOG_LEVEL`    | Log level override                    |
| `TASK_CLI_LOG_FORMAT`   | Log format: `json` or `pretty`        |

### Workspaces

| Variable               | Description                 |
| ---------------------- | --------------------------- |
| `TASK_CLI_REPOS_DIR`   | Override `work.repos_dir`   |
| `TASK_CLI_IDE_COMMAND` | Override `work.ide_command` |

### Embeddings

| Variable                     | Description                                           |
| ---------------------------- | ----------------------------------------------------- |
| `EMBEDDING_PROVIDER`         | Provider: `ollama`, `openai`, or `gemini`             |
| `OLLAMA_URL`                 | Ollama server URL (default: `http://localhost:11434`) |
| `TASK_CLI_OLLAMA_MODEL`      | Ollama model (default: `nomic-embed-text`)            |
| `OPENAI_API_KEY`             | OpenAI API key                                        |
| `TASK_CLI_OPENAI_MODEL`      | OpenAI model (default: `text-embedding-3-small`)      |
| `GEMINI_API_KEY`             | Google Gemini API key                                 |
| `TASK_CLI_GEMINI_DIMENSIONS` | Gemini output dimensions (default: 768)               |

`TASK_CLI_EMBEDDING_PROVIDER` and `TASK_CLI_OLLAMA_URL` are accepted as prefixed
alternatives and take precedence over the short names.

### Google Calendar Credentials

| Variable             | Description                           |
| -------------------- | ------------------------------------- |
| `GCAL_CLIENT_ID`     | OAuth client ID                       |
| `GCAL_CLIENT_SECRET` | OAuth client secret                   |
| `GCAL_AUTH_PORT`     | OAuth callback port (default: `8484`) |

## Example Configuration

```json
{
  "logLevel": "info",
  "activeDb": "default",
  "work": {
    "repos_dir": "~/projects",
    "ide_command": "code",
    "templates": [
      {
        "name": "Knowledge Work",
        "path": "/home/user/git/knowledge-template",
        "description": "Research and writing"
      },
      {
        "name": "Software",
        "path": "/home/user/git/software-template"
      }
    ]
  },
  "sync": {
    "auto": true
  },
  "gcal": {
    "calendar_id": "work@group.calendar.google.com",
    "default_duration_hours": 1
  },
  "keybindings": {
    "listView": {
      "Ctrl+n": "createTask"
    },
    "global": {
      "Ctrl+q": "quit"
    }
  }
}
```
