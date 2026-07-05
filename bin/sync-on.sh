#!/usr/bin/env bash
# Mavis sync control: ENABLE auto-sync for this workspace.
#
# What it does:
#   1. Verifies we're inside the kiyo_food_dz repo.
#   2. Configures git identity (idempotent: only sets if currently empty).
#   3. Activates the post-commit auto-push hook (core.hooksPath = .githooks).
#   4. Ensures the hook is executable.
#   5. Verifies GitHub is reachable and authentication works.
#   6. Fetches latest and rebases if behind.
#   7. Starts a background pull loop (60s) on Linux/macOS/WSL and records its PID.
#   8. Writes .sync/state.json so sync-status can report health.
#
# Idempotent: running it twice is safe.
#
# Usage:
#   ./bin/sync-on.sh                # auto-detect (Linux/macOS/WSL use this)
#   REPO_PATH=/path ./bin/sync-on.sh

set -euo pipefail

# ---------- locate repo ----------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${REPO_PATH:-$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || true)}"
if [ -z "$REPO_ROOT" ] || [ ! -d "$REPO_ROOT/.git" ]; then
    echo "ERROR: not inside a git repository. Run from inside kiyo_food_dz." >&2
    exit 2
fi
cd "$REPO_ROOT"

# Identity (only set if currently empty, so we never overwrite the user's identity)
if [ -z "$(git config --get user.name || true)" ]; then
    git config user.name "kiyo food"
fi
if [ -z "$(git config --get user.email || true)" ]; then
    git config user.email "sameraldjaber@gmail.com"
fi
git config pull.rebase true
git config init.defaultBranch main

# Hook activation
git config core.hooksPath .githooks
chmod +x .githooks/post-commit 2>/dev/null || true

# ---------- verify GitHub reachable + authenticated ----------
if ! git ls-remote origin main >/dev/null 2>&1; then
    echo "ERROR: cannot reach GitHub origin. Check network and PAT." >&2
    write_state "off" "git ls-remote failed (network or auth)" || true
    exit 3
fi

# Fetch + status
git fetch origin main >/dev/null 2>&1 || true

LOCAL_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "none")
REMOTE_SHA=$(git rev-parse --short origin/main 2>/dev/null || echo "none")

if [ "$LOCAL_SHA" != "$REMOTE_SHA" ]; then
    BEHIND=$(git rev-list --count HEAD..origin/main 2>/dev/null || echo "?")
    if [ "$BEHIND" != "0" ] && [ "$BEHIND" != "?" ]; then
        echo "Local is $BEHIND commit(s) behind origin/main. Rebasing..."
        if ! git rebase origin/main; then
            echo "WARN: rebase failed (likely local unpushed changes). Resolve manually." >&2
        fi
    fi
fi

# ---------- start background pull loop (Linux/macOS/WSL only) ----------
mkdir -p .sync
PID_FILE=".sync/pull.pid"
LOG_FILE=".sync/pull.log"

# If a stale PID exists, check if it's still alive
if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE" 2>/dev/null || echo "")
    if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
        echo "Background pull loop already running (PID $OLD_PID)."
    else
        rm -f "$PID_FILE"
    fi
fi

if [ ! -f "$PID_FILE" ]; then
    nohup bash -c 'while true; do REPO_PATH='"$REPO_ROOT"' ./.sync/pull.sh >> .sync/pull.log 2>&1; sleep 60; done' \
        >/dev/null 2>&1 &
    NEW_PID=$!
    echo "$NEW_PID" > "$PID_FILE"
    disown "$NEW_PID" 2>/dev/null || true
    sleep 1
    if kill -0 "$NEW_PID" 2>/dev/null; then
        echo "Background pull loop started (PID $NEW_PID, interval 60s)."
    else
        echo "WARN: background pull loop failed to stay alive. Will not auto-pull in this session." >&2
        rm -f "$PID_FILE"
    fi
fi

# ---------- write state ----------
TS=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
UNIX_TS=$(date -u '+%s')
cat > ".sync/state.json.tmp" <<EOF
{
  "enabled": true,
  "last_success_iso": "$TS",
  "last_success_unix": $UNIX_TS,
  "last_action": "on",
  "last_error": null,
  "platform": "$(uname -s 2>/dev/null || echo unknown)",
  "version": 1
}
EOF
mv ".sync/state.json.tmp" ".sync/state.json"

echo ""
echo "==============================================="
echo "  AUTO-SYNC: ENABLED"
echo "==============================================="
echo "  Repo:        $REPO_ROOT"
echo "  Identity:    $(git config --get user.name) <$(git config --get user.email)>"
echo "  Hook path:   $(git config --get core.hooksPath)"
echo "  Local HEAD:  $LOCAL_SHA"
echo "  Origin HEAD: $REMOTE_SHA"
echo "  Pull loop:   PID $(cat "$PID_FILE" 2>/dev/null || echo 'not running')"
echo ""
echo "  Next: commits will auto-push to GitHub."
echo "  Verify anytime with: ./bin/sync-status.sh"
echo "==============================================="
exit 0