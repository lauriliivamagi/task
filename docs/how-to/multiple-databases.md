# How to Manage Multiple Databases

Separate tasks into different databases for work, personal, or project contexts.

## List databases

```bash
task db list
```

Output:

```
Name      Tasks   Projects   Active
─────────────────────────────────────
default   42      3          ✓
work      15      2
personal  8       1
```

## Create a database

```bash
task db create work
```

Database names must be lowercase, with only letters, numbers, hyphens, or
underscores.

## Switch databases

```bash
task db use work
```

All subsequent commands operate on the "work" database.

## Check current database

```bash
task db current
```

## Rename a database

```bash
task db rename work office
```

## Delete a database

```bash
task db delete old-project
```

You'll be asked to confirm. Use `--yes` to skip confirmation.

## Where databases are stored

Each database gets its own directory:

```
~/.task-cli/databases/
├── default/
│   ├── data.db         # SQLite database
│   ├── attachments/    # File attachments
│   └── tui-state.json  # TUI session state
├── work/
│   └── ...
└── personal/
    └── ...
```

## Use different databases in scripts

```bash
task db use work && task list
task db use personal && task add "Buy groceries"
```

Or run the server with a specific database and connect with `--attach`.
