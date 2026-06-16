@echo off
chcp 65001 >nul
echo ========== 启动前后端服务 ==========

echo [1/2] 启动后端 (Spring Boot, 端口8080)...
start "backend" cmd /k "cd /d %~dp0backend && mvn spring-boot:run"

echo [2/2] 启动前端 (Vite, 端口3001)...
start "frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo 等待服务启动...
timeout /t 5 /nobreak >nul
echo.
echo 前端: http://localhost:3001
echo 后端: http://localhost:8080
echo ========================================
pause
