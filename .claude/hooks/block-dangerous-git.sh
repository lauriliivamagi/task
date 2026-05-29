#!/usr/bin/env bash
#
# Claude Code PreToolUse hook: block destructive git operations.
#
# Reads the PreToolUse JSON payload on stdin and inspects Bash commands. Exits 2
# (with a reason on stderr, which is fed back to the agent) to block. Fails open
# (exit 0) if jq is unavailable so it never wedges tool use — install jq for the
# guardrail to take effect.
set -euo pipefail

command -v jq >/dev/null 2>&1 || exit 0

input="$(cat)"
tool="$(printf '%s' "$input" | jq -r '.tool_name // empty')"
[ "$tool" = "Bash" ] || exit 0
cmd="$(printf '%s' "$input" | jq -r '.tool_input.command // empty')"
[ -n "$cmd" ] || exit 0

match() { printf '%s' "$cmd" | grep -Eq "$1"; }

deny() {
  echo "BLOCKED (dangerous git): $1" >&2
  echo "Run it manually outside the agent if you are certain it is safe." >&2
  exit 2
}

if match 'git[[:space:]]+push[[:space:]].*(-f([[:space:]]|$)|--force)'; then
  deny "git push --force / -f rewrites remote history"
fi
if match 'git[[:space:]]+reset[[:space:]]+.*--hard'; then
  deny "git reset --hard discards uncommitted work"
fi
if match 'git[[:space:]]+clean[[:space:]].*-[a-zA-Z]*f'; then
  deny "git clean -f deletes untracked files"
fi
if match 'git[[:space:]]+branch[[:space:]]+.*-D'; then
  deny "git branch -D force-deletes branches"
fi
if match 'git[[:space:]]+(checkout|restore)[[:space:]]+(.*[[:space:]])?\.([[:space:]]|$)'; then
  deny "git checkout . / git restore . discards uncommitted changes"
fi

exit 0
