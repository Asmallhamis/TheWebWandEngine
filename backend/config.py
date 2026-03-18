"""
TWWE Backend — 全局配置与共享状态
"""
import sys
import os
import subprocess
import mimetypes
from threading import Lock

# 强制注册 JS 为正确类型，防止 Windows 注册表错误导致浏览器拒绝执行脚本 (黑屏问题)
mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('text/css', '.css')
mimetypes.add_type('application/wasm', '.wasm')

# --- 路径配置 ---

LUAJIT_EXECUTABLE = "luajit.exe" if sys.platform.startswith("win") else "luajit"

if getattr(sys, 'frozen', False):
    # PyInstaller 运行模式：从临时解压目录读取 (嵌入数据)
    BASE_DIR = sys._MEIPASS
    EXTRACTED_DATA_ROOT = os.path.join(BASE_DIR, "noitadata_internal")
    FRONTEND_DIST = os.path.join(BASE_DIR, "frontend", "dist")
    WAND_EVAL_DIR = os.path.join(BASE_DIR, "wand_eval_tree")
    LUAJIT_PATH = os.path.join(BASE_DIR, "bin", LUAJIT_EXECUTABLE)
else:
    # 开发模式
    BASE_DIR = os.getcwd()
    EXTRACTED_DATA_ROOT = os.path.join(BASE_DIR, "noitadata")
    FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "../frontend/dist")
    WAND_EVAL_DIR = os.path.join(BASE_DIR, "wand_eval_tree")
    # 开发模式优先尝试 bin 目录下的 luajit，否则用系统的
    local_luajit = os.path.join(BASE_DIR, "bin", LUAJIT_EXECUTABLE)
    LUAJIT_PATH = local_luajit if os.path.exists(local_luajit) else "luajit"

GAME_HOST = "127.0.0.1"
GAME_PORT = 12345

# --- 共享可变状态 ---

mod_state = {
    "spells": {},      # _MOD_SPELL_CACHE
    "appends": {},     # _MOD_APPENDS_CACHE
    "active_mods": [], # _ACTIVE_MODS_CACHE
}

# 进程管理：防止多个 luajit 同时运行撑爆内存
active_processes = {}
process_lock = Lock()


def kill_existing_instance():
    """尝试杀死已经在运行的后端实例 (占用 17471 端口的进程)"""
    import time
    if sys.platform != "win32":
        return
    try:
        output = subprocess.check_output(['netstat', '-aon'], text=True)
        my_pid = os.getpid()
        for line in output.splitlines():
            if ':17471' in line and 'LISTENING' in line:
                parts = line.split()
                if len(parts) >= 5:
                    pid = parts[-1]
                    try:
                        pid_int = int(pid)
                        if pid_int != my_pid:
                            print(f"[System] 发现旧实例正在运行 (PID: {pid})，正在清理...")
                            subprocess.run(['taskkill', '/F', '/PID', pid], capture_output=True)
                            time.sleep(0.5)
                    except ValueError:
                        continue
    except Exception as e:
        print(f"[System] 清理旧实例时出错: {e}")
