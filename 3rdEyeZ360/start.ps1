# start.ps1
<<<<<<< HEAD
=======

>>>>>>> main
Write-Host "Starting 3rdEyeZ360..." -ForegroundColor Cyan

# 1. Docker
Write-Host "Starting Docker services..." -ForegroundColor Yellow
docker-compose up -d
Start-Sleep -Seconds 10

# 2. Backend
Write-Host "Starting Backend API..." -ForegroundColor Yellow
<<<<<<< HEAD
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'D:\3RD EYE\3rdEyeZ360\3rdEyeZ360\backend'; .\venv\Scripts\python.exe -m uvicorn server:socket_app --host 0.0.0.0 --port 3000"
Start-Sleep -Seconds 5

# 3. Electron
Write-Host "Starting Electron App..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'D:\3RD EYE\3rdEyeZ360\3rdEyeZ360\electron-app'; npm run dev"

Write-Host "All services started!" -ForegroundColor Green
=======
Start-Process powershell -ArgumentList `
"-NoExit", `
"-Command", `
"cd D:\3rd_Eyez360_V2\3rdEyeZ360\3rdEyeZ360\backend; .\venv\Scripts\python.exe -m uvicorn server:socket_app --host 0.0.0.0 --port 3000"

Start-Sleep -Seconds 5

# 3. Electron App
Write-Host "Starting Electron App..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList `
"-NoExit", `
"-Command", `
"cd D:\3rd_Eyez360_V2\3rdEyeZ360\3rdEyeZ360\electron-app; npm run dev"

Write-Host "All services started!" -ForegroundColor Green
>>>>>>> main
