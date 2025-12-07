# CLAUDE.md

Developer and AI agent guide for Task.

**Reminder:** Update this documentation when implementing new features,
patterns, or test utilities — do this before committing.

---

## Quick Reference

```bash
deno task test          # Run all tests (uses in-memory SQLite)
deno task start         # Run CLI: deno run -A src/main.ts <command>
deno task serve         # Start HTTP server
deno task tui           # Launch terminal UI
deno task compile       # Build standalone binary (./task)
deno check src/main.ts  # Type check
deno fmt                # Format code
```

Run a single test:

```bash
TASK_CLI_LOG_DISABLED=1 TASK_CLI_DB_URL=:memory: deno test -A src/db/client_test.ts
```

---

## Architecture Overview

### System Diagram

```
                   Task
                    │
    ┌───────────────┼───────────────┐
    ▼               ▼               ▼
CLI Client      TUI Client      External
(yargs)         (Ink/React)     Clients
    │               │               │
    └───────────────┼───────────────┘
                    ▼
             SDK (TypeScript)
                    │
                    ▼
            Hono HTTP Server
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
    SQLite      Embeddings   Google Cal
    (Turso)     (vectors)    (OAuth)
```

### Component Responsibilities

| Directory         | Purpose                                          |
| ----------------- | ------------------------------------------------ |
| `src/cli/`        | CLI entry point, command handlers, bootstrap     |
| `src/server/`     | Hono HTTP server and route handlers              |
| `src/sdk/`        | TypeScript HTTP client for API                   |
| `src/tui/`        | Ink/React terminal UI with XState state machine  |
| `src/db/`         | SQLite connection, migrations, schema            |
| `src/embeddings/` | Vector search providers (Ollama, OpenAI, Gemini) |
| `src/gcal/`       | Google Calendar OAuth and sync                   |
| `src/shared/`     | Schemas, utilities, cross-cutting concerns       |

### Data Flow

1. **CLI/TUI** → calls SDK client methods
2. **SDK** → makes HTTP requests to server
3. **Server** → validates with Zod, queries SQLite
4. **Response** → flows back through SDK to caller

CLI commands use `runWithClient()` which either attaches to an external server
or starts an in-process server (cached singleton).

### Key Dependencies

```
CLI (yargs)
  └─→ bootstrap.ts → runWithClient()
        └─→ SDK client
              └─→ Hono server
                    ├─→ SQLite (@libsql/client)
                    ├─→ Embeddings (fire-and-forget)
                    └─→ Google Calendar (OAuth)

TUI (Ink/React)
  └─→ XState v5 state machine
        ├─→ tui.actors.ts (async operations)
        ├─→ SDK client
        └─→ components/*.tsx
```

---

## Codebase Structure

```
src/
├── main.ts                    # CLI entry point
├── cli/
│   ├── bootstrap.ts           # Server lifecycle & client init
│   └── cmd/                   # Yargs command handlers
├── server/
│   ├── server.ts              # Hono server setup
│   └── routes/                # API endpoints
│       ├── tasks.ts           # Task CRUD + bulk + batch
│       ├── tags.ts            # Tag management
│       ├── projects.ts        # Project management
│       ├── comments.ts        # Comments
│       ├── attachments.ts     # File attachments
│       ├── parse.ts           # Text/markdown parsing
│       ├── stats.ts           # Statistics
│       ├── reports.ts         # Activity reports
│       └── gcal.ts            # Google Calendar sync
├── sdk/
│   └── client.ts              # TypeScript HTTP client
├── tui/
│   ├── app.tsx                # Main Ink app
│   ├── app.test.tsx           # TUI E2E tests
│   ├── test-utils.ts          # Test utilities (KEYS, waitForText)
│   ├── mock_client.ts         # Mock API client
│   ├── tui-state.ts           # State persistence
│   ├── exit.ts                # Centralized exit handler
│   ├── components/            # React components
│   └── machines/              # XState v5
│       ├── tui.machine.ts     # Main state machine
│       ├── tui.actors.ts      # Promise actors
│       ├── tui.guards.ts      # Guard conditions
│       └── tui.types.ts       # TypeScript types
├── db/
│   ├── client.ts              # SQLite connection, migrations
│   └── schema.ts              # DDL schema
├── embeddings/
│   ├── provider.ts            # Provider interface
│   ├── ollama.ts              # Ollama provider
│   ├── openai.ts              # OpenAI provider
│   ├── gemini.ts              # Google Gemini provider
│   ├── service.ts             # High-level service
│   └── index.ts               # Factory
├── gcal/
│   ├── auth.ts                # OAuth 2.0 flow
│   ├── client.ts              # Calendar API wrapper
│   ├── secrets.ts             # Token storage
│   └── sync.ts                # Sync logic
├── test/
│   └── test-utils.ts          # Async test assertions
└── shared/
    ├── schemas.ts             # Zod schemas (validation + types)
    ├── assert.ts              # TigerStyle assertions
    ├── limits.ts              # Constants for bounded operations
    ├── fs-abstraction.ts      # FileSystem interface
    ├── date-parser.ts         # chrono-node + date-fns
    ├── recurrence-parser.ts   # Parse "every Monday"
    ├── recurrence-calculator.ts # Calculate next due date
    ├── recurrence-handler.ts  # Create task on completion
    ├── templates.ts           # Task sharing templates
    ├── workspace.ts           # Workspace creation
    ├── clipboard.ts           # Cross-platform clipboard
    ├── config.ts              # ~/.task-cli/config.json
    ├── migration.ts           # Single-db to multi-db migration
    ├── sync.ts                # Git sync utilities
    ├── logger.ts              # File logging
    ├── version.ts             # Version info
    └── upgrade.ts             # Self-update
```

---

## Development

### Running Locally

```bash
# Development CLI
deno task start add "Test task"
deno task start list

# Development server
deno task serve

# Development TUI
deno task tui
```

### Environment Variables

| Variable                | Description                          |
| ----------------------- | ------------------------------------ |
| `TASK_CLI_DB_URL`       | SQLite URL (`:memory:` for tests)    |
| `TASK_CLI_LOG_DISABLED` | Disable file logging                 |
| `TASK_CLI_LOG_LEVEL`    | Log level (debug, info, warn, error) |
| `EMBEDDING_PROVIDER`    | ollama, openai, or gemini            |
| `OPENAI_API_KEY`        | OpenAI API key                       |
| `GEMINI_API_KEY`        | Google Gemini API key                |
| `OLLAMA_URL`            | Ollama server URL                    |

### Database Management

Multi-database structure for context separation:

```
~/.task-cli/
├── config.json          # Configuration (includes activeDb)
├── logs/                # Daily rotated logs
├── templates/           # Task sharing templates
├── secrets.json         # OAuth tokens (git-ignored)
└── databases/
    ├── default/
    │   ├── data.db      # SQLite database
    │   ├── attachments/ # Uploaded files
    │   └── tui-state.json
    └── work/
        └── ...
```

```bash
task db list             # List databases with counts
task db create <name>    # Create database
task db use <name>       # Switch database
task db current          # Show active database
```

---

## Testing

### Test Structure

| File                                   | Type        | Description                    |
| -------------------------------------- | ----------- | ------------------------------ |
| `src/integration_test.ts`              | Integration | End-to-end API via app.fetch() |
| `src/db/client_test.ts`                | Unit        | Database layer                 |
| `src/tui/machines/tui.machine.test.ts` | Unit        | State machine logic            |
| `src/tui/app.test.tsx`                 | E2E         | TUI with ink-testing-library   |
| `src/tui/tui-state.test.ts`            | Unit        | TUI state persistence          |
| `src/embeddings/embeddings_test.ts`    | Unit        | Embedding providers            |
| `tests/cli_test.ts`                    | E2E         | CLI subprocess tests           |

### Test Isolation

`deno task test` sets `TASK_CLI_DB_URL=:memory:` automatically. Tests never
touch `~/.task-cli/databases/`. CLI tests use `/tmp/task-cli-test-*.db`.

### Filesystem Abstraction

Use `src/shared/fs-abstraction.ts` for testable filesystem code:

```typescript
import { AgentFileSystem, MemoryFS } from "../shared/fs-abstraction.ts";

// Unit test (fast, no I/O)
const fs = new MemoryFS();
await fs.writeTextFile("/test.json", '{"key": "value"}');

// Integration test (isolated SQLite-backed)
const fs = new AgentFileSystem();
try {
  await fs.writeTextFile("/data.json", "{}");
} finally {
  await fs.close();
}
```

**Interface methods:** `readTextFile`, `writeTextFile`, `exists`, `ensureDir`

**Make code testable:** Accept optional `fs` parameter:

```typescript
export async function loadConfig(fs?: FileSystem): Promise<Config> {
  const filesystem = fs ?? getFS();
  // ...
}
```

### Async Test Utilities

```typescript
import { assertResolves, assertResolvesTo } from "../test/test-utils.ts";

const result = await assertResolves(fetchUser("123"));
await assertResolvesTo(fetchStatus(), "ok");
```

### TUI E2E Testing

```typescript
import { render } from "ink-testing-library";
import { App } from "./app.tsx";
import { MockTaskClient } from "./mock_client.ts";
import { KEYS, stripAnsi, waitForText } from "./test-utils.ts";

Deno.test({
  name: "TUI E2E - create task",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const client = new MockTaskClient();
    const { lastFrame, stdin, unmount } = render(<App client={client} />);

    await waitForText(lastFrame, "Tasks");
    stdin.write("n");
    stdin.write("My new task");
    stdin.write(KEYS.ENTER);

    const frame = stripAnsi(lastFrame() ?? "");
    assertEquals(frame.includes("My new task"), true);
    unmount();
  },
});
```

**Key utilities:**

- `KEYS` — ANSI escape sequences (UP, DOWN, ENTER, ESCAPE, TAB)
- `waitForText(getFrame, text)` — Wait for text to appear
- `stripAnsi(str)` — Remove ANSI codes for comparison
- `MockTaskClient` — In-memory API mock

### Testing State Machines

```typescript
import { createActor, waitFor } from "xstate";
import { tuiMachine } from "./tui.machine.ts";

Deno.test("state machine - handles event", async () => {
  const actor = createActor(tuiMachine, {
    input: {
      client: new MockTaskClient(),
      initialTasks: [],
      initialProjects: [],
    },
  });
  actor.start();
  actor.send({ type: "SOME_EVENT" });
  await waitFor(actor, (state) => state.matches("expectedState"));
  actor.stop();
});
```

---

## Coding Standards

### TigerStyle

This codebase follows
[TigerStyle](https://github.com/tigerbeetle/tigerbeetle/blob/main/docs/TIGER_STYLE.md):

**Assertions** — Validate invariants, crash on failure:

```typescript
import { assert, assertDefined, assertPositive } from "../shared/assert.ts";

assert(condition, "what failed", "context");
assertDefined(value, "value must exist", "db");
assertPositive(id, "ID must be positive", "sdk");
```

**Limits** — Bound everything via `shared/limits.ts`:

```typescript
import { MAX_BATCH_SIZE, MAX_COMMENT_LENGTH } from "../shared/limits.ts";
```

**Short functions** — Target 70 lines max.

**Named arguments** — Use options objects to prevent parameter mix-ups.

### Background Timers

Always unref background timers to prevent blocking process exit:

```typescript
const timerId = setTimeout(() => {
  // Background work...
}, 30000);
Deno.unrefTimer(timerId);
```

---

## Adding Features

### New CLI Command

1. Create `src/cli/cmd/my-command.ts`:

```typescript
import type { CommandModule } from "yargs";
import { runWithClient } from "../bootstrap.ts";

export const myCommand: CommandModule = {
  command: "my-command",
  describe: "Description",
  handler: async () => {
    await runWithClient(async (client) => {
      // Use client...
    });
  },
};
```

2. Import in `src/main.ts`
3. Add integration tests

### New API Route

1. Create `src/server/routes/my-route.ts`:

```typescript
import { Hono } from "hono";

export const myRoutes = new Hono()
  .get("/my-endpoint", async (c) => {
    return c.json({ data: "value" });
  });
```

2. Mount in `src/server/server.ts`
3. Add SDK client method
4. Add integration tests

### New TUI Feature

1. Add events/actions to `src/tui/machines/tui.machine.ts`
2. Create actors in `src/tui/machines/tui.actors.ts`
3. Update components in `src/tui/components/`
4. Add E2E tests in `src/tui/app.test.tsx`

---

## Feature Reference

### Key Patterns

**CLI Bootstrap** — `runWithClient()` handles server lifecycle:

- Attaches to external server if `--attach` provided
- Otherwise starts in-process server (cached singleton)

**Validation** — Zod schemas in `shared/schemas.ts` provide runtime validation
and TypeScript types.

**Embeddings** — Fire-and-forget, non-blocking. 768-dimension vectors stored as
`F32_BLOB` with cosine similarity via `vector_top_k()`.

**Date Handling:**

- `chrono-node` for natural language parsing
- `date-fns` for manipulation
- UTC storage, local display
- ISO 8601 with full datetime precision

### Recurring Tasks

Patterns: `daily`, `every day`, `every Monday`, `1st of month`, `yearly`

Implementation:

- `recurrence-parser.ts` — Parse natural language to RecurrenceRule
- `recurrence-calculator.ts` — Calculate next due date (uses `rrule` for complex
  patterns, JS Date arithmetic for simple)
- `recurrence-handler.ts` — Create new task on completion

Behavior on completion:

1. New task created with same title, description, priority, project, tags
2. Due date calculated from original + interval
3. Subtasks recreated with "todo" status
4. Recurrence rule copied

```typescript
// RecurrenceRule schema
{
  type: "daily" | "weekly" | "monthly" | "yearly";
  interval: number; // 1-365
  daysOfWeek?: number[]; // 0=Sun, 6=Sat
  dayOfMonth?: number | "last";
  weekOfMonth?: number; // 1-5
  weekday?: number; // 0-6
}
```

### TUI State Machine

XState v5 with parallel regions:

- **data** — Task loading, refresh
- **ui** — Navigation, overlays, editing

Child machines handle detail editing. Actors in `tui.actors.ts` perform async
operations (API calls, file ops).

### TUI Keyboard Shortcuts

**List View:**

| Key       | Action             |
| --------- | ------------------ |
| `j/k`     | Move up/down       |
| `n`       | New task           |
| `o`       | New subtask        |
| `e`       | Edit title         |
| `x`       | Toggle done        |
| `p`       | Toggle in-progress |
| `y`       | Yank to clipboard  |
| `w`       | Start work         |
| `Shift+J` | Move task down     |
| `Shift+K` | Move task up       |
| `Shift+R` | Refresh            |
| `/`       | Search             |
| `Tab`     | Switch to detail   |

**Detail View:**

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
| `Tab`     | Switch to list          |

**Customization** via `~/.task-cli/config.json`:

```json
{
  "keybindings": {
    "listView": { "Ctrl+n": "createTask" },
    "detailView": { "Ctrl+s": "changeStatus" },
    "global": { "Ctrl+q": "quit" }
  }
}
```

---

## Integrations

### Google Calendar

One-way sync: tasks → calendar events. Changes in Calendar NOT synced back.

**Setup:**

1. Create Google Cloud project
2. Enable Calendar API
3. Create OAuth 2.0 credentials (Desktop app)
4. Run `task gcal auth`

**Files:**

- `src/gcal/auth.ts` — OAuth 2.0 flow
- `src/gcal/client.ts` — Calendar API wrapper
- `src/gcal/sync.ts` — Sync logic
- `src/gcal/secrets.ts` — Token storage

**Behavior:**

- Task `due_date` becomes event start
- Default 1 hour duration
- `gcal_event_id` stored on task
- Re-sync updates existing event
- Recurring task completion auto-syncs new task

### Embeddings

Providers: Ollama (local), OpenAI, Google Gemini

```bash
export EMBEDDING_PROVIDER=ollama  # or openai, gemini
```

768-dimension vectors stored as `F32_BLOB`. Search via `vector_top_k()` with
cosine similarity.

Embedding generation is fire-and-forget (non-blocking).

### Git Sync

Git-based backup and replication of `~/.task-cli/`.

**Auto-sync** when `sync.auto: true` in config:

- Startup: pulls changes
- Shutdown: commits and pushes
- On write: debounced commit (30s)

**Ignored:** `logs/`, `secrets.json`, `*.log`

**Files:**

- `src/cli/cmd/sync.ts` — CLI commands
- `src/shared/sync.ts` — Git utilities

---

## API Reference

### Task Endpoints

| Method   | Path                           | Description                |
| -------- | ------------------------------ | -------------------------- |
| `GET`    | `/tasks`                       | List tasks (with filters)  |
| `POST`   | `/tasks`                       | Create task                |
| `GET`    | `/tasks/:id`                   | Get task details           |
| `PATCH`  | `/tasks/:id`                   | Update task                |
| `DELETE` | `/tasks/:id`                   | Delete task                |
| `PATCH`  | `/tasks/bulk`                  | Bulk update                |
| `DELETE` | `/tasks/bulk`                  | Bulk delete                |
| `POST`   | `/tasks/batch`                 | Batch create with subtasks |
| `POST`   | `/tasks/:id/complete-subtasks` | Complete all subtasks      |

**Query parameters for GET /tasks:** `q`, `status`, `priority`, `overdue`,
`due_before`, `due_after`, `project`, `tag`, `all`, `semantic`, `limit`

### Other Endpoints

| Method   | Path                     | Description          |
| -------- | ------------------------ | -------------------- |
| `GET`    | `/health`                | Health check         |
| `GET`    | `/projects`              | List projects        |
| `POST`   | `/projects`              | Create project       |
| `GET`    | `/tasks/:id/comments`    | List comments        |
| `POST`   | `/tasks/:id/comments`    | Add comment          |
| `GET`    | `/tasks/:id/attachments` | List attachments     |
| `POST`   | `/tasks/:id/attachments` | Add attachment       |
| `GET`    | `/tasks/:id/tags`        | List tags on task    |
| `POST`   | `/tasks/:id/tags`        | Add tags to task     |
| `DELETE` | `/tasks/:id/tags/:tagId` | Remove tag from task |
| `GET`    | `/tags`                  | List all tags        |
| `POST`   | `/tags`                  | Create tag           |
| `PATCH`  | `/tags/:id`              | Rename tag           |
| `DELETE` | `/tags/:id`              | Delete tag           |
| `GET`    | `/stats`                 | Task statistics      |
| `GET`    | `/reports`               | Activity reports     |
| `POST`   | `/parse`                 | Parse text to tasks  |

### Google Calendar Endpoints

| Method | Path                 | Description           |
| ------ | -------------------- | --------------------- |
| `GET`  | `/gcal/status`       | Auth status           |
| `GET`  | `/gcal/calendars`    | List calendars        |
| `POST` | `/gcal/sync/:taskId` | Sync task to calendar |
| `POST` | `/gcal/sync/batch`   | Batch sync            |
| `GET`  | `/gcal/synced`       | List synced tasks     |
| `GET`  | `/gcal/unsynced`     | List unsynced tasks   |

### SDK Usage

```typescript
import { createClient } from "./sdk/client.ts";

const client = createClient({ baseUrl: "http://localhost:3000" });

// Tasks
const tasks = await client.listTasks({ status: "todo" });
const task = await client.createTask({ title: "New task" });
await client.updateTask(42, { status: "done" });

// Batch
await client.batchCreateTasks({
  tasks: [{ title: "Task 1", subtasks: [{ title: "Subtask" }] }],
});

// Semantic search
const results = await client.listTasks({ semantic: "authentication bugs" });

// Calendar
await client.syncToCalendar(42, { durationHours: 2 });
```

---

## Versioning & Release

### Semantic Versioning

Version in `deno.json`, exported via `src/shared/version.ts`.

**Important:** `.claude-plugin/plugin.json` version must match `deno.json`. The
pre-push hook enforces this.

- **PATCH** (0.1.0 → 0.1.1): Bug fixes
- **MINOR** (0.1.0 → 0.2.0): New features, backward compatible
- **MAJOR** (0.1.0 → 1.0.0): Breaking changes

### Pre-Push Hook

Enforces version updates and plugin version sync. Ignores doc-only changes.
Bypass: `git push --no-verify`

### Creating a Release

```bash
# 1. Update version in deno.json AND .claude-plugin/plugin.json
# 2. Commit and push
git add deno.json .claude-plugin/plugin.json && git commit -m "Bump version to 1.0.1"
git push origin master

# 3. Tag and push
git tag v1.0.1 && git push origin v1.0.1
```

GitHub Actions compiles Linux binaries and creates release.

### Self-Update

```bash
task upgrade           # Check and install
task upgrade --check   # Check only
```

The upgrade command:

- Fetches latest release from GitHub
- Compares versions
- Downloads appropriate binary
- Verifies SHA256 checksum
- Creates backup, rolls back on failure
