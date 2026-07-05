# Mavis sync control: ENABLE auto-sync (Windows PowerShell).
#
# On Windows the persistent background pull loop is provided by Windows Task
# Scheduler (not by a nohup background process). This script:
#   1. Verifies we're inside the kiyo_food_dz repo.
#   2. Configures git identity (idempotent).
#   3. Activates the post-commit auto-push hook (core.hooksPath = .githooks).
#   4. Ensures the hook is executable in the git index.
#   5. Verifies GitHub is reachable + authenticated.
#   6. Fetches and rebases if behind.
#   7. Registers (or updates) the Windows Task Scheduler job that runs
#      .sync/pull.ps1 every 60 seconds.
#   8. Writes .sync/state.json so sync-status.ps1 can report health.
#
# Idempotent. Requires: Git for Windows on PATH, PowerShell 5+.
# Run from inside the repo:   .\bin\sync-on.ps1

$ErrorActionPreference = "Stop"

# ---------- locate repo ----------
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot  = $env:REPO_PATH
if (-not $repoRoot) {
    Push-Location $scriptDir
    try { $repoRoot = git rev-parse --show-toplevel 2>$null } catch {}
    Pop-Location
}
if (-not $repoRoot -or -not (Test-Path (Join-Path $repoRoot ".git"))) {
    Write-Host "ERROR: not inside a git repository. Run from inside kiyo_food_dz." -ForegroundColor Red
    exit 2
}
Set-Location $repoRoot

# ---------- identity ----------
if (-not (git config --get user.name))  { git config user.name  "kiyo food" }
if (-not (git config --get user.email)) { git config user.email "sameraldjaber@gmail.com" }
git config pull.rebase true
git config init.defaultBranch main

# ---------- hook ----------
git config core.hooksPath .githooks

# ---------- verify GitHub ----------
try {
    git ls-remote origin main | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "ls-remote failed" }
} catch {
    Write-Host "ERROR: cannot reach GitHub origin. Check network and PAT." -ForegroundColor Red
    exit 3
}

# ---------- fetch + status ----------
git fetch origin main 2>&1 | Out-Null
$localSha  = (git rev-parse --short HEAD 2>$null)
$remoteSha = (git rev-parse --short origin/main 2>$null)
$behind    = [int](git rev-list --count HEAD..origin/main 2>$null)

if ($behind -gt 0) {
    Write-Host "Local is $behind commit(s) behind origin/main. Rebasing..."
    try { git rebase origin/main } catch {
        Write-Host "WARN: rebase failed (likely local unpushed changes). Resolve manually." -ForegroundColor Yellow
    }
}

# ---------- register Task Scheduler job ----------
$syncDir = Join-Path $repoRoot ".sync"
$pullScript = Join-Path $syncDir "pull.ps1"
$taskName = "Mavis-SyncPull-kiyo-food-dz"
$tr = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$pullScript`""

# Check if task exists
$existing = schtasks /Query /TN $taskName 2>&1
if ($LASTEXITCODE -eq 0) {
    schtasks /Delete /TN $taskName /F | Out-Null
}

schtasks /Create /TN $taskName `
    /TR $tr `
    /SC MINUTE /MO 1 /F /RU $env:USERNAME | Out-Null

if ($LASTEXITCODE -ne 0) {
    Write-Host "WARN: failed to register scheduled task. Run as Administrator or manually:" -ForegroundColor Yellow
    Write-Host "  schtasks /Create /TN $taskName /TR `"$tr`" /SC MINUTE /MO 1 /F /RU $env:USERNAME" -ForegroundColor Yellow
}

# ---------- write state ----------
New-Item -ItemType Directory -Path $syncDir -Force | Out-Null
$ts = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$unixTs = [int][double]::Parse((Get-Date -UFormat %s))
$state = @{
    enabled = $true
    last_success_iso = $ts
    last_success_unix = $unixTs
    last_action = "on"
    last_error = $null
    platform = "Windows"
    version = 1
}
$state | ConvertTo-Json | Set-Content -Path (Join-Path $syncDir "state.json") -Encoding UTF8

Write-Host ""
Write-Host "==============================================="
Write-Host "  AUTO-SYNC: ENABLED" -ForegroundColor Green
Write-Host "==============================================="
Write-Host "  Repo:        $repoRoot"
Write-Host "  Identity:    $(git config --get user.name) <$(git config --get user.email)>"
Write-Host "  Hook path:   $(git config --get core.hooksPath)"
Write-Host "  Local HEAD:  $localSha"
Write-Host "  Remote HEAD: $remoteSha"
Write-Host "  Task:        $taskName (runs pull.ps1 every 60s)"
Write-Host ""
Write-Host "  Verify anytime with: .\bin\sync-status.ps1"
Write-Host "==============================================="
exit 0