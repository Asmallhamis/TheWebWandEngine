@echo off
setlocal enabledelayedexpansion
title TWWE - 一键闪电调试模式

echo ========================================
echo       TWWE 智能开发环境重启中...
echo ========================================

:: 0. 生成开发版本号 (YYYY-MM-DD.n)
echo [0/5] 生成开发版本号...
python scripts\generate_dev_version.py
if errorlevel 1 (
    echo [WARN] 版本号生成失败，将继续启动开发环境。
)

:: 1. 杀死旧的后端进程 (17471)
echo [1/5] 清理后端端口 17471...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :17471 ^| findstr LISTENING') do (
    taskkill /f /pid %%a >nul 2>&1
)

:: 2. 杀死旧的前端进程 (3000)
echo [2/5] 清理前端端口 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do (
    taskkill /f /pid %%a >nul 2>&1
)

:: 3. 启动后端 (新窗口，方便看报错)
echo [3/5] 启动 Python 后端...
start "TWWE-Backend" cmd /k "python backend/server.py"

:: 4. 启动前端开发服务器
echo [4/5] 启动 Vite 前端...
cd frontend
:: 使用 call 确保脚本在 npm run dev 结束后能继续
npm run dev -- --host

echo [5/5] 开发环境已退出。

pause
