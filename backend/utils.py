import os
import socket
import json

# 这些由 server.py 初始化时传入
_GAME_ROOT = None
EXTRACTED_DATA_ROOT = None
ACTIVE_MODS_CACHE = []

def init_utils(game_root, extracted_root):
    global _GAME_ROOT, EXTRACTED_DATA_ROOT
    _GAME_ROOT = game_root
    EXTRACTED_DATA_ROOT = extracted_root

def set_active_mods(mods):
    global ACTIVE_MODS_CACHE
    ACTIVE_MODS_CACHE = mods

def get_game_root():
    return _GAME_ROOT

def find_noita_file(rel_path, active_mods=None):
    """
    在 Noita 的多个可能目录中查找文件。
    优先级: 1. 解压数据 2. 游戏根目录 3. 各个 Mod 目录
    """
    if not rel_path: return None
    rel_path = rel_path.lstrip("/").replace("\\", "/")
    
    # 1. 检查解压后的 data 目录
    if EXTRACTED_DATA_ROOT:
        p = os.path.join(EXTRACTED_DATA_ROOT, rel_path).replace("\\", "/")
        if os.path.exists(p): return p

    # 2. 检查游戏根目录
    root = get_game_root()
    if root:
        p = os.path.join(root, rel_path).replace("\\", "/")
        if os.path.exists(p): return p
        
        # 3. 检查活动 Mod 目录
        mods_to_check = active_mods or ACTIVE_MODS_CACHE
        for mod_id in mods_to_check:
            # 如果路径已经是 mods/mod_id/... 开头，则直接拼接
            if rel_path.startswith(f"mods/{mod_id}/"):
                p = os.path.join(root, rel_path).replace("\\", "/")
            else:
                p = os.path.join(root, "mods", mod_id, rel_path).replace("\\", "/")
            
            if os.path.exists(p): return p
            
    return None

def resolve_placeholders(path, mod_id):
    """解析 Noita 常见的占位符"""
    if not mod_id: return path
    mp = f"mods/{mod_id}/"
    path = path.replace("___", f"{mod_id}_")
    path = path.replace("__MOD_NAME__", mod_id)
    path = path.replace("__MOD_FILES__", f"{mp}files/")
    path = path.replace("__MOD_ACTIONS__", f"{mp}files/actions/")
    path = path.replace("__MOD_LIBS__", f"{mp}libs/")
    path = path.replace("__MOD_ACTION_UTILS__", f"{mp}files/action_utils/")
    return path
