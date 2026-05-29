---
type: explanation
domain: complicated
audience: decision-maker
stability: foundational
authority:
  provenance: institutional
  verifiability: auditable
  evidence: moderate
  currency: dated
epistemic-layer: heuristic
---

# 0001. Local-first storage on SQLite (libsql/Turso)

- Status: Accepted
- Date: 2025-12-07
- Deciders: Task maintainers

## Context

Task manages personal and work tasks. Users care about privacy, offline
availability, speed, and long-term ownership of their data. A cloud-first design
would make an external service the source of truth and turn offline support into
an afterthought. See [Local-First Design](../local-first.md).

## Decision

We will store all data locally in SQLite (via `@libsql/client`, the Turso
client) under `~/.task-cli/databases/`. There is no required cloud service or
account. Multi-device replication is offered as opt-in Git sync, not a built-in
cloud. Vector embeddings for semantic search are stored alongside task data in
the same SQLite database.

## Consequences

- Positive: privacy by default (nothing leaves the machine unless the user
  syncs); works fully offline; millisecond-latency reads/writes; data is a
  single standard SQLite file the user can back up with any tool.
- Positive: embeddings co-locate with rows, avoiding a separate vector store.
- Negative: multi-device sync and backup become the user's responsibility
  (mitigated by Git sync); no real-time collaboration.
- Constrains: features must work offline; persistence stays in SQLite.

## Alternatives Considered

- **Cloud-first with local cache** — rejected: makes the cloud the source of
  truth and relegates offline to an afterthought; undermines privacy/ownership.
- **Peer-to-peer / CRDT sync** — rejected: significant complexity; Git sync is
  simpler and sufficient for individuals and small teams.
- **Flat files (JSON/Markdown)** — rejected: hand-editable, but complex queries
  (filtering, reports, semantic search) become slow without a query engine.
