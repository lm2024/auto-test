@echo off
echo ================================
echo   Starting All Services
echo ================================

echo [1/2] Starting Backend...
start "Backend-8080" cmd /k "cd /d "%~dp0backend" && call mvn spring-boot:run"

echo [2/2] Starting Frontend...
start "Frontend-3001" cmd /k "cd /d "%~dp0frontend" && call npm run dev"

echo.
echo Waiting for services...
timeout /t 8 /nobreak >nul

echo ================================
echo   Services Started!
echo   Frontend: http://localhost:3001
echo   Backend:  http://localhost:8080
echo ================================
pause