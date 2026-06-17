@echo off
echo ================================
echo   Stopping All Services
echo ================================

echo [1/2] Stopping Backend (port 8080)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8080" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a 2>nul
)

echo [2/2] Stopping Frontend (port 3001)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3001" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a 2>nul
)

echo.
echo ================================
echo   All Services Stopped
echo ================================
pause