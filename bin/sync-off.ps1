# Mavis sync control: DISABLE auto-sync (Windows PowerShell).
#
# What it does (safely, in order):
#   1. Unregisters the Windows Task Scheduler job (Mavis-SyncPull-kiyo-food-dz).
#   2. Deactivates the post-commit auto-push hook (core.hooksPath = "").
#   3. Writes .sync/state.json so sync-status reflects DISABLED.
#
# After this:
#   - Commits stay local; you must `git push` manually.
#   - The 60s background pull stops.
#   - You can re-enable anytime with .\bin\sync-on.ps1.
#
# Note: this does NOT touch Bolt/Vercel — they will still respond to manual
#       pushes and to each other via GitHub.

$ErrorActionPreference = "Stop"

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

# ---------- unregister Task Scheduler job ----------
$taskName = "Mavis-SyncPull-kiyo-food-dz"
$existing = schtasks /Query /TN $taskName 2>&1
if ($LASTEXITCODE -eq 0) {
    schtasks /Delete /TN $taskName /F | Out-Null
    Write-Host "Scheduled task removed: $taskName"
} else {
    Write-Host "No scheduled task was registered."
}

# ---------- deactivate hook ----------
$prevHook = git config --get core.hooksPath
git config --unset core.hooksPath 2>$null

# ---------- write state ----------
$syncDir = Join-Path $repoRoot ".sync"
New-Item -ItemType Directory -Path $syncDir -Force | Out-Null
$ts = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$unixTs = [int][double]::Parse((Get-Date -UFormat %s))
$state = @{
    enabled = $false
    last_success_iso = $ts
    last_success_unix = $unixTs
    last_action = "off"
    last_error = $null
    platform = "Windows"
    previous_hook_path = $prevHook
    version = 1
}
$state | ConvertTo-Json | Set-Content -Path (Join-Path $syncDir "state.json") -Encoding UTF8

Write-Host ""
Write-Host "==============================================="
Write-Host "  AUTO-SYNC: DISABLED" -ForegroundColor Yellow
Write-Host "==============================================="
Write-Host "  Repo:        $repoRoot"
Write-Host "  Identity:    $(git config --get user.name) <$(git config --get user.email)>"
Write-Host "  Hook path:   (unset — post-commit will NOT auto-push)"
Write-Host "  Task:        unregistered"
Write-Host ""
Write-Host "  You can still commit locally. To publish:"
Write-Host "    git push origin main"
Write-Host ""
Write-Host "  Re-enable anytime with: .\bin\sync-on.ps1"
Write-Host "==============================================="
exit 0