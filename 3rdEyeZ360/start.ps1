# start.ps1
Write-Host "🚀 Starting 3rdEyeZ360..." -ForegroundColor Cyan

# 1. Docker
Write-Host "Starting Docker services..." -ForegroundColor Yellow
docker-compose up -d
Start-Sleep -Seconds 10

# 2. Backend (new window)
Write-Host "Starting Backend API..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd D:\3rdEyez360V2\3rdEyeZ360\backend; .\venv\Scripts\python.exe -m uvicorn server:socket_app --host 0.0.0.0 --port 3000"
Start-Sleep -Seconds 5

# 3. Electron (new window) — auto-spawns Python API
Write-Host "Starting Electron App..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd D:\3rdEyez360V2\3rdEyeZ360\electron-app; npm run dev"

Write-Host "✅ All services started!" -ForegroundColor Green