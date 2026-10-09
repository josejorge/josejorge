# File: refresh-dashboard.ps1
# Description: One-click refresh of assets/dashboard.png - triggers the Update Grafana Dashboard workflow, waits for it, and pulls the new screenshot.
# Author: Jose-Jorge HERNANDEZ
# Company: Parlee Conseiller, Inc.
# Date: 2026-10-09
# Last edit date: 2026-10-09
# Version: 1.0.0
#
# Usage (from anywhere): pwsh -File scripts\refresh-dashboard.ps1
# Requires: the GitHub CLI (`gh`) logged in, and git.

# Stop on the first error so a failed step is never followed by a misleading "done".
$ErrorActionPreference = 'Stop'

# Name of the workflow file under .github/workflows (single place to change it).
$WorkflowFile = 'update-dashboard.yml'

# Branch the workflow commits the screenshot to.
$Branch = 'main'

# How long to wait for the new run to show up after dispatching it, and how often to poll.
$RunLookupTimeoutSeconds = 60
$PollIntervalSeconds = 3

# Run from the repo root regardless of where the script was started.
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

# Remember when we dispatched, so we can tell our run apart from older ones.
$Started = (Get-Date).ToUniversalTime().AddSeconds(-5)

Write-Host "Triggering workflow $WorkflowFile ..."
gh workflow run $WorkflowFile
if ($LASTEXITCODE -ne 0) { throw 'gh workflow run failed (is gh logged in? try: gh auth status)' }

# Poll until a manually-dispatched run created after $Started appears; its id is needed to watch it.
$RunId = $null
$Deadline = (Get-Date).AddSeconds($RunLookupTimeoutSeconds)
while (-not $RunId -and (Get-Date) -lt $Deadline) {
    Start-Sleep -Seconds $PollIntervalSeconds
    $Runs = gh run list --workflow $WorkflowFile --event workflow_dispatch --limit 5 --json databaseId,createdAt | ConvertFrom-Json
    $Mine = $Runs | Where-Object { [datetime]$_.createdAt -ge $Started } | Select-Object -First 1
    if ($Mine) { $RunId = $Mine.databaseId }
}
if (-not $RunId) { throw "Could not find the new workflow run within $RunLookupTimeoutSeconds s - check the Actions tab." }

# Block until the run finishes; --exit-status makes a failed run fail this script too.
Write-Host "Watching run $RunId ..."
gh run watch $RunId --exit-status | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Workflow run $RunId failed - see: gh run view $RunId --log-failed" }

# The workflow committed the new image on GitHub; bring it down locally (--autostash keeps any uncommitted local edits safe).
Write-Host 'Pulling the new screenshot ...'
git pull --rebase --autostash origin $Branch
if ($LASTEXITCODE -ne 0) { throw 'git pull failed - resolve local changes and pull manually.' }

Write-Host "Done. Updated: $(Join-Path $RepoRoot 'assets\dashboard.png')"
