---
type: how-to-guide
domain: complicated
audience: operator
stability: tactical
authority:
  provenance: institutional
  verifiability: testable
  evidence: moderate
  currency: undated
epistemic-layer: method
---

# How to Monitor and Troubleshoot Task

Find out what a running server is doing and recover when it misbehaves. To start
and run the server, see [How to Run Task as a Server](run-as-server.md).

## Where the logs are

Structured logs are written to a daily-rotated file:

```bash
~/.task-cli/logs/task-cli-YYYY-MM-DD.log
```

Each line is a JSON object — stream and filter with `jq`:

```bash
tail -f ~/.task-cli/logs/task-cli-$(date +%F).log | jq .
# only warnings and errors:
tail -f ~/.task-cli/logs/task-cli-$(date +%F).log | jq 'select(.level=="warn" or .level=="error")'
```

Common fields: `ts`, `level`, `context` (e.g. `http`, `server`, `db`,
`embeddings`, `sync`), `msg`, `requestId`, and `durationMs` on request/timing
lines.

| Variable                | Effect                                                   |
| ----------------------- | -------------------------------------------------------- |
| `TASK_CLI_LOG_LEVEL`    | `debug` \| `info` \| `warn` \| `error` (default `info`)  |
| `TASK_CLI_LOG_FORMAT`   | `json` (default) or `pretty` (human-readable file lines) |
| `TASK_CLI_LOG_CONSOLE`  | `1` also mirrors pretty logs to stderr (dev/foreground)  |
| `TASK_CLI_LOG_DISABLED` | `1` disables logging entirely                            |

## Trace a single request

Every HTTP response includes an `X-Request-ID` header, and the same id appears
as `requestId` on every log line emitted while handling that request. To
investigate a slow or failed call:

```bash
# 1. capture the id from the response
curl -i http://127.0.0.1:3000/tasks | grep -i x-request-id
# 2. pull every log line for that request
grep '<request-id>' ~/.task-cli/logs/task-cli-$(date +%F).log | jq .
```

Each request also logs a `request.end` line with `method`, `path`, `status`, and
`durationMs` — useful for spotting slow endpoints.

## Optional: distributed tracing

Deno has native OpenTelemetry. Export traces by running with `OTEL_DENO=1`:

```bash
deno task serve:otel        # OTEL_DENO=1 OTEL_SERVICE_NAME=task ... serve
```

Traces export via OTLP to `http://localhost:4318`. If you already run a
Jaeger/OTLP collector there, they flow straight in — open its UI
(`http://localhost:16686`) and pick the **task** service. If not, start one with
`deno task otel:jaeger` (see
[docker-compose.otel.yml](../../docker-compose.otel.yml)). This is a diagnostics
aid; the file logs above remain the primary signal.

## Troubleshooting runbook

| Symptom                               | Likely cause                                           | Diagnose → Recover                                                                                                                                       |
| ------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Won't start, `address already in use` | Port already bound                                     | `lsof -i :3000` → stop the other process or start with `--port`                                                                                          |
| Startup hangs or is slow              | Auto-sync pulling from a slow/unreachable remote       | Check `context:"sync"` logs and network → `task sync status`; start without a remote if needed                                                           |
| `500` responses                       | Handler error / failed invariant                       | Grep the `X-Request-ID` in logs; assertion failures log with `context:"server"` and the failed assertion                                                 |
| `database is locked`                  | Two processes writing the same SQLite file             | Run **one** server per database; don't run concurrent CLI writes against a served DB                                                                     |
| Semantic search misses recent tasks   | Embeddings are fire-and-forget; provider down or unset | Check `EMBEDDING_PROVIDER`/`OLLAMA_URL` and `context:"embeddings"` logs — embedding failures are logged and **non-blocking** (they never fail a request) |
| Git auto-sync stuck / conflict        | Merge conflict on `data.db`                            | `task sync status`; resolve manually, or `task sync pull --force` (**may discard local changes**) → restore from backup if needed                        |
| Calendar sync fails (`401`/expired)   | OAuth token expired                                    | Re-run `task gcal auth`                                                                                                                                  |

## Backup and recovery

Each database is a single SQLite file at `~/.task-cli/databases/<name>/data.db`.
To back up, **stop the server** and copy the file (or rely on git sync as
off-site backup). OAuth tokens live in `~/.task-cli/secrets.json` and are
**not** git-synced — back them up separately.

## Escalating

File issues at the project repository. Include: the Task `--version`, the
relevant `X-Request-ID` and its log lines (`level`, `context`, `msg`), and the
`task sync status` output if sync is involved.
