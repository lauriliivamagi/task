# How to Use Workspace Templates

Configure external repository templates to customize workspace structure when
starting work on a task.

## Configure templates

Add a `templates` array to the `work` section of `~/.task-cli/config.json`:

```json
{
  "work": {
    "templates": [
      {
        "name": "Knowledge Work",
        "path": "/home/user/git/knowledge-template",
        "description": "Template for research and writing tasks"
      },
      {
        "name": "Software",
        "path": "/home/user/git/software-template",
        "description": "Template for coding projects"
      }
    ]
  }
}
```

| Field         | Required | Description                          |
| ------------- | -------- | ------------------------------------ |
| `name`        | Yes      | Display name shown in the picker     |
| `path`        | Yes      | Absolute path to the template folder |
| `description` | No       | Description shown when selected      |

## Pick a template in the TUI

Press `w` on a task to start work. If you have two or more templates configured,
a picker appears:

```
┌ Select Template ──────── Esc to cancel ┐
│                                        │
│ ▸ Knowledge Work                       │
│     Template for research and writing  │
│   Software                             │
│                                        │
│ ↑↓/jk navigate • Enter select          │
└────────────────────────────────────────┘
```

Navigate with `j`/`k` or arrow keys and press `Enter` to select.

## Auto-select behavior

| Templates configured | Behavior                                      |
| -------------------- | --------------------------------------------- |
| 0                    | Uses built-in workspace structure (unchanged) |
| 1                    | Auto-selects the single template              |
| 2+                   | Shows the template picker                     |

## Use a template from the CLI

```bash
task work 42 --template "Knowledge Work"
```

List available templates:

```bash
task work --list-templates
```

## What happens during workspace creation

When an external template is selected:

1. A new directory is created under `repos_dir` (e.g., `~/git/42-task-slug/`)
2. All files and folders from the template path are **copied** into it
3. The `.git/` directory is excluded (a fresh git repo is initialized)
4. Dotfiles and dotfolders (e.g., `.claude/`, `.gitignore`) are included
5. Template variables like `{{task.id}}` and `{{task.title}}` are substituted in
   text files
6. Only `.task-ref.json` is added at the repo root (no README.md, CLAUDE.md, or
   input/output directories are generated)
7. A git repo is initialized and an initial commit is created

## Template variables

These variables are replaced in text files during workspace creation:

| Variable             | Example value       |
| -------------------- | ------------------- |
| `{{task.id}}`        | `42`                |
| `{{task.title}}`     | `Fix auth bug`      |
| `{{task.status}}`    | `todo`              |
| `{{task.priority}}`  | `1`                 |
| `{{task.due_date}}`  | `2026-03-01`        |
| `{{task.project}}`   | `Backend`           |
| `{{task.slug}}`      | `42-fix-auth-bug`   |
| `{{task.workspace}}` | `/home/user/git/42-fix-auth-bug` |

## Create a template

A template is any directory containing the files you want in new workspaces. For
example:

```
~/git/my-template/
├── .gitignore
├── .claude/
│   └── settings.json
├── CLAUDE.md
├── README.md
└── src/
    └── main.ts
```

You can use template variables in any text file. For example, in `README.md`:

```markdown
# {{task.title}}

Task ID: {{task.id}}
Project: {{task.project}}
```

Binary files (images, compiled assets) are copied as-is without substitution.
