@echo off
echo ================================
echo   Restarting All Services
echo ================================

echo [1/3] Stopping existing services...
call "%~dp0stop.bat"

echo.
echo [2/3] Waiting for ports to release...
timeout /t 3 /nobreak >nul

echo.
echo [3/3] Starting services...
call "%~dp0start.bat"