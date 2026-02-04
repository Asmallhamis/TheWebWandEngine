@echo off
setlocal enabledelayedexpansion

echo [1/3] 提取静态资源...
python prepare_static_assets.py

echo [2/3] 安装前端依赖...
cd frontend
call npm install

echo [3/3] 构建静态网页...

set VITE_STATIC_MODE=true
call npm run build

echo [4/3] 正在同步到 ghpages 目录...
:: 使用 robocopy 同步，并排除白名单文件/目录
robocopy dist ..\ghpages /MIR /XF auto_push.bat README.md LICENSE .gitignore CNAME /XD .git

echo.
echo 构建完成! 
echo 静态网页已同步到 ghpages 目录。
echo 您可以进入 ghpages 目录并运行 auto_push.bat 来部署。
pause
