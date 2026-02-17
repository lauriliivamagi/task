# Configuration Reference

Task stores configuration in `~/.task-cli/config.json`.

## File Locations

| Path                       | Purpose                    |
| -------------------------- | -------------------------- |
| `~/.task-cli/config.json`  | Main configuration         |
| `~/.task-cli/databases/`   | SQLite databases           |
| `~/.task-cli/logs/`        | Daily rotated logs         |
| `~/.task-cli/templates/`   | Task sharing templates     |
| `~/.task-cli/secrets.json` | OAuth tokens (git-ignored) |

## Configuration Options

### Log Level

```json
{
  "logLevel": "info"
}
```

Values: `debug`, `info`, `warn`, `error`

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

| Option        | Default     | Description                                    |
| ------------- | ----------- | ---------------------------------------------- |
| `repos_dir`   | `~/git`     | Where workspaces are created                   |
| `ide_command` | `claude`    | Command to open IDE                            |
| `templates`   | `undefined` | External workspace templates (see table below) |

**Template entry fields:**

| Field         | Required | Description                          |
| ------------- | -------- | ------------------------------------ |
| `name`        | Yes      | Display name in the template picker  |
| `path`        | Yes      | Absolute path to template directory  |
| `description` | No       | Description shown in picker          |

See [How to Use Workspace Templates](../how-to/workspace-templates.md) for
details.

### Git Sync

```json
{
  "sync": {
    "auto": true
  }
}
```

| Option | Default | Description                          |
| ------ | ------- | ------------------------------------ |
| `auto` | `false` | Enable auto-sync on startup/shutdown |

### Google Calendar

```json
{
  "gcal": {
    "defaultCalendar": "Work"
  }
}
```

| Option            | Default   | Description               |
| ----------------- | --------- | ------------------------- |
| `defaultCalendar` | `primary` | Default calendar for sync |

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

### Embeddings

| Variable             | Description                                           |
| -------------------- | ----------------------------------------------------- |
| `EMBEDDING_PROVIDER` | Provider: `ollama`, `openai`, or `gemini`             |
| `OLLAMA_URL`         | Ollama server URL (default: `http://localhost:11434`) |
| `OPENAI_API_KEY`     | OpenAI API key                                        |
| `GEMINI_API_KEY`     | Google Gemini API key                                 |

### Google Calendar

| Variable               | Description         |
| ---------------------- | ------------------- |
| `GOOGLE_CLIENT_ID`     | OAuth client ID     |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret |

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
    "defaultCalendar": "Work"
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
