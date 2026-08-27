$ErrorActionPreference = "Stop"
$filePath = Join-Path $PSScriptRoot "backend\routes\exam_routes.py"
if (-not (Test-Path -LiteralPath $filePath)) { throw "File not found: $filePath" }
$backupPath = "$filePath.before-waiting-preservation.backup"
Copy-Item -LiteralPath $filePath -Destination $backupPath -Force
$content = Get-Content -LiteralPath $filePath -Raw
$old = @'
                "status": "ASSIGNED", "assessmentstatus": "ASSIGNED", "assessment_status": "ASSIGNED",
                "hasenteredexam": False, "has_entered_exam": False,
                "requiresreentryapproval": False, "requires_reentry_approval": False,
                "reentryapprovalconsumed": False, "reentry_approval_consumed": False,
                "activesessionid": None, "active_session_id": None,
                "waitingsessionid": None, "waiting_session_id": None,
                "waitingregisteredat": None, "waiting_registered_at": None,
                "lastheartbeatat": None, "last_heartbeat_at": None,
                "enteredexamsession": None, "entered_exam_session": None,
                "updatedat": now, "updated_at": now,
'@
$new = @'
                # Preserve READY status and the valid waiting-session token. A candidate
                # already in WaitScreen must use that token when the examiner starts.
                "requiresreentryapproval": False, "requires_reentry_approval": False,
                "reentryapprovalconsumed": False, "reentry_approval_consumed": False,
                "activesessionid": None, "active_session_id": None,
                "lastheartbeatat": None, "last_heartbeat_at": None,
                "enteredexamsession": None, "entered_exam_session": None,
                "updatedat": now, "updated_at": now,
'@
if (-not $content.Contains($old)) {
  throw "Expected Phase 2 reset block was not found. No file was changed."
}
$updated = $content.Replace($old, $new)
Set-Content -LiteralPath $filePath -Value $updated -Encoding UTF8
Write-Host "Multi-session waiting-session preservation applied successfully."
Write-Host "Backup: $backupPath"
