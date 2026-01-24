@echo off
chcp 65001 >nul
echo ==========================================
echo      TheWebWandEngine 一键打包脚本
echo ==========================================
echo.

:: 1. 检测 PyInstaller
pyinstaller --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] 未检测到 PyInstaller，正在安装...
    pip install pyinstaller
)

:: 2. 编译前端
echo [INFO] 正在编译前端 (npm run build)...
cd frontend
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] 前端编译失败！
    pause
    exit /b
)
cd ..

:: 3. 开始打包 EXE
echo [INFO] 正在生成 EXE (这可能需要几分钟)...
pyinstaller --clean --noconfirm twwe.spec

if %errorlevel% equ 0 (
    echo.
    echo [SUCCESS] 打包成功！
    echo 文件位于: dist\TheWebWandEngine.exe
    echo.
    echo 您可以将该 .exe 文件发送给任何人，无需 data 文件夹。
) else (
    echo.
    echo [ERROR] 打包失败，请检查错误日志。
)

pause
