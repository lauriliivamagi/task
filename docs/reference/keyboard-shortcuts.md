# Keyboard Shortcuts Reference

Complete list of keyboard shortcuts for the TUI.

## List View

| Key       | Action                          |
| --------- | ------------------------------- |
| `j` / `↓` | Move selection down             |
| `k` / `↑` | Move selection up               |
| `n`       | Create new task                 |
| `o`       | Create subtask of selected task |
| `e`       | Edit task title                 |
| `x`       | Toggle done/todo status         |
| `p`       | Toggle in-progress status       |
| `y`       | Copy task to clipboard          |
| `w`       | Create workspace and start work |
| `Shift+J` | Move task down in list          |
| `Shift+K` | Move task up in list            |
| `Shift+R` | Refresh tasks                   |
| `/`       | Open search                     |
| `-`       | Delete task (with confirmation) |
| `Tab`     | Switch to detail view           |
| `Enter`   | View task details               |

## Detail View

| Key       | Action                  |
| --------- | ----------------------- |
| `e`       | Edit title              |
| `d`       | Edit description        |
| `c`       | Add comment             |
| `s`       | Change status           |
| `p`       | Change priority         |
| `o`       | Change project          |
| `u`       | Change due date         |
| `t`       | Edit tags               |
| `r`       | Edit recurrence         |
| `a`       | Add attachment          |
| `Shift+G` | Sync to Google Calendar |
| `Tab`     | Switch to list view     |
| `Escape`  | Cancel current action   |

## Global

| Key       | Action               |
| --------- | -------------------- |
| `q`       | Quit                 |
| `?`       | Show help            |
| `Shift+P` | Open command palette |

## Search Mode

| Key      | Action         |
| -------- | -------------- |
| `Enter`  | Execute search |
| `Escape` | Cancel search  |

## Input Mode

| Key      | Action       |
| -------- | ------------ |
| `Enter`  | Submit input |
| `Escape` | Cancel input |
| `Ctrl+u` | Clear input  |

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

See [How to Customize TUI Keyboard Shortcuts](../how-to/customize-tui.md) for
details.
