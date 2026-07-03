#!/usr/bin/env bash
# Mavis sync control: SHOW sync status (the dashboard).
#
# What it reports:
#   - Auto-sync enabled / disabled (from .sync/state.json + git config)
#   - GitHub reachable? + authenticated?
#   - Local HEAD vs origin/main (ahead / behind / in-sync)
#   - Working tree clean / dirty (with file count if dirty)
#   - Post-commit hook enabled + executable?
#   - Background pull loop running? (PID alive?)
#   - Last successful push to GitHub (from .sync/push.log)
#   - Last successful pull from GitHub (from .sync/pull.log)
#   - Overall: HEALTHY / DEGRADED / DISABLED / ERROR
#
# Output: human-readable by default. Pass --json for machine output.
# Exit codes: 0 = healthy / disabled (no action needed)
#             1 = degraded (something needs attention)
#             2 = error (sync broken, manual fix needed)

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${REPO_PATH:-$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || true)}"
if [ -z "$REPO_ROOT" ] || [ ! -d "$REPO_ROOT/.git" ]; then
    echo "ERROR: not inside a git repository. Run from inside kiyo_food_dz." >&2
    exit 2
fi
cd "$REPO_ROOT"

JSON_MODE=0
QUIET=0
for arg in "$@"; do
    case "$arg" in
        --json) JSON_MODE=1 ;;
        --quiet|-q) QUIET=1 ;;
        --help|-h)
            echo "Usage: $0 [--json] [--quiet]"
            echo "  --json   machine-readable JSON output"
            echo "  --quiet  exit-code only (0 healthy/disabled, 1 degraded, 2 error)"
            exit 0
            ;;
    esac
done

# ---------- gather signals ----------
NOW_UNIX=$(date -u '+%s')

# State file
STATE_ENABLED="unknown"
STATE_LAST_OK_ISO=""
STATE_LAST_OK_UNIX=0
STATE_LAST_ACTION=""
STATE_LAST_ERROR=""
if [ -f .sync/state.json ]; then
    STATE_ENABLED=$(python3 -c "import json; d=json.load(open('.sync/state.json')); v=d.get('enabled','unknown'); print(str(v).lower() if isinstance(v,bool) else v)" 2>/dev/null || echo "unknown")
    STATE_LAST_OK_ISO=$(python3 -c "import json; d=json.load(open('.sync/state.json')); print(d.get('last_success_iso',''))" 2>/dev/null || echo "")
    STATE_LAST_OK_UNIX=$(python3 -c "import json; d=json.load(open('.sync/state.json')); print(d.get('last_success_unix',0))" 2>/dev/null || echo "0")
    STATE_LAST_ACTION=$(python3 -c "import json; d=json.load(open('.sync/state.json')); print(d.get('last_action',''))" 2>/dev/null || echo "")
    STATE_LAST_ERROR=$(python3 -c "import json; d=json.load(open('.sync/state.json')); v=d.get('last_error'); print(v if v else '')" 2>/dev/null || echo "")
fi

# GitHub reachability (with timeout)
GITHUB_OK=0
GITHUB_MSG=""
if timeout 5 git ls-remote origin main >/dev/null 2>&1; then
    GITHUB_OK=1
    GITHUB_MSG="reachable"
else
    GITHUB_MSG="unreachable or auth failed"
fi

# Local vs origin
LOCAL_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "none")
REMOTE_SHA="?"
AHEAD=0
BEHIND=0
if [ "$GITHUB_OK" = "1" ]; then
    git fetch origin main >/dev/null 2>&1 || true
    REMOTE_SHA=$(git rev-parse --short origin/main 2>/dev/null || echo "?")
    AHEAD=$(git rev-list --count origin/main..HEAD 2>/dev/null || echo "?")
    BEHIND=$(git rev-list --count HEAD..origin/main 2>/dev/null || echo "?")
fi

# Working tree
WORKING_TREE="clean"
DIRTY_COUNT=0
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
    DIRTY_COUNT=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
    WORKING_TREE="dirty ($DIRTY_COUNT files)"
fi

# Hook
HOOK_PATH=$(git config --get core.hooksPath || echo "")
HOOK_ENABLED=0
[ "$HOOK_PATH" = ".githooks" ] && HOOK_ENABLED=1
HOOK_EXEC=0
[ -x .githooks/post-commit ] && HOOK_EXEC=1

# Background pull loop
PID_FILE=".sync/pull.pid"
PULL_LOOP="stopped"
PULL_PID=""
if [ -f "$PID_FILE" ]; then
    PULL_PID=$(cat "$PID_FILE" 2>/dev/null || echo "")
    if [ -n "$PULL_PID" ] && kill -0 "$PULL_PID" 2>/dev/null; then
        PULL_LOOP="running (PID $PULL_PID)"
    else
        PULL_LOOP="stale (PID $PULL_PID not alive)"
        PULL_PID=""
    fi
fi

# Last successful push (most recent "push OK" in push.log)
LAST_PUSH_OK=""
if [ -f .sync/push.log ]; then
    LAST_PUSH_OK=$(grep -E "push OK" .sync/push.log 2>/dev/null | tail -1 | sed -E 's/^\[([^]]+)\].*/\1/' || echo "")
fi
# Last successful pull (most recent "pull OK" in pull.log)
LAST_PULL_OK=""
if [ -f .sync/pull.log ]; then
    LAST_PULL_OK=$(grep -E "pull OK" .sync/pull.log 2>/dev/null | tail -1 | sed -E 's/^\[([^]]+)\].*/\1/' || echo "")
fi

# ---------- overall health ----------
OVERALL="HEALTHY"
EXIT_CODE=0
ISSUES=()

if [ "$GITHUB_OK" != "1" ]; then
    OVERALL="ERROR"
    EXIT_CODE=2
    ISSUES+=("GitHub unreachable or auth failed")
fi
if [ "$HOOK_ENABLED" != "1" ] && [ "$STATE_ENABLED" = "true" ]; then
    OVERALL="DEGRADED"
    EXIT_CODE=1
    ISSUES+=("state.json says enabled but hook is not active")
fi
if [ "$HOOK_ENABLED" = "1" ] && [ "$HOOK_EXEC" != "1" ]; then
    OVERALL="DEGRADED"
    EXIT_CODE=1
    ISSUES+=("hook configured but not executable: chmod +x .githooks/post-commit")
fi
if [ "$AHEAD" != "0" ] && [ "$AHEAD" != "?" ]; then
    OVERALL="DEGRADED"
    EXIT_CODE=1
    ISSUES+=("local is $AHEAD commit(s) ahead of origin (unpushed commits)")
fi
if [ "$BEHIND" != "0" ] && [ "$BEHIND" != "?" ] && [ "$PULL_LOOP" = "stopped" ] && [ "$STATE_ENABLED" = "true" ]; then
    OVERALL="DEGRADED"
    EXIT_CODE=1
    ISSUES+=("local is $BEHIND commit(s) behind origin and no pull loop is running")
fi

# ---------- output ----------
if [ "$JSON_MODE" = "1" ]; then
    cat <<EOF
{
  "overall": "$OVERALL",
  "exit_code": $EXIT_CODE,
  "repo": "$REPO_ROOT",
  "enabled_state": "$STATE_ENABLED",
  "github": {"reachable": $([ "$GITHUB_OK" = "1" ] && echo true || echo false), "message": "$GITHUB_MSG"},
  "local_head": "$LOCAL_SHA",
  "remote_head": "$REMOTE_SHA",
  "ahead": "$AHEAD",
  "behind": "$BEHIND",
  "working_tree": "$WORKING_TREE",
  "hook": {"path": "$HOOK_PATH", "enabled": $([ "$HOOK_ENABLED" = "1" ] && echo true || echo false), "executable": $([ "$HOOK_EXEC" = "1" ] && echo true || echo false)},
  "pull_loop": {"status": "$PULL_LOOP", "pid": "$PULL_PID"},
  "last_push_ok": "$LAST_PUSH_OK",
  "last_pull_ok": "$LAST_PULL_OK",
  "state_file": {"last_action": "$STATE_LAST_ACTION", "last_success_iso": "$STATE_LAST_OK_ISO", "last_error": "$STATE_LAST_ERROR"},
  "issues": $(printf '%s\n' "${ISSUES[@]:-}" | python3 -c "import json,sys; print(json.dumps([l.strip() for l in sys.stdin if l.strip()]))")
}
EOF
    exit $EXIT_CODE
fi

if [ "$QUIET" = "1" ]; then
    exit $EXIT_CODE
fi

# Human-readable
ok() { echo "  ✅ $1"; }
warn() { echo "  ⚠️  $1"; }
bad() { echo "  ❌ $1"; }
info() { echo "  ℹ️  $1"; }

case "$OVERALL" in
    HEALTHY)   echo "🟢 STATUS: HEALTHY" ;;
    DEGRADED)  echo "🟡 STATUS: DEGRADED" ;;
    DISABLED)  echo "⚪ STATUS: DISABLED" ;;
    ERROR)     echo "🔴 STATUS: ERROR" ;;
esac
echo ""
echo "── Source of truth ──"
[ "$GITHUB_OK" = "1" ] && ok "GitHub reachable (origin/main @ $REMOTE_SHA)" || bad "GitHub: $GITHUB_MSG"
info "Local HEAD:  $LOCAL_SHA"
info "Remote HEAD: $REMOTE_SHA"
[ "$AHEAD" = "0" ] || info "Ahead by $AHEAD commit(s)"
[ "$BEHIND" = "0" ] || info "Behind by $BEHIND commit(s)"
echo ""
echo "── Auto-sync state ──"
case "$STATE_ENABLED" in
    true)  ok "Enabled (last action: $STATE_LAST_ACTION @ $STATE_LAST_OK_ISO)" ;;
    false) warn "Disabled (last action: $STATE_LAST_ACTION @ $STATE_LAST_OK_ISO)" ;;
    *)     warn "State file missing or unreadable" ;;
esac
echo ""
echo "── Hooks ──"
[ "$HOOK_ENABLED" = "1" ] && ok "core.hooksPath = $HOOK_PATH" || warn "core.hooksPath = '${HOOK_PATH:-<unset>}'"
[ "$HOOK_EXEC" = "1" ] && ok ".githooks/post-commit is executable" || warn ".githooks/post-commit is NOT executable"
echo ""
echo "── Pull loop ──"
case "$PULL_LOOP" in
    running*)  ok "$PULL_LOOP" ;;
    stopped)   info "not running (run ./bin/sync-on.sh to start)" ;;
    stale*)    warn "$PULL_LOOP — run ./bin/sync-on.sh to restart" ;;
esac
echo ""
echo "── Last activity ──"
[ -n "$LAST_PUSH_OK" ] && info "Last push OK : $LAST_PUSH_OK" || info "Last push OK : (none recorded)"
[ -n "$LAST_PULL_OK" ] && info "Last pull OK : $LAST_PULL_OK" || info "Last pull OK : (none recorded)"
echo ""
echo "── Working tree ──"
[ "$WORKING_TREE" = "clean" ] && ok "clean" || warn "$WORKING_TREE"
echo ""

if [ "${#ISSUES[@]}" -gt 0 ]; then
    echo "── Issues ──"
    for issue in "${ISSUES[@]}"; do
        warn "$issue"
    done
    echo ""
fi

echo "Commands:"
echo "  ./bin/sync-on.sh       enable auto-sync (idempotent)"
echo "  ./bin/sync-off.sh      disable auto-sync"
echo "  ./bin/sync-status.sh   this report (--json for machines)"
echo ""
exit $EXIT_CODE