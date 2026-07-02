# Sync Infrastructure (Mavis workspace)

This document explains how the local workspace at `C:\Users\abdel\.minimax-agent\projects\pocket` stays in sync with the GitHub repository. Read this if the sync breaks or you're setting up the workspace on a new machine.

## Architecture

```
   Bolt (browser)   ──auto-push──▶   GitHub (single source of truth)
                                            │
                          ┌─────────────────┼──────────────────┐
                          ▼                 ▼                  ▼
                    Vercel            Bolt (polls         Mavis workspace
                  (auto-deploy)      every 30s)        (polls every 60s)
```

- **GitHub is the single source of truth.**
- **Bolt → GitHub**: automatic on every change (Bolt's built-in auto-commit + auto-push).
- **GitHub → Vercel**: automatic via Vercel's GitHub webhook (no manual deploy needed).
- **GitHub → Bolt**: automatic, Bolt polls every 30s and pulls.
- **GitHub → Mavis workspace**: automatic via Windows Task Scheduler (see below).
- **Mavis workspace → GitHub**: automatic via post-commit hook (see below).

## Components in this repo

### `.githooks/post-commit`
Git hook that runs `git push` after every commit. Configured via `git config core.hooksPath .githooks`. Logs to `.sync/push.log`.

### `.sync/pull.ps1`
PowerShell script that fetches from origin and rebases the current branch. Triggered by Windows Task Scheduler every 60 seconds. Logs to `.sync/pull.log`.

### `.gitignore` rules
```
.sync/*
!.sync/pull.ps1
```
Sync scripts are tracked (for disaster recovery). Logs are ignored (ephemeral).

## Local setup on a new machine

If you need to rebuild this setup from scratch:

1. **Install Git**: `winget install --id Git.Git -e --source winget`
2. **Clone the repo**:
   ```bash
   git clone https://github.com/abdeljalil962009962009/kiyo_food_dz.git C:\Users\abdel\.minimax-agent\projects\pocket
   ```
3. **Configure git** (one-time, after cloning):
   ```bash
   cd C:\Users\abdel\.minimax-agent\projects\pocket
   git config user.name "kiyo food"
   git config user.email "sameraldjaber@gmail.com"
   git config core.hooksPath .githooks
   ```
4. **Authenticate with GitHub** (PAT prompted on first push, then cached by Windows Credential Manager):
   ```bash
   git fetch origin
   ```
   Enter the PAT when prompted. It will be cached for all future operations.

5. **Register the scheduled task** (run once as the user, in PowerShell):
   ```powershell
   $scriptPath = "C:\Users\abdel\.minimax-agent\projects\pocket\.sync\pull.ps1"
   schtasks /Create /TN "Mavis-SyncPull-kiyo-food-dz" `
       /TR "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`"" `
       /SC MINUTE /MO 1 /F /RU $env:USERNAME
   ```

6. **Verify**:
   - Make a small commit and push (hook should auto-push)
   - Wait 60s, check `.sync/pull.log` for activity
   - Open Bolt, make a change, watch it appear in the workspace within ~60s

## Troubleshooting

### Sync appears stuck

1. Check the scheduled task exists and is enabled:
   ```powershell
   schtasks /Query /TN "Mavis-SyncPull-kiyo-food-dz" /V /FO LIST
   ```
   Look for `Statut: Prêt` (Status: Ready) and recent `Heure de la dernière exécution` (Last Run Time).

2. Read the sync logs:
   ```powershell
   Get-Content C:\Users\abdel\.minimax-agent\projects\pocket\.sync\pull.log -Tail 20
   Get-Content C:\Users\abdel\.minimax-agent\projects\pocket\.sync\push.log -Tail 20
   ```

3. Manually trigger a pull to see what's happening:
   ```powershell
   cd C:\Users\abdel\.minimax-agent\projects\pocket
   git fetch origin
   git status
   git pull --rebase origin main
   ```

4. Check GitHub credentials:
   ```powershell
   git fetch origin
   ```
   If it prompts for a password, the credential cache is broken. Re-add the PAT:
   - Go to https://github.com/settings/tokens (generate new if old one expired)
   - Run `git fetch` and paste the PAT when prompted

### Post-commit hook doesn't push

Check `.sync/push.log`. If it shows "push FAILED", the most common cause is a network blip or an expired PAT. Run `git push` manually to retry.

### Bolt doesn't see my changes

Bolt polls every 30s, so it should pick up changes within a minute. If it doesn't:
- Open Bolt, click the GitHub icon, switch branches or refresh
- Bolt's auto-pull can lag if the WebContainer is busy — give it 60s

### Vercel doesn't deploy

Check Vercel dashboard → project → Deployments. Look for the latest commit hash. If the commit is there but no deployment was triggered:
- Check Vercel project settings → Git Integration → ensure the repo is connected and the production branch is `main`

## Security notes

- The GitHub PAT is stored in Windows Credential Manager (encrypted at rest, per-user).
- The PAT is **only** in `.sync/pull.ps1` and `.githooks/post-commit` indirectly (via git credential helper). Neither file contains the PAT directly.
- If you suspect the PAT was leaked, revoke it immediately: https://github.com/settings/tokens → click the token → "Delete".