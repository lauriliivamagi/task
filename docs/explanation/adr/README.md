# Architecture Decision Records

This directory records significant architecture decisions for Task using
lightweight [MADR](https://adr.github.io/madr/)-style records.

## Why ADRs?

Code shows _what_ the system does; ADRs capture _why_ it does it that way — the
forces at play, the option chosen, and the consequences we accepted. They let
future contributors (and AI agents) understand the reasoning behind a decision
without reverse-engineering it from the code or git history.

## When to write one

Write an ADR when a decision:

- is hard or expensive to reverse (storage engine, public API shape), or
- shapes the architecture (how interfaces talk to data, state management), or
- would otherwise leave a future reader asking "why was it done this way?".

Skip ADRs for routine, easily-reversible choices.

## How to add one

1. Copy [template.md](template.md) to `NNNN-short-title.md` (next number,
   zero-padded).
2. Fill in Context, Decision, Consequences, and Alternatives Considered.
3. Set Status to `Proposed`, then `Accepted` once agreed.
4. Never rewrite an accepted ADR's decision — supersede it with a new ADR and
   set the old one's Status to `Superseded by ADR-XXXX`.
5. Add a row to the index below.

## Index

| ADR                                                       | Title                                                  | Status   |
| --------------------------------------------------------- | ------------------------------------------------------ | -------- |
| [0001](0001-local-first-sqlite-libsql.md)                 | Local-first storage on SQLite (libsql/Turso)           | Accepted |
| [0002](0002-one-api-many-interfaces-in-process-server.md) | One API, many interfaces: in-process Hono server + SDK | Accepted |
| [0003](0003-xstate-v5-for-tui-state.md)                   | XState v5 for TUI state                                | Accepted |
