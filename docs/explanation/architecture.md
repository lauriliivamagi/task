# Architecture

How Task is designed and why.

## System Overview

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

## Design Principles

### One API, Many Interfaces

Every interface—CLI, TUI, and external clients—uses the same HTTP API through
the TypeScript SDK. This means:

- **Consistency**: The same operation works the same way everywhere
- **Testability**: Test the API once, all interfaces benefit
- **Extensibility**: New interfaces (web, mobile) just need the SDK

The CLI doesn't directly touch the database. It starts an in-process HTTP server
and makes requests to it. This might seem like overhead, but it ensures the CLI
and TUI behave identically.

### Local-First

Task CLI stores everything in SQLite on your machine. There's no cloud service,
no account to create, no data leaving your computer unless you choose to sync
via Git.

This is intentional. See [Local-First Design](local-first.md) for the reasoning.

### Fire-and-Forget Embeddings

When you create or update a task, embedding generation happens asynchronously.
The API returns immediately—you don't wait for embeddings.

This is a trade-off:

- **Pro**: Fast response times, no blocking on external services
- **Con**: Semantic search might not find very recent tasks

In practice, embeddings complete within seconds, so this is rarely noticeable.

## Component Responsibilities

| Component         | Purpose                                         |
| ----------------- | ----------------------------------------------- |
| `src/cli/`        | Parse commands, call SDK, format output         |
| `src/tui/`        | React components, XState state machine          |
| `src/sdk/`        | HTTP client, typed methods for API              |
| `src/server/`     | Hono routes, request validation, business logic |
| `src/db/`         | SQLite connection, migrations, queries          |
| `src/embeddings/` | Vector generation (Ollama, OpenAI, Gemini)      |
| `src/gcal/`       | Google Calendar OAuth and sync                  |
| `src/shared/`     | Schemas, utilities, cross-cutting concerns      |

## Data Flow

1. **User action** → CLI command or TUI keypress
2. **Client** → SDK method called with parameters
3. **SDK** → HTTP request to server
4. **Server** → Validates with Zod schemas
5. **Server** → Queries/mutates SQLite
6. **Server** → Returns JSON response
7. **SDK** → Parses response, returns typed result
8. **Client** → Formats and displays output

For embeddings:

1. Task created/updated
2. Server triggers embedding generation (async)
3. Embedding provider called
4. Vector stored in SQLite
5. (User never waits for this)

## The TUI State Machine

The TUI uses XState v5 for state management. This provides:

- **Predictable behavior**: Every state transition is explicit
- **Visualization**: State charts can be generated from the code
- **Testing**: State machines are easy to test in isolation

The machine has parallel regions:

- **data**: Loading, refreshing, error states
- **ui**: Navigation, overlays, editing modes

Child machines handle specific features like task editing or search.

## Why These Technology Choices

| Choice        | Reasoning                                                       |
| ------------- | --------------------------------------------------------------- |
| **Deno**      | Modern runtime, built-in TypeScript, easy compilation to binary |
| **SQLite**    | Zero-config, fast, single file, portable                        |
| **Hono**      | Lightweight HTTP framework, works everywhere                    |
| **Ink/React** | Declarative UI for terminals, familiar patterns                 |
| **XState**    | Robust state management for complex UI flows                    |
| **Zod**       | Runtime validation + TypeScript types from one source           |

## Trade-offs

**In-process server vs. direct database access:** We chose the HTTP layer for
consistency, but it adds latency. For 99% of operations, this is imperceptible.

**Multiple embedding providers vs. one:** Supporting Ollama, OpenAI, and Gemini
adds complexity but gives users choice. Local (Ollama) is free; cloud providers
are more accurate.

**Single binary vs. installed dependencies:** Deno compiles to a single binary,
making distribution simple. The trade-off is larger binary size (~50MB).
