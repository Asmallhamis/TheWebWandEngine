@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ==========================================
echo      TWWE 一键打包工具 (增强版)
echo ==========================================
echo.

:: 1. 环境检查
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Python，请先安装 Python 并添加到 PATH。
    pause
    exit /b
)

:: 2. 清理旧的构建产物
echo [1/5] 清理旧的构建目录...
if exist build rd /s /q build
if exist dist rd /s /q dist
if exist frontend\dist rd /s /q frontend\dist

:: 3. 编译前端
echo [2/5] 正在编译前端 (npm run build)...
cd frontend
:: 确保环境变量不干扰打包，强制设置 VITE_STATIC_MODE 为空
set VITE_STATIC_MODE=
call npm install
call npm run build
if %errorlevel% neq 0 (
    echo [错误] 前端编译失败！
    pause
    exit /b
)
cd ..

:: 4. 验证核心数据是否存在
if not exist noitadata\data (
    echo [警告] 未发现 noitadata\data，建议先运行 prepare_static_assets.py。
    echo [信息] 尝试运行 prepare_static_assets.py...
    python prepare_static_assets.py
)

:: 5. 开始打包 EXE
echo [3/5] 正在生成便携式 EXE...
echo [信息] 正在安装/更新打包依赖...
pip install pyinstaller pypinyin flask flask_cors >nul

:: 使用 twwe.spec 进行打包
pyinstaller --clean --noconfirm twwe.spec

if %errorlevel% equ 0 (
    echo.
    echo ==========================================
    echo [成功] 打包完成！
    echo 最终文件: dist\TheWebWandEngine.exe
    echo ==========================================
    echo.
    
    :: 自动清理冗余文件
    if exist TheWebWandEngine.spec del /q TheWebWandEngine.spec
) else (
    echo.
    echo [错误] 打包失败，请检查上方的错误信息。
)

pause
