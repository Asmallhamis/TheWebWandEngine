#!/usr/bin/env python3
import json
import sys
import socket
import os
import re
import io
import subprocess
import webbrowser
import mimetypes
import signal

def kill_existing_instance():
    """尝试杀死已经在运行的后端实例 (占用 17471 端口的进程)"""
    if sys.platform != "win32":
        return
    try:
        # 使用 netstat 查找占用端口的 PID
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
                            time.sleep(0.5) # 给点时间释放端口
                    except ValueError:
                        continue
    except Exception as e:
        print(f"[System] 清理旧实例时出错: {e}")

# 强制注册 JS 为正确类型，防止 Windows 注册表错误导致浏览器拒绝执行脚本 (黑屏问题)
mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('text/css', '.css')
mimetypes.add_type('application/wasm', '.wasm')

try:
    from pypinyin import pinyin, Style
    HAS_PYPINYIN = True
except ImportError:
    HAS_PYPINYIN = False
from threading import Timer, Lock
from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

GAME_HOST = "127.0.0.1"
GAME_PORT = 12345
_GAME_ROOT = None

import time

# 自动检测打包环境与路径配置
if getattr(sys, 'frozen', False):
    # PyInstaller 运行模式：从临时解压目录读取 (嵌入数据)
    BASE_DIR = sys._MEIPASS
    EXTRACTED_DATA_ROOT = os.path.join(BASE_DIR, "noitadata_internal")
    FRONTEND_DIST = os.path.join(BASE_DIR, "frontend", "dist")
    WAND_EVAL_DIR = os.path.join(BASE_DIR, "wand_eval_tree")
    LUAJIT_PATH = os.path.join(BASE_DIR, "bin", "luajit.exe")
else:
    # 开发模式
    BASE_DIR = os.getcwd()
    EXTRACTED_DATA_ROOT = os.path.join(BASE_DIR, "noitadata")
    if not os.path.exists(EXTRACTED_DATA_ROOT):
        EXTRACTED_DATA_ROOT = r"E:\download\TheWebWandEngine\noitadata"
    
    FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "../frontend/dist")
    WAND_EVAL_DIR = os.path.join(BASE_DIR, "wand_eval_tree")
    # 开发模式优先尝试 bin 目录下的 luajit，否则用系统的
    local_luajit = os.path.join(BASE_DIR, "bin/luajit.exe")
    LUAJIT_PATH = local_luajit if os.path.exists(local_luajit) else "luajit"

# 配置 Flask 静态资源目录 (用于打包 EXE 后能找到网页)
app.static_folder = FRONTEND_DIST

# 进程管理：防止多个 luajit 同时运行撑爆内存
active_processes = {}
process_lock = Lock()

# 预加载数据
_SPELL_CACHE = {}
_MOD_SPELL_CACHE = {}
_MOD_APPENDS_CACHE = {}
_ACTIVE_MODS_CACHE = []
_TRANSLATIONS = {}

def get_pinyin_data(text):
    if not HAS_PYPINYIN or not text:
        return "", ""
    try:
        # Full pinyin without tones
        full = "".join([item[0] for item in pinyin(text, style=Style.NORMAL)])
        # Initials
        initials = "".join([item[0] for item in pinyin(text, style=Style.FIRST_LETTER)])
        return full.lower(), initials.lower()
    except:
        return "", ""

def load_translations():
    global _TRANSLATIONS
    if _TRANSLATIONS: return _TRANSLATIONS
    
    trans_files = [
        os.path.join(EXTRACTED_DATA_ROOT, "data/translations/common.csv"),
        os.path.join(EXTRACTED_DATA_ROOT, "data/translations/common_dev.csv"),
        os.path.join(BASE_DIR, "spell_mapping.md") # 支持新的 md 格式
    ]
    
    translations = {}
    for file_path in trans_files:
        if not os.path.exists(file_path):
            continue
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                if file_path.endswith(".md"):
                    # 处理 Markdown 表格格式 (| 分隔)
                    for line in f:
                        if "|" not in line or "SPELL ID" in line or "---" in line:
                            continue
                        parts = [p.strip() for p in line.split("|")]
                        if len(parts) >= 4:
                            key = parts[0].lstrip('$')
                            translations[key] = {
                                "en": key, # md 暂时没存英文名，用 ID 占位
                                "zh": parts[2] or parts[1], # 优先选汉化 mod 名，没有则选官方中文
                                "aliases": parts[3] # 存入别名
                            }
                    continue

                import csv
                # Noita CSVs often have junk or extra commas, we use a simple reader
                reader = csv.reader(f)
                header = next(reader, None)
                if not header: continue
                
                # Standard Noita indices
                en_idx = 1
                zh_idx = 9 # Default zh-cn index
                
                # Dynamic index detection
                for i, h in enumerate(header):
                    h_lower = h.lower()
                    if h_lower == 'en': en_idx = i
                    elif h_lower == 'zh-cn': zh_idx = i
                    elif 'zh-cn汉化mod' in h_lower: zh_idx = i # Prefer modded zh-cn if available
                    elif h_lower == '简体中文' and zh_idx == 9: zh_idx = i
                
                for row in reader:
                    if not row or len(row) < 2: continue
                    key = row[0].lstrip('$')
                    if not key: continue
                    
                    en_val = row[en_idx] if len(row) > en_idx else ""
                    zh_val = row[zh_idx] if len(row) > zh_idx else ""
                    
                    # Store translations
                    if key not in translations:
                        translations[key] = {"en": "", "zh": ""}
                    
                    if en_val: translations[key]["en"] = en_val.replace('\\n', '\n').strip('"')
                    if zh_val: translations[key]["zh"] = zh_val.replace('\\n', '\n').strip('"')
        except Exception as e:
            print(f"Error loading translations from {file_path}: {e}")
            
    _TRANSLATIONS = translations
    return translations

def load_spell_mapping():
    mapping_path = os.path.join(BASE_DIR, "spell_mapping.md")
    if not os.path.exists(mapping_path):
        return {}
    
    mapping = {}
    try:
        with open(mapping_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
            for line in lines:
                if "|" not in line or line.startswith("SPELL ID") or line.startswith("---"):
                    continue
                parts = [p.strip() for p in line.split("|")]
                if len(parts) >= 4:
                    spell_id = parts[0]
                    mapping[spell_id] = {
                        "official": parts[1],
                        "mod": parts[2],
                        "aliases": parts[3]
                    }
    except Exception as e:
        print(f"Error loading spell mapping: {e}")
    return mapping

def load_spell_database():
    global _SPELL_CACHE
    if _SPELL_CACHE: return _SPELL_CACHE
    
    trans = load_translations()
    mapping = load_spell_mapping()
    actions_file = os.path.join(EXTRACTED_DATA_ROOT, "data/scripts/gun/gun_actions.lua")
    if not os.path.exists(actions_file):
        print(f"Warning: gun_actions.lua not found at {actions_file}")
        return {}

    try:
        with open(actions_file, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
        
        # 1. 剥离 Lua 注释
        content = re.sub(r'--\[\[.*?\]\]', '', content, flags=re.DOTALL)
        content = re.sub(r'--.*', '', content)

        # 2. 定义类型映射
        TYPE_MAP = {
            "ACTION_TYPE_PROJECTILE": 0,
            "ACTION_TYPE_STATIC_PROJECTILE": 1,
            "ACTION_TYPE_MODIFIER": 2,
            "ACTION_TYPE_DRAW_MANY": 3,
            "ACTION_TYPE_MATERIAL": 4,
            "ACTION_TYPE_OTHER": 5,
            "ACTION_TYPE_UTILITY": 6,
            "ACTION_TYPE_PASSIVE": 7
        }

        # 3. 提取法术块
        action_blocks = re.findall(r'\{\s*(id\s*=\s*"[^"]+".*?price\s*=\s*\d+.*?)\s*\},', content, re.DOTALL)
        
        db = {}
        for block in action_blocks:
            id_match = re.search(r'id\s*=\s*"([^"]+)"', block)
            name_match = re.search(r'name\s*=\s*"([^"]+)"', block)
            sprite_match = re.search(r'sprite\s*=\s*"([^"]+)"', block)
            type_match = re.search(r'type\s*=\s*([A-Z0-9_]+)', block)
            uses_match = re.search(r'max_uses\s*=\s*(-?\d+)', block)
            
            if id_match and sprite_match:
                spell_id = id_match.group(1)
                raw_name = name_match.group(1) if name_match else spell_id
                
                # 获取翻译
                en_name = raw_name
                zh_name = raw_name
                
                if raw_name.startswith("$"):
                    trans_key = raw_name.lstrip("$")
                    if trans_key in trans:
                        en_name = trans[trans_key]["en"] or raw_name
                        zh_name = trans[trans_key]["zh"] or raw_name
                
                py_full, py_init = get_pinyin_data(zh_name)
                
                # Merge from mapping
                aliases = ""
                alias_py = ""
                alias_init = ""
                if spell_id in mapping:
                    m = mapping[spell_id]
                    # If common.csv didn't have a good name, use mapping
                    if zh_name == raw_name or not zh_name:
                        zh_name = m["mod"] or m["official"] or zh_name
                        py_full, py_init = get_pinyin_data(zh_name)
                    
                    aliases = m["aliases"]
                    if aliases:
                        alias_py, alias_init = get_pinyin_data(aliases)

                type_str = type_match.group(1) if type_match else "ACTION_TYPE_PROJECTILE"
                db[spell_id] = {
                    "icon": sprite_match.group(1).lstrip("/"),
                    "name": zh_name,
                    "en_name": en_name,
                    "pinyin": py_full,
                    "pinyin_initials": py_init,
                    "aliases": aliases,
                    "alias_pinyin": alias_py,
                    "alias_initials": alias_init,
                    "type": TYPE_MAP.get(type_str, 0),
                    "max_uses": int(uses_match.group(1)) if uses_match else None
                }
        _SPELL_CACHE = db
        print(f"Loaded {len(db)} clean spells with translations")
        return db
    except Exception as e:
        print(f"Error parsing local spells: {e}")
        return {}

def get_game_root():
    global _GAME_ROOT
    if _GAME_ROOT: return _GAME_ROOT
    
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.settimeout(0.5)
            sock.connect((GAME_HOST, GAME_PORT))
            sock.sendall(b"GET_GAME_INFO\n")
            res = sock.recv(1024).decode("utf-8").strip()
            _GAME_ROOT = json.loads(res).get("root")
    except: pass

    if not _GAME_ROOT:
        common = ["E:/software/steam/steamapps/common/Noita", "C:/SteamLibrary/steamapps/common/Noita"]
        for p in common:
            if os.path.exists(p):
                _GAME_ROOT = p
                break
    return _GAME_ROOT

def talk_to_game(cmd):
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.settimeout(2) # 降低超时时间，避免未连接时阻塞前端
            sock.connect((GAME_HOST, GAME_PORT))
            sock.sendall(cmd if isinstance(cmd, bytes) else (cmd + "\n").encode("utf-8"))
            
            chunks = []
            while True:
                chunk = sock.recv(65536) # 增加缓冲区大小
                if not chunk: break
                chunks.append(chunk)
                if b"\n" in chunk: break
            
            # 使用 ignore 模式避免非法字符导致崩溃
            resp = b"".join(chunks).decode("utf-8", "ignore")
            return resp.strip()
    except Exception as e:
        print(f"Error talking to game: {e}")
        return None

@app.route("/api/status")
def status():
    # Check if we can actually talk to the game right now
    test_res = talk_to_game("PING")
    is_live = test_res is not None
    return jsonify({
        "connected": is_live,
        "game_root": get_game_root()
    })

def get_noita_save_path():
    if sys.platform == "win32":
        return os.path.join(os.environ["USERPROFILE"], "AppData/LocalLow/Nolla_Games_Noita/save00").replace("\\", "/")
    return None

def read_noita_mod_settings():
    save_path = get_noita_save_path()
    if not save_path: return {}
    
    config_path = os.path.join(save_path, "mod_config.xml")
    if not os.path.exists(config_path):
        return {}
    
    import xml.etree.ElementTree as ET
    try:
        tree = ET.parse(config_path)
        root = tree.getroot()
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
    import tempfile
    with tempfile.NamedTemporaryFile(mode='w', delete=False, encoding='utf-8', suffix='.txt') as tmp:
        tmp.write(data_string)
        tmp_path = tmp.name
    
    try:
        helper_path = os.path.join(os.path.dirname(__file__), "import_helper.lua")
        result = subprocess.run([LUAJIT_PATH, helper_path, mode, tmp_path], capture_output=True, text=True, encoding="utf-8")
        if os.path.exists(tmp_path): os.unlink(tmp_path)
        
        if result.returncode != 0:
            print(f"Lua error: {result.stderr}")
            return None
        
        return json.loads(result.stdout)
    except Exception as e:
        if os.path.exists(tmp_path): os.unlink(tmp_path)
        print(f"Error running lua helper: {e}")
        return None

@app.route("/api/import/wand-editor")
def import_wand_editor():
    # Try live game first
    live_data = talk_to_game("GET_WAND_EDITOR_DATA")
    pages_raw = []
    if live_data:
        try:
            pages_raw = json.loads(live_data)
        except: pass
    
    # Fallback to XML if no live data
    if not pages_raw:
        settings = read_noita_mod_settings()
        idx = 1
        while True:
            key = f"wand_editorWandDepot{idx}"
            if key in settings:
                pages_raw.append(settings[key])
                idx += 1
            else:
                break
            
    if not pages_raw:
        return jsonify({"success": False, "error": "No Wand Editor depot data found"}), 404

    try:
        wands = []
        folders = []
        root_folder_id = "from_wand_editor"
        folders.append({
            "id": root_folder_id,
            "name": "来自 Wand Editor",
            "order": 0,
            "isOpen": True,
            "parentId": None
        })

        for page_idx, raw_val in enumerate(pages_raw):
            page_data = run_lua_helper("wand-editor", raw_val)
            if not page_data: continue
            
            page_folder_id = f"{root_folder_id}_page_{page_idx + 1}"
            folders.append({
                "id": page_folder_id,
                "name": f"第 {page_idx + 1} 页",
                "order": page_idx,
                "isOpen": False,
                "parentId": root_folder_id
            })
            
            for wand_idx, w in enumerate(page_data):
                if not w or not isinstance(w, dict): continue
                
                # Transform Wand Editor structure
                we_spells = w.get("spells", {})
                spells = {}
                spell_uses = {}
                
                for s_idx, s_entry in enumerate(we_spells.get("spells", [])):
                    if isinstance(s_entry, dict) and s_entry.get("id"):
                        sid = s_entry["id"]
                        if sid != "nil":
                            spells[str(s_idx + 1)] = sid
                            if s_entry.get("uses_remaining") and s_entry["uses_remaining"] != -1:
                                spell_uses[str(s_idx + 1)] = s_entry["uses_remaining"]
                
                always_cast = []
                for ac_entry in we_spells.get("always", []):
                    if isinstance(ac_entry, dict) and ac_entry.get("id"):
                        always_cast.append(ac_entry["id"])

                wand_name = w.get("item_name") or "未命名魔杖"
                py_full, py_init = get_pinyin_data(wand_name)

                appearance = {
                    "sprite": w.get("sprite_file"),
                    "name": wand_name
                }

                new_wand = {
                    "id": f"we_{page_idx}_{wand_idx}_{os.urandom(4).hex()}",
                    "name": wand_name,
                    "pinyin": py_full,
                    "pinyin_initials": py_init,
                    "mana_max": w.get("mana_max", 400),
                    "mana_charge_speed": w.get("mana_charge_speed", 10),
                    "reload_time": w.get("reload_time", 30),
                    "fire_rate_wait": w.get("fire_rate_wait", 10),
                    "deck_capacity": w.get("deck_capacity", 10),
                    "shuffle_deck_when_empty": bool(w.get("shuffle_deck_when_empty", False)),
                    "spread_degrees": w.get("spread_degrees", 0),
                    "speed_multiplier": w.get("speed_multiplier", 1),
                    "actions_per_round": w.get("actions_per_round", 1),
                    "spells": spells,
                    "spell_uses": spell_uses,
                    "always_cast": always_cast,
                    "appearance": appearance,
                    "tags": ["WandEditor"],
                    "createdAt": int(time.time() * 1000),
                    "folderId": page_folder_id,
                    "order": wand_idx
                }
                wands.append(new_wand)
        
        return jsonify({"success": True, "wands": wands, "folders": folders})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/import/spell-lab")
def import_spell_lab():
    # Try live game first
    live_data_raw = talk_to_game("GET_SPELL_LAB_DATA")
    all_wands_data = []
    
    if live_data_raw:
        try:
            live_data = json.loads(live_data_raw)
            # Shugged pages
            for page_str in live_data.get("shugged", []):
                res = run_lua_helper("spell-lab", page_str)
                if res: all_wands_data.extend(res)
            # Original
            orig_str = live_data.get("original")
            if orig_str:
                res = run_lua_helper("spell-lab", orig_str)
                if res: all_wands_data.extend(res)
        except: pass
    
    # Fallback to XML
    if not all_wands_data:
        settings = read_noita_mod_settings()
        # Shugged
        max_index = settings.get("spell_lab_shugged.wand_box_page_max_index")
        if max_index:
            for i in range(1, int(max_index) + 1):
                page_str = settings.get(f"spell_lab_shugged.wand_box_page_{i}")
                if page_str:
                    res = run_lua_helper("spell-lab", page_str)
                    if res: all_wands_data.extend(res)
        # Original
        original_data = settings.get("spell_lab_saved_wands")
        if original_data:
            res = run_lua_helper("spell-lab", original_data)
            if res: all_wands_data.extend(res)

    if not all_wands_data:
        return jsonify({"success": False, "error": "No Spell Lab Shugged data found"}), 404

    try:
        wands = []
        folders = []
        root_folder_id = "from_spell_lab_shugged"
        folders.append({
            "id": root_folder_id,
            "name": "来自 Spell Lab Shugged",
            "order": 1,
            "isOpen": True,
            "parentId": None
        })

        for idx, w in enumerate(all_wands_data):
            if not w or not isinstance(w, dict): continue
            
            stats = w.get("stats", {})
            actions = w.get("all_actions", [])
            spells = {}
            spell_uses = {}
            always_cast = []
            
            for a in actions:
                aid = a.get("action_id")
                if not aid: continue
                if a.get("permanent"):
                    always_cast.append(aid)
                else:
                    slot = str(a.get("x", 0) + 1)
                    spells[slot] = aid
                    if a.get("uses_remaining") and a.get("uses_remaining") != -1:
                        spell_uses[slot] = a.get("uses_remaining")

            wand_name = w.get("name") or stats.get("ui_name") or "SpellLab Wand"
            py_full, py_init = get_pinyin_data(wand_name)
            
            appearance = {}
            if w.get("sprite"):
                appearance["sprite"] = w["sprite"].get("file")
                appearance["item_sprite"] = w["sprite"].get("file")
            elif stats.get("sprite_file"):
                appearance["sprite"] = stats.get("sprite_file")

            new_wand = {
                "id": f"sl_{idx}_{os.urandom(4).hex()}",
                "name": wand_name,
                "pinyin": py_full,
                "pinyin_initials": py_init,
                "mana_max": stats.get("mana_max", 400),
                "mana_charge_speed": stats.get("mana_charge_speed", 10),
                "reload_time": stats.get("reload_time", 30),
                "fire_rate_wait": stats.get("fire_rate_wait", 10),
                "deck_capacity": stats.get("deck_capacity", 10),
                "shuffle_deck_when_empty": bool(stats.get("shuffle_deck_when_empty", False)),
                "spread_degrees": stats.get("spread_degrees", 0),
                "speed_multiplier": stats.get("speed_multiplier", 1),
                "actions_per_round": stats.get("actions_per_round", 1),
                "spells": spells,
                "spell_uses": spell_uses,
                "always_cast": always_cast,
                "appearance": appearance,
                "tags": ["SpellLab"],
                "createdAt": int(time.time() * 1000),
                "folderId": root_folder_id,
                "order": idx
            }
            wands.append(new_wand)
            
        return jsonify({"success": True, "wands": wands, "folders": folders})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500



@app.route("/api/fetch-spells")
def fetch_spells():
    db = load_spell_database().copy()
    if _MOD_SPELL_CACHE:
        db.update(_MOD_SPELL_CACHE)
    if db:
        return jsonify({"success": True, "spells": db})
    return jsonify({"success": False, "error": "Local data not found"}), 404

@app.route("/api/sync-game-spells")
def sync_game_spells():
    global _MOD_SPELL_CACHE, _MOD_APPENDS_CACHE, _ACTIVE_MODS_CACHE
    res = talk_to_game("GET_ALL_SPELLS")
    if not res:
        return jsonify({"success": False, "error": "Could not connect to game"}), 503
    
    try:
        if not res:
            return jsonify({"success": False, "error": "Game returned empty response"}), 500
        
        data = json.loads(res)
        # 兼容处理：Noita 有时直接返回法术列表，有时返回包含 spells/appends 的字典
        if isinstance(data, list):
            spells = data
            _MOD_APPENDS_CACHE = {}
            _ACTIVE_MODS_CACHE = []
        else:
            spells = data.get("spells", [])
            _MOD_APPENDS_CACHE = data.get("appends", {})
            _ACTIVE_MODS_CACHE = data.get("active_mods", [])
        
        static_db = load_spell_database() 
        mod_db = {}
        for s in spells:
            if not isinstance(s, dict): continue
            spell_id = s.get("id")
            if not spell_id: continue
            
            name = s.get("name", spell_id)
            py_full, py_init = get_pinyin_data(name)
            
            aliases = ""
            alias_py = ""
            alias_init = ""
            # 安全检查：确保从 static_db 中获取的是字典
            if spell_id in static_db:
                entry = static_db[spell_id]
                if isinstance(entry, dict):
                    aliases = entry.get("aliases", "")
                    alias_py = entry.get("alias_pinyin", "")
                    alias_init = entry.get("alias_initials", "")
            
            mod_db[spell_id] = {
                "icon": s.get("sprite", "").lstrip("/"),
                "name": name,
                "en_name": spell_id, 
                "pinyin": py_full,
                "pinyin_initials": py_init,
                "aliases": aliases,
                "alias_pinyin": alias_py,
                "alias_initials": alias_init,
                "type": s.get("type", 0),
                "max_uses": s.get("max_uses", -1),
                "mana": s.get("mana", 0),
                "fire_rate_wait": s.get("fire_rate_wait", 0),
                "reload_time": s.get("reload_time", 0),
                "is_mod": True
            }
        _MOD_SPELL_CACHE = mod_db
        return jsonify({"success": True, "count": len(mod_db)})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/pull")
def pull_game_wands():
    res = talk_to_game("GET_ALL_WANDS")
    if not res:
        return jsonify({"success": False, "error": "Could not connect to game"}), 503
    try:
        return jsonify({"success": True, "wands": json.loads(res)})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/sync", methods=["POST"])
def sync_wand():
    data = request.get_json()
    talk_to_game(json.dumps(data))
    return jsonify({"success": True})

@app.route("/api/icon/<path:icon_path>")
def get_icon(icon_path):
    icon_path = icon_path.lstrip("/")
    
    # Noita 的 sprite_file 通常是 .xml (如 data/items_gfx/handgun.xml)
    # XML 内部 <Sprite filename="data/items_gfx/handgun.png"> 才是真正的图片
    # 此函数自动解析 XML -> PNG 的映射
    def resolve_sprite_xml(xml_file_path):
        """从 Noita sprite XML 文件中提取 PNG 路径"""
        try:
            import xml.etree.ElementTree as ET
            tree = ET.parse(xml_file_path)
            root_el = tree.getroot()
            png_path = root_el.get("filename")
            if png_path:
                return png_path.lstrip("/")
        except Exception as e:
            print(f"Failed to parse sprite XML {xml_file_path}: {e}")
        return None

    def find_file(rel_path):
        """在所有已知路径中查找文件，返回绝对路径或 None"""
        # 1. vanilla 解压目录
        p = os.path.join(EXTRACTED_DATA_ROOT, rel_path).replace("\\", "/")
        if os.path.exists(p):
            return p
        # 2. 游戏安装目录
        root = get_game_root()
        if root:
            p = os.path.join(root, rel_path).replace("\\", "/")
            if os.path.exists(p):
                return p
            # 3. 活动 Mod 目录
            for mod_id in _ACTIVE_MODS_CACHE:
                p = os.path.join(root, "mods", mod_id, rel_path).replace("\\", "/")
                if os.path.exists(p):
                    return p
        return None

    found = find_file(icon_path)
    if found:
        # 如果找到的是 XML sprite 文件，解析出 PNG 路径
        if found.lower().endswith(".xml"):
            png_rel = resolve_sprite_xml(found)
            if png_rel:
                png_found = find_file(png_rel)
                if png_found:
                    return send_file(png_found, max_age=31536000)
        else:
            return send_file(found, max_age=31536000)

    print(f"Icon not found in vanilla or any active mods: {icon_path}")
    return "Not Found", 404

def parse_wiki_wand(text):
    data = {}
    # Improved regex parser for {{Wand2 ...}}
    # Supports both piped parameters and multiline templates
    def get_val(key, default=None):
        # 匹配 |key = value (直到 next | or } or newline)
        m = re.search(rf'\|\s*{key}\s*=\s*([^|\n}}]+)', text, re.IGNORECASE)
        if m:
            val = m.group(1).strip()
            # 移除可能存在的 Wiki 注释
            val = re.sub(r'<!--.*?-->', '', val).strip()
            return val
        return default

    try:
        mana_max = get_val("manaMax")
        if mana_max: data["mana_max"] = float(mana_max)
        
        mana_charge = get_val("manaCharge")
        if mana_charge: data["mana_charge_speed"] = float(mana_charge)
        
        recharge = get_val("rechargeTime")
        if recharge: data["reload_time"] = int(float(recharge) * 60)
        
        cast_delay = get_val("castDelay")
        if cast_delay: data["cast_delay"] = int(float(cast_delay) * 60) # Some use cast_delay
        if not cast_delay:
             cast_delay = get_val("castDelay")
        
        # 兼容不同命名
        fire_rate = get_val("castDelay") or get_val("fireRate")
        if fire_rate: data["fire_rate_wait"] = int(float(fire_rate) * 60)
        
        capacity = get_val("capacity")
        if capacity: data["deck_capacity"] = int(capacity)

        spells_cast = get_val("spellsCast") or get_val("spellsPerCast")
        if spells_cast: data["actions_per_round"] = int(spells_cast)
        
        spread = get_val("spread")
        if spread: data["spread_degrees"] = float(spread)
        
        speed = get_val("speed")
        if speed: data["speed_multiplier"] = float(speed)
        
        shuffle = get_val("shuffle")
        if shuffle:
            data["shuffle_deck_when_empty"] = (shuffle.lower() == "yes" or shuffle == "1" or shuffle.lower() == "true")

        spells = get_val("spells")
        if spells:
            pass

        # Appearance support - 在 spells 解析之外处理，确保始终生效
        wand_pic = get_val("wandPic") or get_val("wand_file")
        if wand_pic:
            # Wiki 名称到文件路径的映射表 (兼容 Component Explorer 格式)
            UNIQUE_WIKI_TO_PATH = {
                "Huilu (Wand).png":          {"sprite": "data/items_gfx/flute.xml",            "item_sprite": "data/items_gfx/flute.png"},
                "Wand kantele.png":          {"sprite": "data/items_gfx/kantele.xml",           "item_sprite": "data/items_gfx/kantele.png"},
                "Wand bomb wand.png":        {"sprite": "data/items_gfx/bomb_wand.xml",         "item_sprite": "data/items_gfx/bomb_wand.png"},
                "Wand handgun.png":          {"sprite": "data/items_gfx/handgun.xml",            "item_sprite": "data/items_gfx/handgun.png"},
                "Wand scepter 01.png":       {"sprite": "data/items_gfx/wands/custom/scepter_01.xml", "item_sprite": "data/items_gfx/wands/custom/scepter_01.png"},
                "Wand experimental wand 1.png": {"sprite": "data/entities/items/wands/experimental/experimental_wand_1_sprite.xml", "item_sprite": "data/entities/items/wands/experimental/experimental_wand_1.png"},
                "Wand experimental wand 2.png": {"sprite": "data/entities/items/wands/experimental/experimental_wand_2_sprite.xml", "item_sprite": "data/entities/items/wands/experimental/experimental_wand_2.png"},
                "Actual wand honest.png":    {"sprite": "data/items_gfx/wands/custom/actual_wand.xml", "item_sprite": "data/items_gfx/wands/custom/actual_wand_honest.png"},
                "Wand wand good 1.png":      {"sprite": "data/items_gfx/wands/custom/good_01.xml", "item_sprite": "data/items_gfx/wands/custom/good_01.png"},
                "Wand wand good 2.png":      {"sprite": "data/items_gfx/wands/custom/good_02.xml", "item_sprite": "data/items_gfx/wands/custom/good_02.png"},
                "Wand wand good 3.png":      {"sprite": "data/items_gfx/wands/custom/good_03.xml", "item_sprite": "data/items_gfx/wands/custom/good_03.png"},
                "Wand skull 01.png":         {"item_sprite": "data/items_gfx/wands/custom/skull_01.png"},
                "Wand wood 01.png":          {"item_sprite": "data/items_gfx/wands/custom/wood_01.png"},
                "Wand plant 01.png":         {"item_sprite": "data/items_gfx/wands/custom/plant_01.png"},
                "Wand plant 02.png":         {"item_sprite": "data/items_gfx/wands/custom/plant_02.png"},
                "Wand vasta.png":            {"item_sprite": "data/items_gfx/wands/custom/vasta.png"},
                "Wand vihta.png":            {"item_sprite": "data/items_gfx/wands/custom/vihta.png"},
            }
            
            if wand_pic in UNIQUE_WIKI_TO_PATH:
                data["appearance"] = UNIQUE_WIKI_TO_PATH[wand_pic]
            elif wand_pic.startswith("data/") or wand_pic.startswith("mods/"):
                # 直接是文件路径
                data["appearance"] = {"sprite": wand_pic, "item_sprite": wand_pic.replace(".xml", ".png")}
            else:
                # 尝试作为 procedural wand 解析: "Wand 0001.png" -> "data/items_gfx/wands/wand_0001.png"
                filename = wand_pic.strip().replace(" ", "_")
                filename = filename[0].lower() + filename[1:] if filename else filename
                data["appearance"] = {"item_sprite": f"data/items_gfx/wands/{filename}"}
        
        if spells:
            # 移除 [[...]] 链接
            spells = re.sub(r'\[\[([^|\]]+\|)?([^\]]+)\]\]', r'\2', spells)
            spells_list = [s.strip() for s in spells.split(',')]
            data["spells"] = {}
            for i, s in enumerate(spells_list):
                if s: data["spells"][str(i+1)] = s
    except Exception as e:
        print(f"Error parsing wiki wand: {e}")
            
    return data

@app.route("/api/parse-wiki", methods=["POST"])
def parse_wiki():
    text = request.data.decode("utf-8")
    return jsonify({"success": True, "wand": parse_wiki_wand(text)})

@app.route("/api/sync-wiki", methods=["POST"])
def sync_wiki():
    body = request.get_json()
    wand = parse_wiki_wand(body.get("wiki", ""))
    slot = body.get("slot", 1)
    wand["slot"] = slot
    talk_to_game(json.dumps(wand))
    return jsonify({"success": True, "parsed_wand": wand})

# 已经由前面的逻辑定义，不要在这里重新定义
# WAND_EVAL_DIR = os.path.join(os.getcwd(), "wand_eval_tree")

@app.route("/api/evaluate", methods=["POST"])
def evaluate_wand():
    data = request.get_json()
    
    # 获取标识符，用于管理该插槽的进程
    tab_id = data.get("tab_id", "default")
    slot_id = data.get("slot_id", "1")
    proc_key = f"{tab_id}-{slot_id}"

    # 提取参数，转换为评估工具需要的格式
    spells_data = data.get("spells", [])
    spell_uses = data.get("spell_uses", {}) # { "1": 5, "3": 0 }
    
    if not spells_data:
        return jsonify({"success": False, "error": "No spells to evaluate"})

    # 构建命令
    def format_lua_arg(val):
        """处理 wand_eval_tree 的负数参数解析 bug"""
        try:
            f_val = float(val)
            if f_val < 0:
                return f".{f_val}" # 转换为 .-12 格式
            return str(val)
        except:
            return str(val)

    # 使用绝对路径并统一斜杠方向，避免 Lua 字符串转义问题
    abs_data_path = EXTRACTED_DATA_ROOT.replace("\\", "/") + "/"
    game_root = get_game_root()
    if game_root:
        game_root = game_root.replace("\\", "/") + "/"
    else:
        game_root = abs_data_path

    cmd = [
        LUAJIT_PATH, 
        "main.lua",
        "-dp", abs_data_path, 
        "-mp", game_root,
        "-j",                    # 开启 JSON 输出
        "-sc", format_lua_arg(data.get("actions_per_round", 1)),
        "-ma", format_lua_arg(data.get("mana_max", 100)),
        "-mx", format_lua_arg(data.get("mana_max", 100)),
        "-mc", format_lua_arg(data.get("mana_charge_speed", 10)),
        "-rt", format_lua_arg(data.get("reload_time", 0)),
        "-cd", format_lua_arg(data.get("fire_rate_wait", 0)),
        "-sm", format_lua_arg(data.get("speed_multiplier", 1.0)),
        "-sd", format_lua_arg(data.get("spread_degrees", 0.0)),
        "-nc", format_lua_arg(data.get("number_of_casts", 10)), # 默认模拟 10 轮
        "-u", "true" if data.get("unlimited_spells", True) else "false", # 无限法术天赋
        "-e", "true" if data.get("initial_if_half", True) else "false", # IF_HALF 初始状态
    ]

    # 进充能停止支持
    if data.get("stop_at_recharge"):
        cmd.append("-sr")
        cmd.append("true")

    # Always Cast 支持
    always_casts = data.get("always_cast", [])
    if always_casts:
        cmd.append("-ac")
        cmd.extend([str(ac) for ac in always_casts if ac])

    # RNG 种子支持
    evaluation_seed = data.get("evaluation_seed")
    if evaluation_seed is not None and evaluation_seed != "":
        cmd.extend(["-se", format_lua_arg(evaluation_seed)])

    # 是否折叠树节点
    # 注意：wand_eval_tree 命令行中，默认 fold=true，传入 -f 会强制将其设为 false。
    # 所以当用户【不想要】折叠时，才添加 -f。
    # 前端 fold_nodes 默认为 true（想要折叠），所以只有当它明确为 false 时，才加 -f。
    if data.get("fold_nodes") == False:
        cmd.append("-f")

    # 环境模拟 (IF_HP, IF_ENEMY, IF_PROJECTILE)
    mock_lua = [
        "-- 覆盖环境检测函数以支持 IF_HP, IF_ENEMY, IF_PROJECTILE",
        "local _old_EntityGetWithTag = EntityGetWithTag",
        "function EntityGetWithTag(tag)",
        "    if tag == 'player_unit' then return { 12345 } end",
        "    if (tag == 'homing_target' or tag == 'enemy') and _TWWE_MANY_ENEMIES then",
        "        local res = {} for i=1,20 do res[i] = 54321 + i end return res",
        "    end",
        "    if tag == 'projectile' and _TWWE_MANY_PROJECTILES then",
        "        local res = {} for i=1,30 do res[i] = 64321 + i end return res",
        "    end",
        "    if _old_EntityGetWithTag then return _old_EntityGetWithTag(tag) end",
        "    return {}",
        "end",
        "function EntityGetTransform(ent) return 0, 0 end",
        "function EntityHasTag(ent, tag)",
        "    if ent == 12345 and tag == 'player_unit' then return true end",
        "    if ent > 54321 and ent <= 54321+20 and (tag == 'enemy' or tag == 'homing_target') then return true end",
        "    if ent > 64321 and ent <= 64321+30 and tag == 'projectile' then return true end",
        "    return false",
        "end",
        "local _old_EntityGetInRadiusWithTag = EntityGetInRadiusWithTag",
        "function EntityGetInRadiusWithTag(x, y, radius, tag)",
        "    if (tag == 'homing_target' or tag == 'enemy') and _TWWE_MANY_ENEMIES then",
        "        local res = {} for i=1,20 do res[i] = 54321 + i end return res",
        "    end",
        "    if tag == 'projectile' and _TWWE_MANY_PROJECTILES then",
        "        local res = {} for i=1,30 do res[i] = 64321 + i end return res",
        "    end",
        "    if _old_EntityGetInRadiusWithTag then return _old_EntityGetInRadiusWithTag(x, y, radius, tag) end",
        "    return {}",
        "end",
        "local _old_EntityGetInRadius = EntityGetInRadius",
        "function EntityGetInRadius(x, y, radius)",
        "    local res = {} ",
        "    if _TWWE_MANY_ENEMIES then for i=1,20 do table.insert(res, 54321+i) end end",
        "    if _TWWE_MANY_PROJECTILES then for i=1,30 do table.insert(res, 64321+i) end end",
        "    if #res > 0 then return res end",
        "    if _old_EntityGetInRadius then return _old_EntityGetInRadius(x, y, radius) end",
        "    return {}",
        "end",
        "function GetUpdatedEntityID() return 12345 end",
        "local _old_EntityGetFirstComponent = EntityGetFirstComponent",
        "function EntityGetFirstComponent(ent, type, tag)",
        "    if ent == 12345 and type == 'DamageModelComponent' then return 67890 end",
        "    if _old_EntityGetFirstComponent then return _old_EntityGetFirstComponent(ent, type, tag) end",
        "    return nil",
        "end",
        "local _old_EntityGetComponent = EntityGetComponent",
        "function EntityGetComponent(ent, type, tag)",
        "    if ent == 12345 and type == 'DamageModelComponent' then return { 67890 } end",
        "    if _old_EntityGetComponent then return _old_EntityGetComponent(ent, type, tag) end",
        "    return {}",
        "end",
        "local _old_ComponentGetValue2 = ComponentGetValue2",
        "function ComponentGetValue2(comp, field)",
        "    if comp == 67890 then",
        "        if field == 'hp' then return _TWWE_LOW_HP and 0.1 or 100.0 end",
        "        if field == 'max_hp' then return 100.0 end",
        "    end",
        "    if _old_ComponentGetValue2 then return _old_ComponentGetValue2(comp, field) end",
        "    return 0",
        "end",
        "function EntityGetIsAlive(ent) return true end"
    ]

    if data.get("simulate_low_hp"):
        mock_lua.insert(0, "_TWWE_LOW_HP = true")
    if data.get("simulate_many_enemies"):
        mock_lua.insert(0, "_TWWE_MANY_ENEMIES = true")
    if data.get("simulate_many_projectiles"):
        mock_lua.insert(0, "_TWWE_MANY_PROJECTILES = true")
    
    # 获取活动模组列表
    active_mods = []
    live_active_mods_res = talk_to_game("GET_ACTIVE_MODS")
    if live_active_mods_res:
        try:
            active_mods = json.loads(live_active_mods_res)
        except: pass
    if not active_mods and _ACTIVE_MODS_CACHE:
        active_mods = _ACTIVE_MODS_CACHE

    # 注入游戏内的法术追加逻辑
    # 我们使用 ModLuaFileAppend 注册追加，这样模拟器在 dofile("gun_actions.lua") 时会自动执行它们
    if _MOD_APPENDS_CACHE:
        # 补丁 Mod 应该放在模拟器目录下
        mock_mod_dir = os.path.join(WAND_EVAL_DIR, "mods", "twwe_mock")
        os.makedirs(mock_mod_dir, exist_ok=True)
        
        should_write_init = False
        for i, (path, content) in enumerate(_MOD_APPENDS_CACHE.items()):
            file_name = f"gen_{i}.lua"
            file_path = os.path.join(mock_mod_dir, file_name)
            
            # 优化：内容没变就不写磁盘，减少 I/O
            try:
                if os.path.exists(file_path):
                    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                        if f.read() == content:
                            continue
            except: pass

            with open(file_path, "w", encoding="utf-8", errors="replace") as f:
                f.write(content)
            mock_lua.append(f'ModLuaFileAppend("data/scripts/gun/gun_actions.lua", "mods/twwe_mock/{file_name}")')
            should_write_init = True

    if mock_lua:
        # 写入 init.lua
        mock_mod_dir = os.path.join(WAND_EVAL_DIR, "mods", "twwe_mock")
        os.makedirs(mock_mod_dir, exist_ok=True)
        
        init_path = os.path.join(mock_mod_dir, "init.lua")
        init_content = "\n".join(mock_lua) + "\n"
        
        # 同样增加缓存检查
        write_init = True
        try:
            if os.path.exists(init_path):
                with open(init_path, "r", encoding="utf-8", errors="ignore") as f:
                    if f.read() == init_content:
                        write_init = False
        except: pass

        if write_init:
            with open(init_path, "w", encoding="utf-8") as f:
                f.write(init_content)
        
        # 核心改动：我们需要把所有 mod 传给模拟器，以便它能找到文件（VFS）
        # 但是我们会在模拟器内部控制只运行 twwe_mock 的代码
        if "twwe_mock" not in cmd:
            cmd.append("-md")
            cmd.append("twwe_mock")
            
        # 即使 twwe_mock 已经存在，也要补全其他 mod 以支持 VFS 搜索
        # 优化：只添加真正的字符串 ID，过滤掉可能被污染的键名
        for m in active_mods:
            if isinstance(m, str) and m not in cmd and m not in ["wand_sync", "appends", "spells", "active_mods"]:
                cmd.append(m)

    # 乱序设置
    if data.get("shuffle_deck_when_empty"):
        # wand_eval_tree 默认是非乱序，如果需要乱序，通常需要特定参数或者它目前可能不支持完美模拟乱序
        # 暂时保持默认，因为用户说没人用乱序
        pass

    # 添加法术列表
    cmd.append("-sp")
    spell_count = 0
    for i, s in enumerate(spells_data):
        if s: 
            # 注入索引信息：格子ID:法术ID (例如 5:SPARK_BOLT)
            # 配合修改后的 fake_engine.lua，这将强制设置模拟器内部的 deck_index
            cmd.append(f"{i+1}:{s}")
            spell_count += 1
            slot_key = str(i + 1)
            if slot_key in spell_uses:
                cmd.append(str(spell_uses[slot_key]))

    if spell_count == 0:
        return jsonify({"success": False, "error": "No spells selected for evaluation"})

    print(f"[Eval] Executing in {WAND_EVAL_DIR}")
    print(f"[Eval] Command: {' '.join(cmd)}")

    try:
        # 管理旧进程：如果该位置已有进程在运行，先杀掉它释放内存
        with process_lock:
            if proc_key in active_processes:
                try:
                    old_proc = active_processes[proc_key]
                    if old_proc.poll() is None: # 仍在运行
                        print(f"[Eval] Terminating stale process for {proc_key}")
                        old_proc.terminate()
                        # 不等待 wait，防止阻塞当前线程
                except Exception as e:
                    print(f"[Eval] Error terminating process: {e}")
                del active_processes[proc_key]

        # 启动新进程
        proc = subprocess.Popen(
            cmd, 
            cwd=WAND_EVAL_DIR, 
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            shell=False
        )
        
        with process_lock:
            active_processes[proc_key] = proc

        try:
            # 等待结果，设置合理超时（针对超大规模递归）
            stdout, stderr = proc.communicate(timeout=60)
        except subprocess.TimeoutExpired:
            proc.kill()
            return jsonify({"success": False, "error": "Evaluation timeout"}), 504
        finally:
            with process_lock:
                if proc_key in active_processes and active_processes[proc_key] == proc:
                    del active_processes[proc_key]

        if proc.returncode != 0:
            # 如果是被 terminate 杀掉的，returncode 通常是负数 (-15)
            if proc.returncode < 0:
                return jsonify({"success": False, "error": "Cancelled"}), 200
            
            err_msg = stderr.decode("utf-8", "replace") if stderr else "Unknown error"
            print(f"[Eval] Failed with return code {proc.returncode}")
            print(f"[Eval] Lua Error: {err_msg}") # 打印具体的 Lua 报错
            return jsonify({
                "success": False, 
                "error": "Evaluation failed", 
                "details": err_msg
            }), 500
        
        # 解析返回的 JSON
        try:
            # 性能优化：直接返回字节流，避免 Python 层的 JSON 解析与二次序列化
            if stdout:
                size_mb = len(stdout) / (1024 * 1024)
                
                # 安全护栏：如果数据量巨大（超过 15MB）且用户关闭了折叠，
                # 浏览器必死无疑，此时应拒绝传输并提醒用户开启折叠。
                if size_mb > 15 and not data.get("fold_nodes", True):
                    return jsonify({
                        "success": False,
                        "error": "结果数据过大 ({:.1f}MB)，浏览器无法在‘未开启折叠’的情况下渲染。".format(size_mb),
                        "details": "检测到数百万级法术递归，请在右侧设置中开启‘合并完全一致的节点’后再进行评估。"
                    }), 400

                if size_mb > 20:
                    print(f"[Eval] Warning: Huge result detected ({size_mb:.1f} MB). Rendering in browser may be slow.")
                
                return app.response_class(
                    response=b'{"success":true,"data":' + stdout + b'}',
                    status=200,
                    mimetype='application/json'
                )
            else:
                return jsonify({"success": False, "error": "Empty output from evaluator"}), 500
        except Exception as je:
            print(f"[Eval] JSON parse error: {je}")
            # stdout 已经是字节流，需要解码才能打印
            raw_out = stdout.decode("utf-8", "replace") if stdout else "Empty"
            print(f"[Eval] Raw output: {raw_out}")
            return jsonify({
                "success": False, 
                "error": "Failed to parse evaluator output", 
                "raw": raw_out
            }), 500

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")

@app.route("/assets/<path:path>")
def send_assets(path):
    return send_from_directory(os.path.join(app.static_folder, "assets"), path)

if __name__ == "__main__":
    is_frozen = getattr(sys, 'frozen', False)
    
    # 启动前清理旧进程，防止端口占用导致无法连接游戏或逻辑错误
    kill_existing_instance()

    def open_browser():
        webbrowser.open_new("http://127.0.0.1:17471")

    # Only auto-open if frozen (packaged)
    if is_frozen and not os.environ.get("WERKZEUG_RUN_MAIN"):
        Timer(1.5, open_browser).start()

    # 打包模式下必须关闭 debug，否则 reloader 会导致打包后的 EXE 运行异常（循环启动）
    # 开发模式下保持 debug=True
    app.run(host="0.0.0.0", port=17471, debug=not is_frozen)
