# start.ps1

Write-Host "Starting 3rdEyeZ360 Electron App..." -ForegroundColor Cyan

$projectRoot = "D:\3rdEyeZ360V2\3rdEyeZ360"
$electronPath = Join-Path $projectRoot "electron-app"
$packageJsonPath = Join-Path $electronPath "package.json"

# Validate the Electron folder.
if (-not (Test-Path -LiteralPath $electronPath)) {
    Write-Host "Electron app folder was not found:" -ForegroundColor Red
    Write-Host $electronPath -ForegroundColor Red
    exit 1
}

# Validate package.json.
if (-not (Test-Path -LiteralPath $packageJsonPath)) {
    Write-Host "Electron package.json was not found:" -ForegroundColor Red
    Write-Host $packageJsonPath -ForegroundColor Red
    exit 1
}

Write-Host "Electron folder found." -ForegroundColor Green
Write-Host "Starting Electron in a new PowerShell window..." -ForegroundColor Yellow

$electronCommand = @"
`$Host.UI.RawUI.WindowTitle = '3rdEyeZ360 Electron'

`$env:ENABLE_EYE_DETECTION = 'true'
`$env:ENABLE_HEAD_EYE_FUSION = 'true'
`$env:DETECTION_URL = 'http://127.0.0.1:5001'

Set-Location -LiteralPath '$electronPath'

Write-Host ''
Write-Host '3rdEyeZ360 Electron Configuration' -ForegroundColor Cyan
Write-Host '---------------------------------' -ForegroundColor DarkGray
Write-Host 'Eye Detection   : ENABLED' -ForegroundColor Green
Write-Host 'Head-Eye Fusion : ENABLED' -ForegroundColor Green
Write-Host 'Detection URL   : http://127.0.0.1:5001' -ForegroundColor Green
Write-Host 'Electron Path   : $electronPath' -ForegroundColor Green
Write-Host ''

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host 'npm was not found in PATH.' -ForegroundColor Red
    Write-Host 'Install Node.js or restart PowerShell after installing Node.js.' -ForegroundColor Yellow
    Write-Host ''
    Read-Host 'Press Enter to close'
    exit 1
}

if (-not (Test-Path -LiteralPath 'node_modules')) {
    Write-Host 'node_modules was not found.' -ForegroundColor Yellow
    Write-Host 'Installing Electron dependencies...' -ForegroundColor Yellow

    npm install

    if (`$LASTEXITCODE -ne 0) {
        Write-Host ''
        Write-Host 'npm install failed.' -ForegroundColor Red
        Read-Host 'Press Enter to close'
        exit `$LASTEXITCODE
    }
}

Write-Host 'Starting Electron...' -ForegroundColor Yellow
Write-Host ''

npm run dev

`$electronExitCode = `$LASTEXITCODE

if (`$electronExitCode -ne 0) {
    Write-Host ''
    Write-Host 'Electron failed to start.' -ForegroundColor Red
    Write-Host "Exit code: `$electronExitCode" -ForegroundColor Red
    Write-Host ''
    Read-Host 'Press Enter to close'
    exit `$electronExitCode
}

Write-Host ''
Write-Host 'Electron process ended.' -ForegroundColor Yellow
Read-Host 'Press Enter to close'
"@

try {
    $electronProcess = Start-Process `
        -FilePath "powershell.exe" `
        -ArgumentList @(
            "-NoExit",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            $electronCommand
        ) `
        -PassThru

    Write-Host ""
    Write-Host "Electron startup terminal opened successfully." -ForegroundColor Green
    Write-Host "Process ID      : $($electronProcess.Id)" -ForegroundColor Cyan
    Write-Host "Eye detection  : Enabled" -ForegroundColor Cyan
    Write-Host "Head-eye fusion: Enabled" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Docker and Python are not started by this script." -ForegroundColor DarkGray
} catch {
    Write-Host ""
    Write-Host "Failed to open the Electron startup terminal." -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}