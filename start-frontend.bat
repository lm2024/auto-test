@echo off
chcp 65001 >nul 2>&1
title Auto Test - Frontend

echo ================================
echo   Starting Frontend Service
echo   Port: 3001
echo ================================

cd /d "%~dp0frontend"
call npm run dev
pause
