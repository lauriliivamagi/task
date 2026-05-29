---
type: explanation
domain: complicated
audience: decision-maker
stability: structural
authority:
  provenance: institutional
  verifiability: auditable
  evidence: moderate
  currency: dated
epistemic-layer: heuristic
---

# 0003. XState v5 for TUI state

- Status: Accepted
- Date: 2025-12-07
- Deciders: Task maintainers

## Context

The terminal UI (Ink/React) has non-trivial interaction state: list vs. detail
views, overlays, editing modes, search, and async data loading/refreshing.
Ad-hoc `useState`/`useEffect` for this tends toward implicit, hard-to-test state
and races between data loading and user navigation. See
[Architecture](../architecture.md).

## Decision

We will model TUI state with XState v5: a top-level machine with parallel
regions — `data` (loading, refreshing, error) and `ui` (navigation, overlays,
editing) — plus child machines for self-contained features (e.g. detail
editing). Async operations live in actors (`src/tui/machines/tui.actors.ts`);
guards and types are separated (`tui.guards.ts`, `tui.types.ts`).

## Consequences

- Positive: every transition is explicit; behaviour is predictable and
  visualizable; machines are tested in isolation with `createActor`/`waitFor`
  without rendering the UI.
- Positive: parallel regions cleanly separate data concerns from UI concerns.
- Negative: XState has a learning curve and adds a dependency and some
  boilerplate versus plain hooks.
- Constrains: new TUI features add events/states/actors to the machine rather
  than ad-hoc component state — see CLAUDE.md "New TUI Feature".

## Alternatives Considered

- **Plain React hooks (useState/useReducer/useEffect)** — rejected: implicit
  state and effect-driven transitions become hard to reason about and test as
  interactions grow.
- **Redux / Zustand** — rejected: good for state storage, but don't model
  finite-state transitions and guards the way the TUI's modal flows need.
