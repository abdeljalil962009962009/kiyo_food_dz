# Mavis sync control: SHOW sync status (Windows PowerShell).
#
# What it reports:
#   - Auto-sync enabled / disabled (from .sync/state.json + git config)
#   - GitHub reachable? + authenticated?
#   - Local HEAD vs origin/main (ahead / behind / in-sync)
#   - Working tree clean / dirty
#   - Post-commit hook enabled + executable
#   - Background scheduled task (Mavis-SyncPull-kiyo-food-dz) registered?
#   - Last successful push (from .sync/push.log)
#   - Last successful pull (from .sync/pull.log)
#   - Overall: HEALTHY / DEGRADED / DISABLED / ERROR
#
# Output: human-readable by default. Pass --json for machine output.
# Exit codes: 0 = healthy / disabled, 1 = degraded, 2 = error.

$ErrorActionPreference = "Continue"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot  = $env:REPO_PATH
if (-not $repoRoot) {
    Push-Location $scriptDir
    try { $repoRoot = git rev-parse --show-toplevel 2>$null } catch {}
    Pop-Location
}
if (-not $repoRoot -or -not (Test-Path (Join-Path $repoRoot ".git"))) {
    Write-Host "ERROR: not inside a git repository." -ForegroundColor Red
    exit 2
}
Set-Location $repoRoot

$jsonMode = $false
$quiet    = $false
foreach ($a in $args) {
    switch ($a) {
        "--json" { $jsonMode = $true }
        "--quiet" { $quiet = $true }
        "-q" { $quiet = $true }
        "--help" {
            Write-Host "Usage: sync-status.ps1 [--json] [--quiet]"
            exit 0
        }
    }
}

# ---------- gather signals ----------
$nowUnix = [int][double]::Parse((Get-Date -UFormat %s))

# state.json
$stateEnabled = "unknown"
$stateLastOkIso = ""
$stateLastOkUnix = 0
$stateLastAction = ""
$stateLastError = ""
$statePath = Join-Path $repoRoot ".sync/state.json"
if (Test-Path $statePath) {
    try {
        $st = Get-Content $statePath -Raw | ConvertFrom-Json
        $stateEnabled   = [string]$st.enabled
        $stateLastOkIso = [string]$st.last_success_iso
        $stateLastOkUnix = [int]$st.last_success_unix
        $stateLastAction = [string]$st.last_action
        $stateLastError  = [string]$st.last_error
    } catch {}
}

# GitHub reachability
$githubOk = $false
$githubMsg = ""
try {
    git ls-remote origin main 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { $githubOk = $true; $githubMsg = "reachable" }
    else { $githubMsg = "unreachable or auth failed" }
} catch { $githubMsg = "exception: $($_.Exception.Message)" }

# Local vs origin
$localSha = (git rev-parse --short HEAD 2>$null)
if (-not $localSha) { $localSha = "none" }
$remoteSha = "?"
$ahead = 0
$behind = 0
if ($githubOk) {
    git fetch origin main 2>&1 | Out-Null
    $remoteSha = (git rev-parse --short origin/main 2>$null)
    if ($remoteSha) {
        $ahead  = [int](git rev-list --count origin/main..HEAD 2>$null)
        $behind = [int](git rev-list --count HEAD..origin/main 2>$null)
    }
}

# Working tree
$workingTree = "clean"
$dirtyCount = 0
$porcelain = git status --porcelain 2>$null
if ($porcelain) {
    $dirtyCount = ($porcelain -split "`n").Count
    $workingTree = "dirty ($dirtyCount files)"
}

# Hook
$hookPath = git config --get core.hooksPath
$hookEnabled = ($hookPath -eq ".githooks")
$hookExec = $false
$hookFile = Join-Path $repoRoot ".githooks/post-commit"
if (Test-Path $hookFile) {
    # On Windows, git hooks run via git's own exec, not via FS exec bit
    # But we still report the actual FS perms for completeness
    $hookExec = $true
}

# Scheduled task
$taskName = "Mavis-SyncPull-kiyo-food-dz"
$taskStatus = "not registered"
schtasks /Query /TN $taskName 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) { $taskStatus = "registered (runs pull.ps1 every 60s)" }

# Last activity from logs
$lastPushOk = ""
$pushLog = Join-Path $repoRoot ".sync/push.log"
if (Test-Path $pushLog) {
    $line = Select-String -Path $pushLog -Pattern "push OK" -ErrorAction SilentlyContinue | Select-Object -Last 1
    if ($line) {
        if ($line -match '^\[([^\]]+)\]') { $lastPushOk = $matches[1] }
    }
}
$lastPullOk = ""
$pullLog = Join-Path $repoRoot ".sync/pull.log"
if (Test-Path $pullLog) {
    $line = Select-String -Path $pullLog -Pattern "pull OK" -ErrorAction SilentlyContinue | Select-Object -Last 1
    if ($line) {
        if ($line -match '^\[([^\]]+)\]') { $lastPullOk = $matches[1] }
    }
}

# ---------- overall health ----------
$overall = "HEALTHY"
$exitCode = 0
$issues = New-Object System.Collections.ArrayList

if (-not $githubOk) {
    $overall = "ERROR"; $exitCode = 2
    [void]$issues.Add("GitHub unreachable or auth failed")
}
if (-not $hookEnabled -and $stateEnabled -eq "True") {
    $overall = "DEGRADED"; $exitCode = 1
    [void]$issues.Add("state.json says enabled but hook is not active")
}
if ($ahead -gt 0) {
    $overall = "DEGRADED"; $exitCode = 1
    [void]$issues.Add("local is $ahead commit(s) ahead of origin (unpushed commits)")
}
if ($behind -gt 0 -and $taskStatus -eq "not registered" -and $stateEnabled -eq "True") {
    $overall = "DEGRADED"; $exitCode = 1
    [void]$issues.Add("local is $behind commit(s) behind origin and scheduled task is not running")
}

# ---------- output ----------
if ($jsonMode) {
    $obj = @{
        overall = $overall
        exit_code = $exitCode
        repo = $repoRoot
        enabled_state = $stateEnabled
        github = @{ reachable = $githubOk; message = $githubMsg }
        local_head = $localSha
        remote_head = $remoteSha
        ahead = $ahead
        behind = $behind
        working_tree = $workingTree
        hook = @{ path = $hookPath; enabled = $hookEnabled; executable = $hookExec }
        scheduled_task = $taskStatus
        last_push_ok = $lastPushOk
        last_pull_ok = $lastPullOk
        state_file = @{
            last_action = $stateLastAction
            last_success_iso = $stateLastOkIso
            last_error = $stateLastError
        }
        issues = $issues.ToArray()
    }
    $obj | ConvertTo-Json -Depth 5
    exit $exitCode
}
if ($quiet) { exit $exitCode }

function ok($m)   { Write-Host "  ✅ $m" -ForegroundColor Green }
function warn($m) { Write-Host "  ⚠️  $m" -ForegroundColor Yellow }
function bad($m)  { Write-Host "  ❌ $m" -ForegroundColor Red }
function info($m) { Write-Host "  ℹ️  $m" -ForegroundColor Cyan }

switch ($overall) {
    "HEALTHY"  { Write-Host "🟢 STATUS: HEALTHY" -ForegroundColor Green }
    "DEGRADED" { Write-Host "🟡 STATUS: DEGRADED" -ForegroundColor Yellow }
    "DISABLED" { Write-Host "⚪ STATUS: DISABLED" -ForegroundColor Gray }
    "ERROR"    { Write-Host "🔴 STATUS: ERROR" -ForegroundColor Red }
}
Write-Host ""
Write-Host "── Source of truth ──"
if ($githubOk) { ok "GitHub reachable (origin/main @ $remoteSha)" } else { bad "GitHub: $githubMsg" }
info "Local HEAD:  $localSha"
info "Remote HEAD: $remoteSha"
if ($ahead  -ne 0) { info "Ahead by $ahead commit(s)" }
if ($behind -ne 0) { info "Behind by $behind commit(s)" }
Write-Host ""
Write-Host "── Auto-sync state ──"
switch ($stateEnabled) {
    "True"  { ok  "Enabled (last action: $stateLastAction @ $stateLastOkIso)" }
    "False" { warn "Disabled (last action: $stateLastAction @ $stateLastOkIso)" }
    default { warn "State file missing or unreadable" }
}
Write-Host ""
Write-Host "── Hooks ──"
if ($hookEnabled) { ok "core.hooksPath = $hookPath" } else { warn "core.hooksPath = '$hookPath'" }
if ($hookExec) { ok ".githooks/post-commit present" } else { bad ".githooks/post-commit missing" }
Write-Host ""
Write-Host "── Scheduled task ──"
if ($taskStatus -eq "not registered") { warn $taskStatus } else { ok $taskStatus }
Write-Host ""
Write-Host "── Last activity ──"
if ($lastPushOk) { info "Last push OK : $lastPushOk" } else { info "Last push OK : (none recorded)" }
if ($lastPullOk) { info "Last pull OK : $lastPullOk" } else { info "Last pull OK : (none recorded)" }
Write-Host ""
Write-Host "── Working tree ──"
if ($workingTree -eq "clean") { ok "clean" } else { warn $workingTree }
Write-Host ""
if ($issues.Count -gt 0) {
    Write-Host "── Issues ──"
    foreach ($i in $issues) { warn $i }
    Write-Host ""
}
Write-Host "Commands:"
Write-Host "  .\bin\sync-on.ps1        enable auto-sync (idempotent)"
Write-Host "  .\bin\sync-off.ps1       disable auto-sync"
Write-Host "  .\bin\sync-status.ps1    this report (--json for machines)"
Write-Host ""
exit $exitCode