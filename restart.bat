@echo off
chcp 65001 >nul
echo ========== 重启前后端服务 ==========

echo [1/3] 关闭现有服务...
call "%~dp0stop.bat"

echo [2/3] 等待端口释放...
timeout /t 2 /nobreak >nul

echo [3/3] 启动服务...
call "%~dp0start.bat"
