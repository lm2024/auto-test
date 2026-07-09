@echo off
REM AutoTest 后端「内网」离线构建脚本（无需联网）
REM 仅使用工程内私有仓库 backend/local-repo
REM 前提: 内网已安装 JDK 8 与 Maven 3.6+
REM 用法: 在 backend/ 目录下执行 build-offline.bat

setlocal
set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%"

if not exist "%SCRIPT_DIR%local-repo" (
    echo 未找到 %SCRIPT_DIR%local-repo
    echo 本机导出时漏了私有仓库，请确认已把 backend/local-repo 一并拷贝到内网。
    exit /b 1
)

echo.
echo ============================================
echo   使用工程内私有仓库 backend/local-repo
echo   离线重新打包 (mvn -o) ...
echo ============================================
echo.

call mvn -o -Dmaven.repo.local="%SCRIPT_DIR%local-repo" clean package -DskipTests

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo >>> 构建失败，请检查错误信息
    exit /b %ERRORLEVEL%
)

echo.
echo ============================================
echo   构建完成:
echo   jar: %SCRIPT_DIR%target\auto-test-backend-1.0.0.jar
echo ============================================

endlocal
