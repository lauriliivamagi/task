---
type: how-to-guide
domain: complicated
audience: operator
stability: tactical
authority:
  provenance: institutional
  verifiability: executable
  evidence: moderate
  currency: undated
epistemic-layer: method
---

# How to Run Task as a Server

Run the Task HTTP API as a long-lived service and keep it healthy. For
diagnosing a running server, see
[How to Monitor and Troubleshoot Task](observability-and-troubleshooting.md).

## Start the server

```bash
task serve --port 3000 --hostname 127.0.0.1
```

| Option       | Default     | Description       |
| ------------ | ----------- | ----------------- |
| `--port`     | `3000`      | Port to listen on |
| `--hostname` | `127.0.0.1` | Address to bind   |

On startup the server: runs database migrations on **all** databases, **pulls**
git changes if sync is configured, then begins listening. It runs until stopped.

## Verify it is up

```bash
curl -s http://127.0.0.1:3000/health
# {"status":"ok"}
```

A non-200 or no response means the server is not ready — check the logs (see the
troubleshooting guide).

## Point clients at it

Any CLI command can talk to a running server instead of starting its own
in-process one:

```bash
task list --attach http://127.0.0.1:3000
```

## Environment

Set these before launching `task serve`:

| Variable                            | Purpose                                                    |
| ----------------------------------- | ---------------------------------------------------------- |
| `TASK_CLI_DB_URL`                   | Override the SQLite URL (default: per-database file)       |
| `TASK_CLI_LOG_LEVEL`                | `debug` \| `info` \| `warn` \| `error` (default `info`)    |
| `TASK_CLI_LOG_FORMAT`               | `json` (default) or `pretty` for the log file              |
| `EMBEDDING_PROVIDER`                | `ollama` \| `openai` \| `gemini` (enables semantic search) |
| `OLLAMA_URL`                        | Ollama endpoint when using the Ollama provider             |
| `OPENAI_API_KEY` / `GEMINI_API_KEY` | API key for the chosen cloud provider                      |
| `OTEL_DENO`                         | `1` to export OpenTelemetry traces (see troubleshooting)   |

See the [Configuration Reference](../reference/configuration.md) for the config
file equivalents.

## Run it persistently (systemd)

```ini
# /etc/systemd/system/task.service
[Unit]
Description=Task server
After=network-online.target

[Service]
ExecStart=/usr/local/bin/task serve --port 3000 --hostname 127.0.0.1
Environment=TASK_CLI_LOG_LEVEL=info TASK_CLI_LOG_FORMAT=json
User=%i
Restart=on-failure
# systemd stop sends SIGTERM, which triggers a graceful shutdown (see below).
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now task.service
journalctl -u task.service -f      # follow service output
```

For a quick background run without systemd:
`nohup task serve >/dev/null 2>&1 &`.

## Stop it gracefully

The server traps **SIGINT** (Ctrl+C) and **SIGTERM** (`systemctl stop`,
`kill <pid>`): it commits and pushes pending git-sync changes, closes the HTTP
listener, then exits. **Avoid `SIGKILL` (`kill -9`)** — it skips the shutdown
sync and may leave un-pushed changes.

## Monitoring checklist

- **Liveness**: poll `GET /health` (use it as the systemd/container health
  probe).
- **Logs**: structured JSON in `~/.task-cli/logs/`; every response carries an
  `X-Request-ID` you can grep for. See
  [Monitor and Troubleshoot](observability-and-troubleshooting.md).
- **Sync**: `task sync status` shows whether auto-sync is behind or conflicted.

## Security note

The API has **no authentication**. Keep it bound to `127.0.0.1` (the default).
Only bind a public address (`--hostname 0.0.0.0`) on a trusted network behind
your own auth/proxy — Task is a local-first, single-user tool and does not
authenticate callers.
