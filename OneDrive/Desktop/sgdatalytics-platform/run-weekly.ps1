# ============================================================
#  SG Datalytics - Weekly Collection (Mondays)
#  Runs: Melcom + Hotels (Booking.com / Hotels.com) + Airbnb
#  Data goes directly to Neon (no QA staging for these sources).
#  Log:  logs\weekly-YYYY-MM-DD.log
#  Scheduled by register-weekly-task.ps1 (Windows Task Scheduler)
# ============================================================

$ErrorActionPreference = "Continue"
$Root      = $PSScriptRoot
$ServerDir = Join-Path $Root "server"
$LogDir    = Join-Path $Root "logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$LogFile   = Join-Path $LogDir ("weekly-{0}.log" -f (Get-Date -Format "yyyy-MM-dd"))

function Write-Log($msg) {
    $line = "[{0}] {1}" -f (Get-Date -Format "HH:mm:ss"), $msg
    $line | Out-File -FilePath $LogFile -Append -Encoding utf8
    Write-Host $line
}

Write-Log "===== SG Datalytics weekly run started (Melcom + Hotels + Airbnb) ====="

# Hotels and Airbnb write directly to Neon (SG_SKIP_NEON only blocks market_prices table).
# Melcom data goes through market_prices so we stage it for QA like normal market data.
$env:SG_SKIP_NEON = "1"

Write-Log "STEP 1: market-pipeline.js --weekly-only (Melcom + Hotels + Airbnb)"
Set-Location $ServerDir
& node --max-old-space-size=4096 collectors/market-pipeline.js --weekly-only 2>&1 |
    ForEach-Object { "$_" } | Out-File -FilePath $LogFile -Append -Encoding utf8
$pipelineExit = $LASTEXITCODE
Write-Log "Pipeline exit code: $pipelineExit"

# Run QA on today's Melcom data so it goes through the normal review flow
Write-Log "STEP 2: qa\qa_daily.py (review file for Melcom data)"
Set-Location $Root
$env:PYTHONIOENCODING = "utf-8"
$qaDate = Get-Date -Format "yyyy-MM-dd"
& python qa\qa_daily.py --date $qaDate 2>&1 |
    ForEach-Object { "$_" } | Out-File -FilePath $LogFile -Append -Encoding utf8
$qaExit = $LASTEXITCODE
Write-Log "QA exit code: $qaExit"

# Housekeeping: keep 60 days of weekly logs
Get-ChildItem $LogDir -Filter "weekly-*.log" |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-60) } |
    Remove-Item -Force -ErrorAction SilentlyContinue

Write-Log "===== Weekly run finished ====="
exit ([int]($pipelineExit -ne 0 -or $qaExit -ne 0))
