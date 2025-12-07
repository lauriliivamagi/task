# TUI Reference

Launch the terminal UI for keyboard-driven task management:

```bash
task tui
```

## Keyboard Shortcuts

Shortcuts can be customized via `~/.task-cli/config.json` (see CLAUDE.md for
details).

### Global

| Key       | Action              |
| --------- | ------------------- |
| `Shift+P` | Command palette     |
| `?`       | Toggle help overlay |
| `q`       | Quit                |
| `Escape`  | Cancel / Close      |

### List Panel

| Key       | Action                        |
| --------- | ----------------------------- |
| `j / ↓`   | Move down                     |
| `k / ↑`   | Move up                       |
| `e`       | Edit title inline             |
| `n`       | New task                      |
| `o`       | Add subtask                   |
| `x`       | Toggle done                   |
| `p`       | Toggle progress               |
| `w`       | Start work (create workspace) |
| `y`       | Yank (copy task as prompt)    |
| `Shift+J` | Move task down                |
| `Shift+K` | Move task up                  |
| `/`       | Search                        |
| `Shift+R` | Refresh                       |
| `Enter`   | View task details             |
| `Tab`     | Switch to detail panel        |

### Detail Panel

| Key       | Action                        |
| --------- | ----------------------------- |
| `h / ←`   | Switch to list panel          |
| `e`       | Edit title                    |
| `d`       | Edit description              |
| `c`       | Add comment                   |
| `s`       | Change status                 |
| `p`       | Change priority               |
| `o`       | Change project                |
| `u`       | Change due date               |
| `t`       | Edit tags                     |
| `r`       | Edit recurrence               |
| `a`       | Attach file                   |
| `Shift+D` | Edit duration                 |
| `Shift+G` | Sync to Google Calendar       |
| `w`       | Start work (create workspace) |
| `y`       | Yank (copy task as prompt)    |
| `Tab`     | Switch to list panel          |

### Search Mode

| Key      | Action         |
| -------- | -------------- |
| `Enter`  | Execute search |
| `Escape` | Cancel search  |

### Input Mode

| Key      | Action       |
| -------- | ------------ |
| `Enter`  | Submit input |
| `Escape` | Cancel input |
| `Ctrl+u` | Clear input  |

### Text Input Navigation

| Key       | Action        |
| --------- | ------------- |
| `←` / `→` | Move cursor   |
| `Ctrl+A`  | Jump to start |
| `Ctrl+E`  | Jump to end   |

## Customization

Override shortcuts in `~/.task-cli/config.json`:

```json
{
  "keybindings": {
    "listView": {
      "Ctrl+n": "createTask",
      "Ctrl+d": "deleteTask"
    },
    "detailView": {
      "Ctrl+s": "changeStatus"
    },
    "global": {
      "Ctrl+q": "quit"
    }
  }
}
```

## Google Calendar Sync

When pressing `Shift+G` in detail view, a duration overlay appears. Enter hours
(default: 1), then press Enter to sync the task to your calendar.
