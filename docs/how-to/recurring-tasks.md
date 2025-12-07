# How to Create Recurring Tasks

Set up tasks that automatically recreate themselves on a schedule.

## Create a recurring task

```bash
task add "Weekly review" --recurrence "every Monday"
```

## Supported patterns

| Pattern          | Example                                        |
| ---------------- | ---------------------------------------------- |
| Daily            | `daily`, `every day`                           |
| Weekly           | `weekly`, `every week`                         |
| Specific days    | `every Monday`, `every Mon,Wed,Fri`            |
| Monthly          | `monthly`, `1st of month`, `last day of month` |
| Yearly           | `yearly`, `every year`                         |
| Custom intervals | `every 2 weeks`, `every 3 months`              |

## Add recurrence to an existing task

```bash
task update 42 --recurrence "every 2 weeks"
```

## Remove recurrence

```bash
task update 42 --clear-recurrence
```

## How it works

When you complete a recurring task:

1. A new task is created with the same title, description, priority, project,
   and tags
2. The due date is calculated based on the recurrence pattern
3. Any subtasks are recreated with "todo" status
4. The recurrence rule is copied to the new task

## Set recurrence in the TUI

1. Press `Tab` to switch to detail view
2. Press `r` to edit recurrence
3. Type your pattern (e.g., "every Monday")
4. Press `Enter` to save
