"""
TWWE Backend — 游戏通信服务
处理与 Noita 游戏实例的 Socket 通信
"""
import sys
import os
import json
import socket
import subprocess

from config import GAME_HOST, GAME_PORT, LUAJIT_PATH, BASE_DIR

_GAME_ROOT = None


def get_game_root():
    """获取 Noita 游戏根目录 (缓存结果)"""
    global _GAME_ROOT
    if _GAME_ROOT:
        return _GAME_ROOT

    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.settimeout(0.5)
            sock.connect((GAME_HOST, GAME_PORT))
            sock.sendall(b"GET_GAME_INFO\n")
            res = sock.recv(1024).decode("utf-8").strip()
            _GAME_ROOT = json.loads(res).get("root")
    except Exception:
        pass

    if not _GAME_ROOT:
        common = [
            "E:/software/steam/steamapps/common/Noita",
            "C:/SteamLibrary/steamapps/common/Noita",
        ]
        for p in common:
            if os.path.exists(p):
                _GAME_ROOT = p
                break
    return _GAME_ROOT


def talk_to_game(cmd):
    """通过 Socket 向游戏发送命令并接收响应"""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.settimeout(2)
            sock.connect((GAME_HOST, GAME_PORT))
            sock.sendall(cmd if isinstance(cmd, bytes) else (cmd + "\n").encode("utf-8"))

            chunks = []
            while True:
                chunk = sock.recv(65536)
                if not chunk:
                    break
                chunks.append(chunk)
                if b"\n" in chunk:
                    break

            # 使用 ignore 模式避免非法字符导致崩溃
            resp = b"".join(chunks).decode("utf-8", "ignore")
            return resp.strip()
    except Exception as e:
        print(f"Error talking to game: {e}")
        return None


def get_noita_save_path():
    """获取 Noita 存档路径"""
    if sys.platform == "win32":
        return os.path.join(
            os.environ["USERPROFILE"], "AppData/LocalLow/Nolla_Games_Noita/save00"
        ).replace("\\", "/")
    return None


def read_noita_mod_settings():
    """读取 Noita mod_config.xml 中的设置"""
    save_path = get_noita_save_path()
    if not save_path:
        return {}

    config_path = os.path.join(save_path, "mod_config.xml")
    if not os.path.exists(config_path):
        return {}

    try:
        import xml.etree.ElementTree as ET
        root = ET.parse(config_path).getroot()
        settings = {}
        for item in root.findall('ConfigItem'):
            setting_id = item.get('setting_id')
            value = item.get('value_string')
            if setting_id and value:
                settings[setting_id] = value
        return settings
    except Exception as e:
        print(f"Error reading mod_config.xml: {e}")
        return {}


def run_lua_helper(mode, data_string):
    """调用 LuaJIT 辅助脚本解析游戏数据"""
    import tempfile
    with tempfile.NamedTemporaryFile(mode='w', delete=False, encoding='utf-8', suffix='.txt') as tmp:
        tmp.write(data_string)
        tmp_path = tmp.name

    try:
        helper_candidates = [
            os.path.join(BASE_DIR, "backend", "import_helper.lua"),
            os.path.join(os.path.dirname(__file__), "..", "import_helper.lua"),
        ]
        helper_path = next((p for p in helper_candidates if os.path.exists(p)), helper_candidates[-1])
        result = subprocess.run(
            [LUAJIT_PATH, helper_path, mode, tmp_path],
            capture_output=True, text=True, encoding="utf-8"
        )
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)

        if result.returncode != 0:
            print(f"Lua error: {result.stderr}")
            return None

        return json.loads(result.stdout)
    except Exception as e:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
        print(f"Error running lua helper: {e}")
        return None
