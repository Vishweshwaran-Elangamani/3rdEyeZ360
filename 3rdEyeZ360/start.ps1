# start.ps1

Write-Host "Starting 3rdEyeZ360..." -ForegroundColor Cyan

# Move to project root
cd "D:\3rdEyeZ360V2\3rdEyeZ360"

# Start Docker Containers
Write-Host "Starting Docker services..." -ForegroundColor Yellow
docker compose up -d

Start-Sleep -Seconds 10

# Start Electron
Write-Host "Starting Electron App..." -ForegroundColor Yellow

Start-Process powershell -ArgumentList `
"-NoExit", `
"-Command", `
"cd 'D:\3rdEyeZ360V2\3rdEyeZ360\electron-app'; `$env:ENABLE_EYE_DETECTION='true'; `$env:DETECTION_URL='http://127.0.0.1:5001'; npm run dev"

Write-Host "All services started!" -ForegroundColor Green
