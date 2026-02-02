#!/usr/bin/env python3
import os
import sys
import shutil
import subprocess
import platform
from pathlib import Path

# ============================================================
# Localization
# ============================================================

MESSAGES = {
    "zh": {
        "title": "TWWE 一键打包工具 (跨平台)",
        "os": "操作系统",
        "check_python": "[1/5] 检查 Python 环境...",
        "python_too_old": "需要 Python 3.8 或更高版本",
        "clean": "[2/5] 清理旧的构建目录...",
        "build_frontend": "[3/5] 编译前端 (npm run build)...",
        "frontend_missing": "未找到 frontend 目录",
        "data_missing": "[警告] 未发现 noitadata/data，尝试运行 prepare_static_assets.py...",
        "install_deps": "[4/5] 安装 / 更新打包依赖...",
        "run_pyinstaller": "[5/5] 运行 PyInstaller...",
        "success": "[成功] 打包完成！",
        "output_win": "最终文件: dist/TheWebWandEngine.exe",
        "output_unix": "最终文件: dist/TheWebWandEngine",
        "error": "[错误]",
        "cmd": ">",
        "choose_lang": "请选择语言 / Choose language:\n1. 中文\n2. English\n> ",
        "invalid_lang": "无效选择，默认使用中文",
    },
    "en": {
        "title": "TWWE One-Click Build Tool (Cross-platform)",
        "os": "Operating System",
        "check_python": "[1/5] Checking Python environment...",
        "python_too_old": "Python 3.8 or newer is required",
        "clean": "[2/5] Cleaning old build artifacts...",
        "build_frontend": "[3/5] Building frontend (npm run build)...",
        "frontend_missing": "frontend directory not found",
        "data_missing": "[Warning] noitadata/data not found, running prepare_static_assets.py...",
        "install_deps": "[4/5] Installing / updating build dependencies...",
        "run_pyinstaller": "[5/5] Running PyInstaller...",
        "success": "[SUCCESS] Build completed!",
        "output_win": "Output file: dist/TheWebWandEngine.exe",
        "output_unix": "Output file: dist/TheWebWandEngine",
        "error": "[ERROR]",
        "cmd": ">",
        "choose_lang": "Choose language / 请选择语言:\n1. 中文\n2. English\n> ",
        "invalid_lang": "Invalid choice, defaulting to Chinese",
    },
}

def select_language():
    choice = input(MESSAGES["zh"]["choose_lang"]).strip()
    if choice == "2":
        return "en"
    if choice == "1":
        return "zh"
    print(MESSAGES["zh"]["invalid_lang"])
    return "zh"

LANG = select_language()

def msg(key):
    return MESSAGES[LANG][key]

# ============================================================
# Helpers
# ============================================================

def info(text):
    print(text, flush=True)

def error(text, code=1):
    print(f"{msg('error')} {text}", file=sys.stderr, flush=True)
    sys.exit(code)

def run(cmd, cwd=None, env=None):
    info(f"{msg('cmd')} {' '.join(cmd)}")
    subprocess.run(cmd, cwd=cwd, env=env, check=True)

# ============================================================
# OS detection
# ============================================================

OS_NAME = platform.system()
IS_WINDOWS = OS_NAME == "Windows"

info("==========================================")
info(msg("title"))
info(f"{msg('os')}: {OS_NAME}")
info("==========================================\n")

# ============================================================
# 1. Python check
# ============================================================

info(msg("check_python"))
if sys.version_info < (3, 8):
    error(msg("python_too_old"))

PYTHON = sys.executable

# ============================================================
# 2. Clean
# ============================================================

info(msg("clean"))
for path in ("build", "dist", "frontend/dist"):
    shutil.rmtree(path, ignore_errors=True)

# ============================================================
# 3. Frontend build
# ============================================================

info(msg("build_frontend"))

frontend_dir = Path("frontend")
if not frontend_dir.exists():
    error(msg("frontend_missing"))

env = os.environ.copy()
env["VITE_STATIC_MODE"] = ""

run(["npm", "install"], cwd=frontend_dir, env=env)
run(["npm", "run", "build"], cwd=frontend_dir, env=env)

# ============================================================
# 4. Data check
# ============================================================

data_dir = Path("noitadata/data")
if not data_dir.exists():
    info(msg("data_missing"))
    run([PYTHON, "prepare_static_assets.py"])

# ============================================================
# 5. Packaging
# ============================================================

info(msg("install_deps"))
run([
    PYTHON, "-m", "pip", "install", "-U",
    "pyinstaller", "pypinyin", "flask", "flask-cors"
])

info(msg("run_pyinstaller"))
run(["pyinstaller", "--clean", "--noconfirm", "twwe.spec"])

# ============================================================
# Result
# ============================================================

info("\n==========================================")
info(msg("success"))
info(msg("output_win") if IS_WINDOWS else msg("output_unix"))
info("==========================================\n")
