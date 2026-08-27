$ErrorActionPreference = "Stop"

$projectRoot = $PSScriptRoot
$dashboardPath = Join-Path $projectRoot "electron-app\renderer\pages\examiner\ExaminerDashboard.jsx"

if (-not (Test-Path -LiteralPath $dashboardPath)) {
    throw "ExaminerDashboard.jsx was not found at: $dashboardPath"
}

$backupPath = "$dashboardPath.before-multisession-card-display-fix.backup"
Copy-Item -LiteralPath $dashboardPath -Destination $backupPath -Force

$content = Get-Content -LiteralPath $dashboardPath -Raw

# Remove the session counter from the Multi-Session card heading only.
$content = [regex]::Replace(
    $content,
    'Multi-Session Exam\s*[·\-]\s*Session\s*\{exam\.sessionnumber\s*\|\|\s*0\}',
    'Multi-Session Exam',
    [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
)

# There may be an already-literal old heading in a manually edited copy.
$content = [regex]::Replace(
    $content,
    'Multi-Session Exam\s*[·\-]\s*Session\s*\d+',
    'Multi-Session Exam',
    [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
)

# Ensure only Single-Session cards render the separate headline schedule.
$oldScheduleStart = @'
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
'@
$newScheduleStart = @'
          {exam.examtype !== "MULTI_SESSION" ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
'@

if ($content.Contains($oldScheduleStart)) {
    $content = $content.Replace($oldScheduleStart, $newScheduleStart)

    $scheduleEndNeedle = @'
          </div>
        </div>
        <StatusPill status={exam.status} theme={theme} />
'@
    $scheduleEndReplacement = @'
            </div>
          ) : null}
        </div>
        <StatusPill status={exam.status} theme={theme} />
'@
    if (-not $content.Contains($scheduleEndNeedle)) {
        throw "The expected schedule block end was not found. The backup was preserved and no uncertain edit was applied."
    }
    $content = $content.Replace($scheduleEndNeedle, $scheduleEndReplacement)
}

Set-Content -LiteralPath $dashboardPath -Value $content -Encoding UTF8

# Stop old renderer processes so the corrected source is actually loaded.
Get-Process electron,node -ErrorAction SilentlyContinue | Stop-Process -Force

# Remove only generated caches and bundles. Source and node_modules remain intact.
$cachePaths = @(
    (Join-Path $projectRoot "electron-app\dist-renderer"),
    (Join-Path $projectRoot "electron-app\dist"),
    (Join-Path $projectRoot "electron-app\build"),
    (Join-Path $projectRoot "electron-app\.vite"),
    (Join-Path $projectRoot "electron-app\node_modules\.vite"),
    (Join-Path $projectRoot "electron-app\node_modules\.cache")
)
foreach ($cachePath in $cachePaths) {
    Remove-Item -LiteralPath $cachePath -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "[OK] Multi-Session card display updated."
Write-Host "[OK] Single-Session date/time display remains unchanged."
Write-Host "[OK] Old Electron/Node processes and renderer caches were cleared."
Write-Host "Backup: $backupPath"
Write-Host "Start the Electron app again from: $(Join-Path $projectRoot 'electron-app')"
