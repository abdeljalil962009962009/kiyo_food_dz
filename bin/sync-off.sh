#!/usr/bin/env bash
# Mavis sync control: DISABLE auto-sync for this workspace.
#
# What it does (safely, in order):
#   1. Stops the background pull loop (if running) by killing its PID.
#   2. Deactivates the post-commit auto-push hook (core.hooksPath = "").
#   3. Writes .sync/state.json so sync-status reflects DISABLED.
#
# After this:
#   - Commits stay local; you must `git push` manually.
#   - Background pulls stop.
#   - You can re-enable any time with ./bin/sync-on.sh (it's idempotent and safe).
#
# Note: any pending unpushed commits are NOT lost — they remain in your local repo.
# Note: this does NOT touch Bolt/Vercel — they will still respond to manual pushes
#       and to each other via GitHub.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${REPO_PATH:-$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || true)}"
if [ -z "$REPO_ROOT" ] || [ ! -d "$REPO_ROOT/.git" ]; then
    echo "ERROR: not inside a git repository. Run from inside kiyo_food_dz." >&2
    exit 2
fi
cd "$REPO_ROOT"

# ---------- stop background pull loop ----------
PID_FILE=".sync/pull.pid"
if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE" 2>/dev/null || echo "")
    if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
        kill "$OLD_PID" 2>/dev/null || true
        sleep 1
        if kill -0 "$OLD_PID" 2>/dev/null; then
            kill -9 "$OLD_PID" 2>/dev/null || true
        fi
        echo "Background pull loop stopped (PID $OLD_PID)."
    else
        echo "Background pull loop PID file was stale; cleaned up."
    fi
    rm -f "$PID_FILE"
else
    echo "No background pull loop was running."
fi

# ---------- deactivate post-commit hook ----------
PREV_HOOK_PATH=$(git config --get core.hooksPath || echo "")
git config --unset core.hooksPath 2>/dev/null || git config core.hooksPath "" >/dev/null
# Verify it really unset
if [ -n "$(git config --get core.hooksPath || true)" ]; then
    echo "WARN: failed to unset core.hooksPath. Try: git config --unset core.hooksPath" >&2
fi

# ---------- write state ----------
TS=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
UNIX_TS=$(date -u '+%s')
mkdir -p .sync
cat > ".sync/state.json.tmp" <<EOF
{
  "enabled": false,
  "last_success_iso": "$TS",
  "last_success_unix": $UNIX_TS,
  "last_action": "off",
  "last_error": null,
  "platform": "$(uname -s 2>/dev/null || echo unknown)",
  "previous_hook_path": "$PREV_HOOK_PATH",
  "version": 1
}
EOF
mv ".sync/state.json.tmp" ".sync/state.json"

echo ""
echo "==============================================="
echo "  AUTO-SYNC: DISABLED"
echo "==============================================="
echo "  Repo:        $REPO_ROOT"
echo "  Identity:    $(git config --get user.name) <$(git config --get user.email)>"
echo "  Hook path:   (unset — post-commit will NOT auto-push)"
echo "  Pull loop:   stopped"
echo ""
echo "  You can still commit locally. To publish:"
echo "    git push origin main"
echo ""
echo "  Re-enable anytime with: ./bin/sync-on.sh"
echo "==============================================="
exit 0