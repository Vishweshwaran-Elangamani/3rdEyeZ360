param(
    [string]$IndexPath = "D:\3rdEyeZ360V2\3rdEyeZ360\electron-app\main\ipc\index.js"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $IndexPath)) {
    throw "index.js was not found: $IndexPath"
}

$backupPath = "$IndexPath.before-typing-fix.bak"
$tempPath = Join-Path (Split-Path -Parent $IndexPath) "index.fixed.cjs"

Copy-Item -LiteralPath $IndexPath -Destination $backupPath -Force
$content = Get-Content -LiteralPath $IndexPath -Raw

# Change only the typing grace period. Preserve every other constant.
$content = $content -replace [regex]::Escape(
    'const TYPING_GRACE_MS = 4000;'
), 'const TYPING_GRACE_MS = 7000;'

# Replace the complete original typing helper section with one clean copy.
$typingFunctionsPattern = '(?s)function shouldIgnoreDetection\(result\) \{.*?\r?\n\}\s*function getMostRecentTypingAt\(\) \{.*?\r?\n\}\s*function wasTypingRecently\(\) \{.*?\r?\n\}\s*function isTypingSensitiveDetection\(result\) \{.*?\r?\n\}\s*function shouldSkipForRecentTyping\(result\) \{.*?\r?\n\}'

$typingFunctionsReplacement = @'
function shouldIgnoreDetection(result) {
  const detail = String(result?.detail || "").trim().toLowerCase();

  return (
    detail === "ok" ||
    detail === "face_ok" ||
    detail === "charger_connected" ||
    detail === "eye_landmarks_unclear"
  );
}

function getMostRecentTypingAt() {
  let browserTypingAt = 0;
  let fallbackTypingAt = 0;

  try {
    if (typeof getLastBrowserInputAt === "function") {
      browserTypingAt = Number(getLastBrowserInputAt() || 0);
    }
  } catch (error) {
    console.log("[TYPING] getLastBrowserInputAt failed:", error.message);
  }

  try {
    if (typeof getLastInputAt === "function") {
      fallbackTypingAt = Number(getLastInputAt() || 0);
    }
  } catch (error) {
    console.log("[TYPING] getLastInputAt failed:", error.message);
  }

  return Math.max(browserTypingAt, fallbackTypingAt, 0);
}

function wasTypingRecently() {
  const lastTypedAt = getMostRecentTypingAt();
  if (!lastTypedAt) return false;

  const elapsedMs = Date.now() - lastTypedAt;
  return elapsedMs >= 0 && elapsedMs <= TYPING_GRACE_MS;
}

function isTypingSensitiveDetection(result) {
  const detail = String(result?.detail || "").trim().toLowerCase();
  const issue = String(result?.issue || "").trim().toLowerCase();

  const detectorTypingSensitive =
    result?.typing_sensitive === true ||
    String(result?.typing_sensitive || "").trim().toLowerCase() === "true";

  const typingSensitiveDetails = new Set([
    "looking_down",
    "head_looking_down",
    "eye_gaze_down",
    "eyes_closed",
  ]);

  const typingSensitiveIssues = new Set([
    "head_looking_down",
    "eye_gaze_down",
    "eyes_closed",
  ]);

  return (
    detectorTypingSensitive ||
    typingSensitiveDetails.has(detail) ||
    typingSensitiveIssues.has(issue)
  );
}

function shouldSkipForRecentTyping(result) {
  if (!isTypingSensitiveDetection(result)) return false;

  const lastInputAt = getMostRecentTypingAt();

  if (!lastInputAt) {
    console.log(
      "[TYPING] Typing-sensitive result received, but no keyboard timestamp is available.",
      {
        detail: result?.detail,
        issue: result?.issue,
        typing_sensitive: result?.typing_sensitive,
      },
    );
    return false;
  }

  const elapsedMs = Date.now() - lastInputAt;
  const recentlyTyped = elapsedMs >= 0 && elapsedMs <= TYPING_GRACE_MS;

  if (recentlyTyped) {
    console.log("[IPC] Typing-sensitive detection ignored due to recent typing", {
      detail: result?.detail,
      issue: result?.issue,
      typing_sensitive: result?.typing_sensitive,
      lastInputAt,
      elapsedMs,
      typingGraceMs: TYPING_GRACE_MS,
    });
  }

  return recentlyTyped;
}
'@

$typingMatches = [regex]::Matches($content, $typingFunctionsPattern)
if ($typingMatches.Count -ne 1) {
    throw "Expected exactly one typing helper section, but found $($typingMatches.Count). Original file was not changed."
}

$content = [regex]::Replace(
    $content,
    $typingFunctionsPattern,
    $typingFunctionsReplacement,
    1
)

# Replace only the original webcam typing-suppression block.
$oldSkipPattern = '(?s)        if \(shouldSkipForRecentTyping\(result\)\) \{\s*safeSend\(mainWindow, "detection-result", \{\s*source: "electron-ipc",\s*persisted: false,\s*reason: "Typing-sensitive detection ignored because typing was recent\.",\s*assessmentId: payload\.assessmentId,\s*candidateId: payload\.candidateId,\s*examId: payload\.examId,\s*timestamp: payload\.timestamp,\s*result,\s*\}\);\s*continue;\s*\}'

$newSkipBlock = @'
        if (shouldSkipForRecentTyping(result)) {
          // Close a previously displayed eye/down warning immediately.
          closeMonitoringToastWindow();

          // Convert the suppressed result to OK locally. It is not persisted.
          const suppressedResult = {
            ...result,
            detected: false,
            detail: "ok",
            issue: null,
            candidate_action: null,
            suppressed_for_recent_typing: true,
          };

          console.log("[IPC] Typing-related eye/head result suppressed", {
            type: result?.type,
            detail: result?.detail,
            issue: result?.issue,
            typing_sensitive: result?.typing_sensitive,
            lastInputAt: getMostRecentTypingAt(),
          });

          safeSend(mainWindow, "detection-result", {
            source: "electron-ipc",
            persisted: false,
            reason:
              "Typing-sensitive detection ignored because keyboard input was recent.",
            assessmentId: payload.assessmentId,
            candidateId: payload.candidateId,
            examId: payload.examId,
            timestamp: payload.timestamp,
            result: suppressedResult,
          });

          continue;
        }
'@

$skipMatches = [regex]::Matches($content, $oldSkipPattern)
if ($skipMatches.Count -ne 1) {
    throw "Expected exactly one webcam typing-suppression block, but found $($skipMatches.Count). Original file was not changed."
}

$content = [regex]::Replace(
    $content,
    $oldSkipPattern,
    $newSkipBlock,
    1
)

# Safety checks before writing.
if ($content -notmatch 'if \(!payload\.token\)') {
    throw "The backend token guard is missing. Original file was not changed."
}

if ($content -notmatch '"eyes_closed"') {
    throw "eyes_closed was not added to typing-sensitive detection. Original file was not changed."
}

# Write to .cjs because Node.js 26 does not accept --check on a .tmp file.
Set-Content -LiteralPath $tempPath -Value $content -Encoding UTF8

$node = Get-Command node -ErrorAction SilentlyContinue
if ($null -eq $node) {
    Remove-Item -LiteralPath $tempPath -Force -ErrorAction SilentlyContinue
    throw "Node.js was not found. Original file was not changed."
}

& node --check $tempPath
if ($LASTEXITCODE -ne 0) {
    Remove-Item -LiteralPath $tempPath -Force -ErrorAction SilentlyContinue
    throw "JavaScript syntax validation failed. Original file was not changed."
}

# Replace the complete file only after syntax validation succeeds.
Move-Item -LiteralPath $tempPath -Destination $IndexPath -Force

$lineCount = (Get-Content -LiteralPath $IndexPath).Count
$helperCount = ([regex]::Matches(
    (Get-Content -LiteralPath $IndexPath -Raw),
    'function getMostRecentTypingAt\(\)'
)).Count

if ($helperCount -ne 1) {
    Copy-Item -LiteralPath $backupPath -Destination $IndexPath -Force
    throw "Post-write validation found $helperCount typing helper copies. Backup was restored."
}

Write-Host "Fixed complete file: $IndexPath" -ForegroundColor Green
Write-Host "Backup: $backupPath" -ForegroundColor Cyan
Write-Host "Line count: $lineCount" -ForegroundColor Cyan
Write-Host "Typing helper copies: $helperCount" -ForegroundColor Cyan
Write-Host "JavaScript syntax: valid" -ForegroundColor Green
