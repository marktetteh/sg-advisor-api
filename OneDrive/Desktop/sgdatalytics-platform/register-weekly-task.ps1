# ============================================================
#  Registers a Windows Task Scheduler task to run run-weekly.ps1
#  every Monday at 07:00 AM.
#  Run once as Administrator.
# ============================================================

$TaskName  = "SG Datalytics Weekly Collection"
$ScriptDir = $PSScriptRoot
$Script    = Join-Path $ScriptDir "run-weekly.ps1"

# Remove existing task if present
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

$Action  = New-ScheduledTaskAction `
    -Execute   "powershell.exe" `
    -Argument  "-NonInteractive -ExecutionPolicy Bypass -File `"$Script`"" `
    -WorkingDirectory $ScriptDir

# Every Monday at 07:00
$Trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday -At "07:00AM"

$Settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Hours 3) `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action   $Action `
    -Trigger  $Trigger `
    -Settings $Settings `
    -RunLevel Highest `
    -Description "SG Datalytics weekly scrape: Melcom + Hotels (Booking.com/Hotels.com) + Airbnb"

Write-Host "`n✅ Weekly task registered: '$TaskName' — runs every Monday at 07:00 AM" -ForegroundColor Green
Write-Host "   Script: $Script"
