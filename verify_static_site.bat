@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul

echo [1/6] 正在关闭旧的本地静态服务器...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$servers = @(Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'python.exe' -and $_.CommandLine -match '(?i)-m\s+http\.server\s+15042(?:\s|$)' }); foreach ($server in $servers) { Write-Host ('  关闭旧服务器 PID ' + $server.ProcessId); Stop-Process -Id $server.ProcessId -Force -ErrorAction SilentlyContinue }; for ($attempt = 0; $attempt -lt 30; $attempt++) { if (-not (Get-NetTCPConnection -LocalPort 15042 -State Listen -ErrorAction SilentlyContinue)) { exit 0 }; Start-Sleep -Milliseconds 100 }; Write-Error '端口 15042 仍被其他程序占用，请手动关闭后重试。'; exit 1"
if errorlevel 1 goto :failed

echo.
echo [2/6] 正在提取 Noita 静态资源...
python prepare_static_assets.py
if errorlevel 1 goto :failed

echo [3/6] 正在安装前端依赖...
pushd frontend
if errorlevel 1 goto :failed
call npm install
if errorlevel 1 goto :failed

echo [4/6] 正在构建生产环境版本 (静态模式)...
set "VITE_STATIC_MODE=true"
call npm run build
if errorlevel 1 goto :failed

echo [5/6] 正在同步到 ghpages 目录...
rem 使用 robocopy 同步，并排除白名单文件/目录
rem /MIR 镜像目录树（等同于 /E 加上 /PURGE）
rem /XF 排除文件
rem /XD 排除目录
robocopy dist ..\ghpages /MIR /XF auto_push.bat README.md LICENSE .gitignore CNAME /XD .git
if errorlevel 8 goto :failed

echo.
echo [6/6] 启动本地静态服务器进行验证...
echo.
echo ======================================================
echo [验证说明]
if not defined TWWE_STATIC_HOST set "TWWE_STATIC_HOST=127.0.0.1"
echo 1. 请在浏览器中打开: http://%TWWE_STATIC_HOST%:15042
echo 2. 此时程序将模拟 GitHub Pages 环境，完全使用 WASM 引擎。
echo 3. 如果本地运行正常，那么上传到 GitHub 也会完全正常。
echo 4. 默认只允许本机访问；如需手机访问电脑 IP，请先执行: set TWWE_STATIC_HOST=0.0.0.0
echo 5. 按 Ctrl+C 并输入 Y 来停止测试。
echo ======================================================
echo.

popd
pushd ghpages
if errorlevel 1 goto :failed
python -m http.server 15042 --bind "%TWWE_STATIC_HOST%"
popd
exit /b %errorlevel%

:failed
echo.
echo [错误] 静态站点验证脚本执行失败。
exit /b 1
