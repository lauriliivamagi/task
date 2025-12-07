# How to Sync Tasks Across Devices

Use Git to synchronize your Task data across multiple machines.

## Initialize sync

```bash
task sync init
```

This creates a Git repository in `~/.task-cli/`.

To use an existing remote:

```bash
task sync init git@github.com:username/task-sync.git
```

## Push changes

```bash
task sync push
```

Or with a custom message:

```bash
task sync push -m "Added project tasks"
```

## Pull changes

```bash
task sync pull
```

To overwrite local changes:

```bash
task sync pull --force
```

## Check sync status

```bash
task sync status
```

Shows current branch, remote, and ahead/behind status.

## Enable auto-sync

Add to `~/.task-cli/config.json`:

```json
{
  "sync": {
    "auto": true
  }
}
```

With auto-sync enabled:

- **Startup**: Pulls latest changes
- **Shutdown**: Commits and pushes changes
- **On write**: Commits after 30 seconds of no activity

## What gets synced

| Synced        | Not synced     |
| ------------- | -------------- |
| `config.json` | `logs/`        |
| `databases/`  | `secrets.json` |
| `templates/`  | `*.log` files  |

OAuth tokens (`secrets.json`) are excluded for security.

## Resolve conflicts

If you edit the same task on two devices:

1. `task sync pull` will show merge conflicts
2. Resolve conflicts in the database files
3. `task sync push` to complete

For complex conflicts, consider using separate databases per device.
