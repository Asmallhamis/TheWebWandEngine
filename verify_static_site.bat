@echo off
setlocal enabledelayedexpansion
echo [1/4] 正在提取 Noita 静态资源...
python prepare_static_assets.py

echo [2/4] 正在安装前端依赖...
cd frontend
call npm install

echo [3/4] 正在构建生产环境版本 (静态模式)...

set VITE_STATIC_MODE=true
call npm run build

echo [4/4] 正在同步到 ghpages 目录...
:: 使用 robocopy 同步，并排除白名单文件/目录
:: /MIR 镜像目录树（等同于 /E 加上 /PURGE）
:: /XF 排除文件
:: /XD 排除目录
robocopy dist ..\ghpages /MIR /XF auto_push.bat README.md LICENSE .gitignore CNAME /XD .git

echo.
echo [5/5] 启动本地静态服务器进行验证...
echo.
echo ======================================================
echo [验证说明]
echo 1. 请在浏览器中打开: http://localhost:15042
echo 2. 此时程序将模拟 GitHub Pages 环境，完全使用 WASM 引擎。
echo 3. 如果本地运行正常，那么上传到 GitHub 也会完全正常。
echo 4. 按 Ctrl+C 并输入 Y 来停止测试。
echo ======================================================
echo.

cd ..\ghpages
python -m http.server 15042
