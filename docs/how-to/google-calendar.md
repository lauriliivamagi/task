# How to Sync Tasks to Google Calendar

Push tasks to Google Calendar as events. Changes sync one-way (tasks to
calendar).

## Prerequisites

You need a Google Cloud project with Calendar API enabled.

## Step 1: Set up Google Cloud credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or select existing)
3. Enable the Google Calendar API
4. Go to Credentials → Create Credentials → OAuth 2.0 Client ID
5. Select "Desktop app" as application type
6. Download the JSON credentials

## Step 2: Configure Task

Save credentials to `~/.task-cli/secrets.json`:

```bash
{
  "gcal_credentials": {
    "client_id": "??????.apps.googleusercontent.com",
    "client_secret": "GOCSPX-????????????"
  },
  ...
}
```

## Step 3: Authenticate

```bash
task gcal auth
```

This opens a browser for Google OAuth. Grant calendar access when prompted.

## Step 4: Sync a task

```bash
task gcal sync 42
```

The task appears in your calendar using its due date as the event start time.

## Customize sync options

```bash
# Set event duration (default: 1 hour)
task gcal sync 42 --duration 2

# Use a specific calendar
task gcal sync 42 --calendar "Work"

# Override the date
task gcal sync 42 --date "tomorrow 14:00"
```

## Set a default calendar

```bash
task gcal calendars          # List available calendars
task gcal use "Work Calendar"  # Set as default
```

## Sync from the TUI

1. Press `Tab` to switch to detail view
2. Press `Shift+G` to sync to Google Calendar

## Check sync status

```bash
task gcal status    # Auth status
```

> [!NOTE]
> To see synced/unsynced tasks, use the API endpoints `/gcal/synced` and
> `/gcal/unsynced` directly.

## Re-syncing updates the event

If you sync a task that's already been synced, the existing calendar event is
updated rather than creating a duplicate.
