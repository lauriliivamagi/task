# 0002. One API, many interfaces: in-process Hono server with a TypeScript SDK

- Status: Accepted
- Date: 2025-12-07
- Deciders: Task maintainers

## Context

Task exposes three front-ends — a yargs CLI, an Ink/React TUI, and an HTTP API
for external/AI clients. If each front-end talked to SQLite directly, business
rules (Zod validation, embedding triggers, recurrence handling) would be
duplicated and could drift, and behaviour could differ between `task add` on the
CLI and the `n` key in the TUI.

We want one source of truth for behaviour, the ability to test that behaviour
once, and a cheap path to add new interfaces (web, mobile). The cost we are
willing to weigh is some added latency from an internal HTTP hop. See
[Architecture](../architecture.md).

## Decision

We will route every interface through one HTTP API implemented with Hono, and a
single typed TypeScript SDK client (`src/sdk/client.ts`). The CLI and TUI never
touch the database directly. CLI commands call `runWithClient()`, which either
attaches to an external server (`--attach`) or starts an in-process Hono server
as a cached singleton and makes real HTTP requests to it. All request validation
and persistence live in `src/server/`.

## Consequences

- Positive: CLI and TUI behave identically; the API is tested once via
  `app.fetch()` integration tests and all interfaces inherit that coverage; new
  interfaces only need the SDK.
- Positive: external/AI clients are first-class — the same endpoints serve them.
- Negative: an internal HTTP hop adds latency (imperceptible for ~99% of
  operations) and some indirection when tracing a CLI command to a DB query.
- Constrains: new features are added server-side first (route + Zod schema),
  then exposed via the SDK, then the CLI/TUI — see CLAUDE.md "Adding Features".

## Alternatives Considered

- **Direct database access from each front-end** — rejected: duplicated business
  logic, behaviour drift, and triple the surface to test.
- **A shared in-process library (no HTTP) for CLI/TUI, HTTP only for external
  clients** — rejected: creates two code paths (in-process vs. HTTP) and
  reintroduces drift risk for the external path.
