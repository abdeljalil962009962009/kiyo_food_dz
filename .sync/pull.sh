#!/usr/bin/env bash
# Mavis auto-pull (POSIX/bash port of pull.ps1 for Linux / macOS / WSL).
# Fetches from origin and rebases the current branch. Designed to be triggered
# by cron / systemd timer / launchd every ~60s.
#
# Usage:
#   ./pull.sh [REPO_PATH]         # default: cwd
#   REPO_PATH=/path/to/repo ./pull.sh
#
# Logs to .sync/pull.log (gitignored). Old log rotated at 1MB.
# Exit codes: 0 = up to date or pulled OK, 1 = error, 2 = nothing to do.

set -u

REPO_PATH="${1:-${REPO_PATH:-$(pwd)}}"
SYNC_DIR="$REPO_PATH/.sync"
LOG_FILE="$SYNC_DIR/pull.log"

mkdir -p "$SYNC_DIR"

# Rotate log if > 1MB
if [ -f "$LOG_FILE" ] && [ "$(stat -c%s "$LOG_FILE" 2>/dev/null || stat -f%z "$LOG_FILE" 2>/dev/null)" -gt 1048576 ]; then
    [ -f "$LOG_FILE.old" ] && rm -f "$LOG_FILE.old"
    mv "$LOG_FILE" "$LOG_FILE.old"
fi

TS=$(date '+%Y-%m-%d %H:%M:%S')

# Validate repo
if [ ! -d "$REPO_PATH/.git" ]; then
    echo "[$TS] ERROR: not a git repo: $REPO_PATH" >> "$LOG_FILE"
    exit 1
fi

cd "$REPO_PATH" || exit 1

# Current branch
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
if [ -z "$BRANCH" ] || [ "$BRANCH" = "HEAD" ]; then
    echo "[$TS] ERROR: cannot determine branch (detached HEAD?)" >> "$LOG_FILE"
    exit 1
fi

# Fetch
if ! git fetch origin >> "$LOG_FILE" 2>&1; then
    echo "[$TS] WARN: fetch failed (network?)" >> "$LOG_FILE"
    exit 1
fi

# Compare local vs remote
LOCAL=$(git rev-parse HEAD 2>/dev/null)
REMOTE=$(git rev-parse "origin/$BRANCH" 2>/dev/null)

if [ -z "$REMOTE" ]; then
    echo "[$TS] WARN: origin/$BRANCH not found" >> "$LOG_FILE"
    exit 1
fi

if [ "$LOCAL" = "$REMOTE" ]; then
    # Up to date - silent
    exit 0
fi

BASE=$(git merge-base HEAD "origin/$BRANCH" 2>/dev/null)

if [ "$BASE" = "$REMOTE" ]; then
    # We're ahead - nothing to pull
    exit 0
elif [ "$BASE" = "$LOCAL" ]; then
    # Behind remote - pull with rebase.
    # Count NEW commits BEFORE pulling (after, HEAD includes them so count would be 0).
    NEW_COUNT=$(git rev-list --count "origin/$BRANCH" "^HEAD" 2>/dev/null || echo "?")
    if PULL_OUT=$(git pull --rebase origin "$BRANCH" 2>&1); then
        echo "[$TS] pull OK - $NEW_COUNT new commit(s) on $BRANCH" >> "$LOG_FILE"
    else
        echo "[$TS] ERROR: pull failed - $PULL_OUT" >> "$LOG_FILE"
        exit 1
    fi
else
    # Diverged - attempt rebase
    echo "[$TS] WARN: diverged from origin/$BRANCH, attempting rebase" >> "$LOG_FILE"
    if REBASE_OUT=$(git rebase "origin/$BRANCH" 2>&1); then
        echo "[$TS] rebase OK" >> "$LOG_FILE"
    else
        echo "[$TS] ERROR: rebase failed - $REBASE_OUT" >> "$LOG_FILE"
        git rebase --abort >/dev/null 2>&1
        exit 1
    fi
fi