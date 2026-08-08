param(
    [string]$ActiveExamPath = ".\electron-app\renderer\pages\candidate\ActiveExam.jsx"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $ActiveExamPath)) {
    throw "ActiveExam.jsx was not found at: $ActiveExamPath"
}

$fullPath = (Resolve-Path $ActiveExamPath).Path
$backupPath = "$fullPath.before-camera-shutdown-fix"
$content = Get-Content $fullPath -Raw

$fixedBlock = @'
      const entryAllowed = await obtainEntryPermission();

      /*
       * A cancelled React effect only means this particular effect instance
       * became stale. It does not mean that the assessment is ending.
       * Never shut down the shared camera/WebRTC connection for cancellation.
       */
      if (cancelled || completedRef.current) {
        return;
      }

      if (!entryAllowed) {
        await cleanupExamShell();
        return;
      }
'@

if ($content.Contains($fixedBlock)) {
    Write-Host "ActiveExam.jsx already contains the camera shutdown fix." -ForegroundColor Yellow
    exit 0
}

$pattern = '(?s)      const entryAllowed = await obtainEntryPermission\(\);\s*if \(!entryAllowed \|\| cancelled \|\| completedRef\.current\) \{\s*await cleanupExamShell\(\);\s*return;\s*\}'
$matches = [regex]::Matches($content, $pattern).Count

if ($matches -ne 1) {
    throw "Expected exactly one unsafe browser-entry cleanup block, but found $matches. No changes were made."
}

$updated = [regex]::Replace($content, $pattern, $fixedBlock, 1)

Copy-Item $fullPath $backupPath -Force
Set-Content -Path $fullPath -Value $updated -Encoding UTF8

Write-Host "ActiveExam.jsx corrected successfully." -ForegroundColor Green
Write-Host "Backup created at: $backupPath" -ForegroundColor DarkYellow
Write-Host "The wait-to-exam transition will no longer stop Candidate WebRTC." -ForegroundColor Green
