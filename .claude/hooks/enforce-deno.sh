#!/usr/bin/env bash
#
# Claude Code PreToolUse hook: enforce Deno over Node package managers.
#
# Blocks npm/yarn/pnpm/bun and bare `node` invocations, steering to `deno task`.
# Anchored on command-segment boundaries to avoid false positives on substrings
# like `nodemon`, paths containing `node_modules`, or `deno run --node-*`.
# Exits 2 to block; fails open (exit 0) if jq is unavailable.
set -euo pipefail

command -v jq >/dev/null 2>&1 || exit 0

input="$(cat)"
tool="$(printf '%s' "$input" | jq -r '.tool_name // empty')"
[ "$tool" = "Bash" ] || exit 0
cmd="$(printf '%s' "$input" | jq -r '.tool_input.command // empty')"
[ -n "$cmd" ] || exit 0

match() { printf '%s' "$cmd" | grep -Eq "$1"; }

deny() {
  echo "BLOCKED ($1): this is a Deno project." >&2
  echo "Use 'deno task <name>' (start|serve|tui|test|compile), 'deno run -A', 'deno check src/main.ts', 'deno fmt', 'deno lint'." >&2
  exit 2
}

if match '(^|[;&|][[:space:]]*)(npm|yarn|pnpm|bun)([[:space:]]|$)'; then
  deny "npm/yarn/pnpm/bun are not used here"
fi
if match '(^|[;&|][[:space:]]*)node([[:space:]]|$)'; then
  deny "bare 'node' is not used here"
fi

exit 0
