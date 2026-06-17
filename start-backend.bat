@echo off
chcp 65001 >nul 2>&1
title Auto Test - Backend

echo ================================
echo   Starting Backend Service
echo   Port: 8080
echo ================================

cd /d "%~dp0backend"
call mvn spring-boot:run
pause
