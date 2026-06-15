@echo off
title 舞力打卡服务

:: 切换到批处理文件所在目录
cd /d "%~dp0"

:: 进入 server 目录
cd server

echo ==========================================
echo   舞力打卡 - 服务启动器
echo ==========================================
echo.
echo [1/2] 检查Node.js...
if not exist "C:\Users\122750\.workbuddy\binaries\node\versions\22.12.0\node.exe" (
    echo [ERROR] Node.js 未找到！
    echo 路径: C:\Users\122750\.workbuddy\binaries\node\versions\22.12.0\node.exe
    pause
    exit /b 1
)
echo [OK] Node.js 已就绪

echo [2/2] 启动服务 (Watchdog守护)...
echo.
echo 服务地址: http://localhost:3099
echo 关闭此窗口将停止服务
echo ==========================================
echo.

"C:\Users\122750\.workbuddy\binaries\node\versions\22.12.0\node.exe" watchdog.js

pause
