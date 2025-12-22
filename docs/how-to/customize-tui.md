# How to Customize TUI Keyboard Shortcuts

Change keyboard shortcuts in the terminal UI to match your workflow.

## Edit the configuration

Open `~/.task-cli/config.json` and add a `keybindings` section:

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

## Available key formats

| Format      | Example              |
| ----------- | -------------------- |
| Single key  | `n`, `x`, `e`        |
| Shift + key | `Shift+J`, `Shift+K` |
| Ctrl + key  | `Ctrl+n`, `Ctrl+s`   |

## List View actions

| Action           | Default   | Description           |
| ---------------- | --------- | --------------------- |
| `moveUp`         | `k`       | Move selection up     |
| `moveDown`       | `j`       | Move selection down   |
| `createTask`     | `n`       | Create new task       |
| `createSubtask`  | `o`       | Create subtask        |
| `editTitle`      | `e`       | Edit task title       |
| `toggleDone`     | `x`       | Toggle done status    |
| `toggleProgress` | `p`       | Toggle in-progress    |
| `yankTask`       | `y`       | Copy to clipboard     |
| `startWork`      | `w`       | Create workspace      |
| `moveTaskUp`     | `Shift+K` | Reorder task up       |
| `moveTaskDown`   | `Shift+J` | Reorder task down     |
| `refresh`        | `Shift+R` | Refresh tasks         |
| `startSearch`    | `/`       | Open search           |
| `deleteTask`     | `-`       | Delete task           |
| `switchPanel`    | `Tab`     | Switch to detail view |

## Detail View actions

| Action            | Default   | Description             |
| ----------------- | --------- | ----------------------- |
| `editTitle`       | `e`       | Edit title              |
| `editDescription` | `d`       | Edit description        |
| `addComment`      | `c`       | Add comment             |
| `changeStatus`    | `s`       | Change status           |
| `changePriority`  | `p`       | Change priority         |
| `changeProject`   | `o`       | Change project          |
| `changeDueDate`   | `u`       | Change due date         |
| `editTags`        | `t`       | Edit tags               |
| `editRecurrence`  | `r`       | Edit recurrence         |
| `addAttachment`   | `a`       | Add attachment          |
| `syncToCalendar`  | `Shift+G` | Sync to Google Calendar |
| `switchPanel`     | `Tab`     | Switch to list view     |

## Global actions

| Action           | Default   | Description          |
| ---------------- | --------- | -------------------- |
| `quit`           | `q`       | Quit the TUI         |
| `help`           | `?`       | Show help            |
| `commandPalette` | `Shift+P` | Open command palette |

## View current shortcuts

In the TUI, press `?` to see all active shortcuts.
