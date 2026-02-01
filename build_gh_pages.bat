@echo off
setlocal enabledelayedexpansion

echo [1/3] 提取静态资源...
python prepare_static_assets.py

echo [2/3] 安装前端依赖...
cd frontend
call npm install

echo [3/3] 构建静态网页...

:: --- 白名单保护逻辑开始 ---
set "DIST_DIR=dist"
set "TEMP_DIR=dist_backup"
set "WHITELIST=.git auto_push.bat README.md LICENSE .gitignore CNAME"

if exist %DIST_DIR% (
    echo 正在备份白名单文件...
    if not exist %TEMP_DIR% mkdir %TEMP_DIR%
    for %%f in (%WHITELIST%) do (
        if exist "%DIST_DIR%\%%f" (
            echo   备份: %%f
            move /y "%DIST_DIR%\%%f" "%TEMP_DIR%\" >nul
        )
    )
)
:: --- 白名单保护逻辑结束 ---

set VITE_STATIC_MODE=true
call npm run build

:: --- 白名单恢复逻辑开始 ---
if exist %TEMP_DIR% (
    echo 正在还原白名单文件...
    for %%f in (%WHITELIST%) do (
        if exist "%TEMP_DIR%\%%f" (
            echo   还原: %%f
            move /y "%TEMP_DIR%\%%f" "%DIST_DIR%\" >nul
        )
    )
    rmdir /s /q %TEMP_DIR%
)
:: --- 白名单恢复逻辑结束 ---

echo.
echo 构建完成! 
echo 请将 frontend/dist 文件夹的内容上传到 GitHub 仓库的 gh-pages 分支。
pause
