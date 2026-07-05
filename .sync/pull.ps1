# Mavis auto-pull: fetches from origin and rebases the current branch.
# Triggered by Windows Task Scheduler (Mavis-SyncPull-kiyo-food-dz) every 60s.
# Survives reboots, runs whether user is logged in or screen is locked.
# Logs to .sync/pull.log (gitignored). Old log rotated at 1MB.

$ErrorActionPreference = "Continue"

$repoPath = "C:\Users\abdel\.minimax-agent\projects\pocket"
$syncDir  = Join-Path $repoPath ".sync"
$logFile  = Join-Path $syncDir "pull.log"

# Ensure sync dir exists
if (-not (Test-Path $syncDir)) {
    New-Item -ItemType Directory -Path $syncDir -Force | Out-Null
}

# Rotate log if > 1MB
if ((Test-Path $logFile) -and (Get-Item $logFile).Length -gt 1MB) {
    $archive = "$logFile.old"
    if (Test-Path $archive) { Remove-Item $archive -Force }
    Move-Item $logFile $archive -Force
}

$ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

# Validate repo
if (-not (Test-Path (Join-Path $repoPath ".git"))) {
    Add-Content $logFile "[$ts] ERROR: not a git repo: $repoPath"
    exit 1
}

Set-Location $repoPath

# Get current branch
$branch = git rev-parse --abbrev-ref HEAD 2>&1
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($branch)) {
    Add-Content $logFile "[$ts] ERROR: cannot determine branch"
    exit 1
}

# Fetch
git fetch origin 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Add-Content $logFile "[$ts] WARN: fetch failed (network?)"
    exit 1
}

# Compare local vs remote
$local  = git rev-parse HEAD 2>$null
$remote = git rev-parse "origin/$branch" 2>$null

if (-not $remote) {
    Add-Content $logFile "[$ts] WARN: origin/$branch not found"
    exit 1
}

if ($local -eq $remote) {
    # Up to date - silent (do not spam the log)
    exit 0
}

# Check relationship (fast-forward vs diverged)
$base = git merge-base HEAD "origin/$branch" 2>$null

if ($base -eq $remote) {
    # We're ahead - local commits not pushed yet, nothing to pull
    exit 0
}

if ($base -eq $local) {
    # Behind remote - pull with rebase.
    # Count NEW commits BEFORE pulling (after, HEAD includes them so count would be 0).
    $newCount = (git rev-list --count "origin/$branch" "^HEAD" 2>$null)
    if ($LASTEXITCODE -ne 0) { $newCount = "?" }
    $pullOut = git pull --rebase origin $branch 2>&1
    if ($LASTEXITCODE -eq 0) {
        Add-Content $logFile "[$ts] pull OK - $newCount new commit(s) on $branch"
    } else {
        Add-Content $logFile "[$ts] ERROR: pull failed - $pullOut"
        exit 1
    }
} else {
    # Diverged - try rebase first, then abort on failure
    Add-Content $logFile "[$ts] WARN: diverged from origin/$branch, attempting rebase"
    $rebaseOut = git rebase "origin/$branch" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Add-Content $logFile "[$ts] rebase OK"
    } else {
        Add-Content $logFile "[$ts] ERROR: rebase failed - $rebaseOut"
        git rebase --abort 2>&1 | Out-Null
        exit 1
    }
}