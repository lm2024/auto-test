@echo off
chcp 65001 >nul
echo ========== 关闭前后端服务 ==========

echo [1/2] 关闭后端 (端口8080)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8080" ^| findstr "LISTENING"') do taskkill /F /PID %%a 2>nul

echo [2/2] 关闭前端 (端口3001)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3001" ^| findstr "LISTENING"') do taskkill /F /PID %%a 2>nul

echo.
echo 服务已关闭
echo ========================================
pause
