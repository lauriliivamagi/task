# Contributing to Task

Thanks for contributing! This guide covers local setup, the development loop,
testing conventions, coding standards, and the release process. For deeper
architecture and feature docs, see [CLAUDE.md](CLAUDE.md) and [docs/](docs/).

## Prerequisites

- **Deno** `v2.8.1+` (matches CI; native OpenTelemetry is stable on this
  version)
- **git**
- **jq** — required by the `.claude/` policy hooks (`block-dangerous-git.sh`,
  `enforce-deno.sh`); they fail open without it
- Optional: **Ollama** (local embeddings), Google Cloud OAuth creds (Calendar
  sync)

This project uses Deno only — there is no `package.json`/`node_modules`. Do not
use `npm`/`yarn`/`pnpm`/`node`.

## Getting started

```bash
git clone git@github.com:lauriliivamagi/task.git
cd task
deno install            # populate the shared dependency cache (as CI does)
deno task hooks:install # install git hooks via core.hooksPath (run once)
deno task start list    # smoke-test the CLI
```

## Development loop

```bash
deno task start <command>   # run the CLI (deno run -A src/main.ts <command>)
deno task serve             # start the HTTP server
deno task tui               # launch the terminal UI
deno task compile           # build the standalone ./task binary
```

Run the same quality gates CI runs, locally, before pushing:

```bash
deno task ci          # fmt:check + lint + check:all + test + unused
# individually:
deno task fmt:check   # deno fmt --check   (use `deno fmt` to auto-format)
deno task lint        # deno lint
deno task check:all   # full-codebase type check (src + tests)
deno task unused      # dead-code finder (unreachable files; see scripts/find_unused.ts)
```

## Testing

Tests run against an in-memory SQLite DB and never touch `~/.task-cli/`:

```bash
deno task test        # full suite (sets TASK_CLI_LOG_DISABLED=1 TASK_CLI_DB_URL=:memory:)

# a single file:
TASK_CLI_LOG_DISABLED=1 TASK_CLI_DB_URL=:memory: deno test -A src/db/client_test.ts
# filter by test name:
TASK_CLI_LOG_DISABLED=1 TASK_CLI_DB_URL=:memory: deno test -A --filter "create task"

# coverage:
deno task test:cov && deno task coverage          # report
COVERAGE_MIN=70 deno task coverage:check          # enforce a minimum (see scripts/)
```

Conventions (see CLAUDE.md "Testing" for full detail):

- **Filesystem abstraction** (`src/shared/fs-abstraction.ts`): use `MemoryFS`
  for fast unit tests and `AgentFileSystem` for isolated integration tests. Make
  code testable by accepting an optional `fs?` parameter.
- **Async assertions**: `assertResolves` / `assertResolvesTo` from
  `src/test/test-utils.ts`.
- **TUI E2E**: `ink-testing-library` with `MockTaskClient`, plus `KEYS`,
  `waitForText`, `stripAnsi` from `src/tui/test-utils.ts`.
- **State machines**: `createActor` + `waitFor` from `xstate`.

## Coding standards (TigerStyle)

This codebase follows
[TigerStyle](https://github.com/tigerbeetle/tigerbeetle/blob/main/docs/TIGER_STYLE.md):

- **Assertions**: validate invariants with
  `assert`/`assertDefined`/`assertPositive` (`src/shared/assert.ts`).
- **Limits**: bound everything via `src/shared/limits.ts`.
- **Short functions**: target ~70 lines max.
- **Named arguments**: prefer options objects.
- **Background timers**: always `Deno.unrefTimer(id)` so they don't block exit.

Lint is strict (see `deno.json`): no `any`, explicit function return types, no
non-null assertions. The **pre-commit** hook runs `deno fmt --check` +
`deno lint`; bypass with `git commit --no-verify` only when you must.

## Observability

Logs are written to `~/.task-cli/logs/` as structured JSON by default (set
`TASK_CLI_LOG_FORMAT=pretty` for human-readable lines, `TASK_CLI_LOG_CONSOLE=1`
to mirror to stderr during dev). HTTP requests get an `X-Request-ID` that is
correlated into every log line for that request. For full tracing of the
long-running server, run `deno task serve:otel` — Deno's native OTel exports
OTLP to `http://localhost:4318`. If you already run a Jaeger/OTLP collector
there (check `docker ps`), traces flow straight into it (open its UI and pick
the `task` service); otherwise `deno task otel:jaeger` starts a local one. See
[docker-compose.otel.yml](docker-compose.otel.yml) for reuse and port-clash
notes.

## Commits & branches

- Branch off `master`; open PRs against `master`.
- Imperative commit subjects; append `(vX.Y.Z)` on release commits (see git
  log).
- If your branch name contains an issue key (e.g. `PROJ-123`), the
  `prepare-commit-msg` hook prepends it to commit messages automatically.

## Versioning & release (SemVer)

Bump the version in **both** `deno.json` and `.claude-plugin/plugin.json` — they
must match (the **pre-push** hook enforces this and is skipped for doc-only
pushes; bypass with `git push --no-verify`).

```bash
# 1. bump deno.json AND .claude-plugin/plugin.json to the same version
git add deno.json .claude-plugin/plugin.json && git commit -m "Bump version to X.Y.Z"
git push origin master
# 2. tag and push — GitHub Actions cross-compiles binaries and creates the release
git tag vX.Y.Z && git push origin vX.Y.Z
```

## Documentation

- Update [CLAUDE.md](CLAUDE.md) and the relevant page under [docs/](docs/)
  (Diataxis: tutorial / how-to / reference / explanation) when behaviour
  changes.
- Record significant decisions as an ADR in
  [docs/explanation/adr/](docs/explanation/adr/).

## CI & agent guardrails

PRs run `deno audit`, the `quality` job (fmt + lint + full type-check), and the
test suite with coverage. The repo also ships Claude Code policy hooks in
`.claude/` that block dangerous git operations and Node package managers; the
`git-guardrails-claude-code` skill is a zero-maintenance alternative if you
prefer not to rely on the in-repo hooks.
