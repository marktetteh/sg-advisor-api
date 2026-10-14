# ============================================================
#  SG Datalytics - Market Collection, weekdays Mon-Fri (unattended)
#  Runs: market pipeline (Jiji + Tonaton + Esoko + Meqasa only;
#        Melcom + Hotels + Airbnb run weekly via run-weekly.ps1) -> quality orchestrator (--auto)
#  Log:  logs\daily-YYYY-MM-DD.log
#  Scheduled by register-daily-task.ps1 (Windows Task Scheduler)
# ============================================================

$ErrorActionPreference = "Continue"
$Root      = $PSScriptRoot
$ServerDir = Join-Path $Root "server"
$LogDir    = Join-Path $Root "logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$LogFile   = Join-Path $LogDir ("daily-{0}.log" -f (Get-Date -Format "yyyy-MM-dd"))

function Write-Log($msg) {
    $line = "[{0}] {1}" -f (Get-Date -Format "HH:mm:ss"), $msg
    $line | Out-File -FilePath $LogFile -Append -Encoding utf8
}

Write-Log "===== SG Datalytics daily run started ====="

# --- Step 1: Collection ---------------------------------------
$env:SG_SKIP_NEON = "1"   # staging mode: collectors do NOT insert market data into Neon (QA review + manual upload do)
Write-Log "STEP 1: market-pipeline.js (Jiji + Tonaton + Esoko + Meqasa only)"
Set-Location $ServerDir
& node --max-old-space-size=4096 collectors/market-pipeline.js --skip-melcom --skip-hotels --skip-airbnb 2>&1 |
    ForEach-Object { "$_" } | Out-File -FilePath $LogFile -Append -Encoding utf8
$pipelineExit = $LASTEXITCODE
Write-Log "Pipeline exit code: $pipelineExit"

# --- Step 1b: QA (standard names, price flags, review file) ---
Write-Log "STEP 1b: qa\qa_daily.py (review file for Mark; nothing is uploaded)"
Set-Location $Root
$env:PYTHONIOENCODING = "utf-8"
$qaDate = Get-Date -Format "yyyy-MM-dd"
& python qa\qa_daily.py --date $qaDate 2>&1 |
    ForEach-Object { "$_" } | Out-File -FilePath $LogFile -Append -Encoding utf8
$qaExit = $LASTEXITCODE
Write-Log "QA exit code: $qaExit"

# --- Step 2: Quality orchestrator ----------------------------
Write-Log "STEP 2: orchestrator.py --auto"
Set-Location $Root
$env:PYTHONIOENCODING = "utf-8"
& python orchestrator.py --auto 2>&1 |
    ForEach-Object { "$_" } | Out-File -FilePath $LogFile -Append -Encoding utf8
$orchExit = $LASTEXITCODE
Write-Log "Orchestrator exit code: $orchExit"

# --- Housekeeping: keep 60 days of logs ----------------------
Get-ChildItem $LogDir -Filter "daily-*.log" |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-60) } |
    Remove-Item -Force -ErrorAction SilentlyContinue

Write-Log "===== Daily run finished ====="
exit ([int]($pipelineExit -ne 0 -or $orchExit -ne 0 -or $qaExit -ne 0))
