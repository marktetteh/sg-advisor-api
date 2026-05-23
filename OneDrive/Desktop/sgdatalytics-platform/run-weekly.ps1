# ============================================================
#  SG Datalytics — Weekly Data Collection Script
#  Run every Monday morning before 10am
#  Usage: Right-click → "Run with PowerShell"
#         OR in PowerShell: .\run-weekly.ps1
# ============================================================

$ServerDir = "$PSScriptRoot\server"
$Results   = @{}
$StartTime = Get-Date

function Run-Collector {
    param($Name, $Script, $TimeoutSec = 600)
    Write-Host ""
    Write-Host "  ── $Name " -NoNewline
    Write-Host ("─" * (45 - $Name.Length)) -ForegroundColor DarkGray
    $t = Measure-Command {
        $job = Start-Job -ScriptBlock {
            param($dir, $script)
            Set-Location $dir
            node $script 2>&1
        } -ArgumentList $ServerDir, $Script

        $done = Wait-Job $job -Timeout $TimeoutSec
        if ($done) {
            $output = Receive-Job $job
            $output | ForEach-Object { Write-Host "  $_" }
            $exitCode = $job.ChildJobs[0].JobStateInfo.Reason
            Remove-Job $job
            return $job.State -eq "Completed"
        } else {
            Stop-Job $job; Remove-Job $job
            Write-Host "  ❌ TIMED OUT after $($TimeoutSec/60) minutes" -ForegroundColor Red
            return $false
        }
    }
    return @{ success = $true; seconds = [int]$t.TotalSeconds }
}

Clear-Host
Write-Host ""
Write-Host "  ╔══════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║   SG DATALYTICS — Weekly Collection              ║" -ForegroundColor Cyan
Write-Host "  ║   $(Get-Date -Format 'dddd dd MMMM yyyy  HH:mm')                   ║" -ForegroundColor Cyan
Write-Host "  ╚══════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

Set-Location $ServerDir

# ── SECTION 1: API Collectors (fast, no browser) ─────────────
Write-Host "  [1/2] API COLLECTORS" -ForegroundColor Yellow
Write-Host "  ─────────────────────────────────────────────────────"

$collectors = @(
    @{ name = "Bank of Ghana (FX + Indicators)"; script = "collectors/bog.js";       timeout = 120 },
    @{ name = "NPA Fuel Prices";                 script = "collectors/npa.js";       timeout = 120 },
    @{ name = "Ghana Statistical Service";        script = "collectors/gss.js";       timeout = 180 },
    @{ name = "World Bank Ghana Data";            script = "collectors/worldbank.js"; timeout = 180 },
    @{ name = "MOFA Agricultural Prices";         script = "collectors/mofa.js";      timeout = 180 }
)

foreach ($c in $collectors) {
    $t = Measure-Command {
        Write-Host ""
        Write-Host "  ── $($c.name) " -NoNewline -ForegroundColor White
        node $c.script
        $ok = $LASTEXITCODE -eq 0
    }
    $status = if ($ok) { "✅" } else { "❌ FAILED" }
    $color  = if ($ok) { "Green" } else { "Red" }
    Write-Host "  $status $($c.name) ($([int]$t.TotalSeconds)s)" -ForegroundColor $color
    $Results[$c.name] = $ok
}

# ── SECTION 2: Market Scrapers (browser-based) ───────────────
Write-Host ""
Write-Host "  [2/2] MARKET SCRAPERS" -ForegroundColor Yellow
Write-Host "  ─────────────────────────────────────────────────────"

$scrapers = @(
    @{ name = "Ghana Stock Exchange (GSE)";   script = "collectors/gse.js";     timeout = 300  },
    @{ name = "Jiji Ghana (market prices)";   script = "collectors/jiji.js";    timeout = 3600 },
    @{ name = "Tonaton Ghana (market prices)";script = "collectors/tonaton.js"; timeout = 3600 },
    @{ name = "Melcom (retail prices)";       script = "collectors/melcom.js";  timeout = 600  },
    @{ name = "Esoko (commodity prices)";     script = "collectors/esoko.js";   timeout = 300  },
    @{ name = "Meqasa (property listings)";   script = "collectors/meqasa.js";  timeout = 600  },
    @{ name = "Hotels — Booking.com";         script = "collectors/hotels.js";  timeout = 600  },
    @{ name = "Airbnb Ghana";                 script = "collectors/airbnb.js";  timeout = 600  }
)

foreach ($s in $scrapers) {
    $t = Measure-Command {
        Write-Host ""
        Write-Host "  ── $($s.name)" -ForegroundColor White
        node $s.script
        $ok = $LASTEXITCODE -eq 0
    }
    $status = if ($ok) { "✅" } else { "❌ FAILED" }
    $color  = if ($ok) { "Green" } else { "Red" }
    Write-Host "  $status $($s.name) ($([int]$t.TotalSeconds)s)" -ForegroundColor $color
    $Results[$s.name] = $ok
}

# ── Consolidation ─────────────────────────────────────────────
Write-Host ""
Write-Host "  ── Weekly Consolidation" -ForegroundColor White
node collectors/consolidate.js
Write-Host ""

# ── Summary ──────────────────────────────────────────────────
$elapsed  = [int](New-TimeSpan -Start $StartTime -End (Get-Date)).TotalMinutes
$failed   = $Results.GetEnumerator() | Where-Object { -not $_.Value }
$passed   = $Results.GetEnumerator() | Where-Object { $_.Value }

Write-Host ""
Write-Host "  ╔══════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║   COLLECTION SUMMARY                             ║" -ForegroundColor Cyan
Write-Host "  ╠══════════════════════════════════════════════════╣" -ForegroundColor Cyan
Write-Host "  ║  Total time : $($elapsed) min$(" " * (36 - "$elapsed min".Length))║" -ForegroundColor Cyan
Write-Host "  ║  Passed     : $($passed.Count)$(" " * 38)║" -ForegroundColor Cyan
Write-Host "  ║  Failed     : $($failed.Count)$(" " * 38)║" -ForegroundColor Cyan
Write-Host "  ╚══════════════════════════════════════════════════╝" -ForegroundColor Cyan

if ($failed.Count -gt 0) {
    Write-Host ""
    Write-Host "  ❌ Failed collectors — re-run these individually:" -ForegroundColor Red
    foreach ($f in $failed) {
        Write-Host "     node $($scrapers + $collectors | Where-Object { $_.name -eq $f.Key } | Select-Object -First 1 -ExpandProperty script)" -ForegroundColor Yellow
    }
    Write-Host ""
    Write-Host "  To re-run a single collector:" -ForegroundColor Gray
    Write-Host "  cd '$ServerDir'" -ForegroundColor Gray
    Write-Host "  node collectors/<name>.js" -ForegroundColor Gray
} else {
    Write-Host ""
    Write-Host "  ✅ All collectors completed successfully!" -ForegroundColor Green
}

Write-Host ""
Read-Host "  Press Enter to close"
