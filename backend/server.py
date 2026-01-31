#!/usr/bin/env python3
import json
import sys
import socket
import os
import re
import io
import subprocess
import webbrowser
try:
    from pypinyin import pinyin, Style
    HAS_PYPINYIN = True
except ImportError:
    HAS_PYPINYIN = False
from threading import Timer
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
    WAND_EVAL_DIR = os.path.join(BASE_DIR, "wand_eval_tree-master")
    LUAJIT_PATH = os.path.join(BASE_DIR, "bin", "luajit.exe")
else:
    # 开发模式
    BASE_DIR = os.getcwd()
    EXTRACTED_DATA_ROOT = os.path.join(BASE_DIR, "noitadata")
    if not os.path.exists(EXTRACTED_DATA_ROOT):
        EXTRACTED_DATA_ROOT = r"E:\download\TheWebWandEngine\noitadata"
    
    FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "../frontend/dist")
    WAND_EVAL_DIR = os.path.join(BASE_DIR, "wand_eval_tree-master")
    # 开发模式优先尝试 bin 目录下的 luajit，否则用系统的
    local_luajit = os.path.join(BASE_DIR, "bin/luajit.exe")
    LUAJIT_PATH = local_luajit if os.path.exists(local_luajit) else "luajit"

# 预加载数据
_SPELL_CACHE = {}
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
        os.path.join(BASE_DIR, "2026-01-24 01-51-03.txt") # User provided translation file
    ]
    
    translations = {}
    for file_path in trans_files:
        if not os.path.exists(file_path):
            continue
        try:
            with open(file_path, "r", encoding="utf-8") as f:
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
        with open(actions_file, "r", encoding="utf-8") as f:
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
            sock.settimeout(10) # 增加超时时间，法术列表可能很大
            sock.connect((GAME_HOST, GAME_PORT))
            sock.sendall(cmd if isinstance(cmd, bytes) else (cmd + "\n").encode("utf-8"))
            
            chunks = []
            while True:
                chunk = sock.recv(16384)
                if not chunk: break
                chunks.append(chunk)
                if b"\n" in chunk: break
            
            resp = b"".join(chunks).decode("utf-8")
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
        return jsonify({"success": False, "error": "No Spell Lab data found"}), 404

    try:
        wands = []
        folders = []
        root_folder_id = "from_spell_lab"
        folders.append({
            "id": root_folder_id,
            "name": "来自 Spell Lab",
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
    db = load_spell_database()
    if db:
        return jsonify({"success": True, "spells": db})
    return jsonify({"success": False, "error": "Local data not found"}), 404

@app.route("/api/sync", methods=["POST"])
def sync_wand():
    data = request.get_json()
    talk_to_game(json.dumps(data))
    return jsonify({"success": True})

@app.route("/api/icon/<path:icon_path>")
def get_icon(icon_path):
    # 移除可能的开头斜杠，防止 os.path.join 在 Windows 上产生错误
    icon_path = icon_path.lstrip("/")
    
    # 优先从你提供的解压目录中查找
    local_path = os.path.join(EXTRACTED_DATA_ROOT, icon_path).replace("\\", "/")
    if os.path.exists(local_path):
        return send_file(local_path, max_age=31536000)
    
    # 备选：从游戏安装目录查找
    root = get_game_root()
    if root:
        path = os.path.join(root, icon_path).replace("\\", "/")
        if os.path.exists(path):
            return send_file(path, max_age=31536000)
            
    print(f"Icon not found: {icon_path}")
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
# WAND_EVAL_DIR = os.path.join(os.getcwd(), "wand_eval_tree-master")

@app.route("/api/evaluate", methods=["POST"])
def evaluate_wand():
    data = request.get_json()
    
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

    cmd = [
        LUAJIT_PATH, 
        "main.lua",
        "-dp", abs_data_path, 
        "-mp", abs_data_path,
        "-j",                    # 开启 JSON 输出
        "-sc", format_lua_arg(data.get("actions_per_round", 1)),
        "-ma", format_lua_arg(data.get("mana_max", 100)),
        "-mx", format_lua_arg(data.get("mana_max", 100)),
        "-mc", format_lua_arg(data.get("mana_charge_speed", 10)),
        "-rt", format_lua_arg(data.get("reload_time", 0)),
        "-cd", format_lua_arg(data.get("fire_rate_wait", 0)),
        "-nc", format_lua_arg(data.get("number_of_casts", 10)), # 默认模拟 10 轮
        "-u", "true" if data.get("unlimited_spells", True) else "false", # 无限法术天赋
        "-e", "true" if data.get("initial_if_half", True) else "false", # IF_HALF 初始状态
    ]

    # 是否折叠树节点
    if not data.get("fold_nodes", False):
        # wand_eval_tree 默认 fold=True，传入 -f 会将其切换为 False
        cmd.append("-f")

    # 环境模拟 (IF_HP, IF_ENEMY, IF_PROJECTILE)
    mock_lua = []
    if data.get("simulate_low_hp"):
        mock_lua.append("_TWWE_LOW_HP = true")
    if data.get("simulate_many_enemies"):
        mock_lua.append("_TWWE_MANY_ENEMIES = true")
    if data.get("simulate_many_projectiles"):
        mock_lua.append("_TWWE_MANY_PROJECTILES = true")
    
    if mock_lua:
        # 创建临时 Mod 来注入模拟逻辑
        # 必须写在 EXTRACTED_DATA_ROOT 目录下，因为 -mp 指向那里
        mod_base = os.path.join(EXTRACTED_DATA_ROOT, "mods", "twwe_mock")
        os.makedirs(mod_base, exist_ok=True)
        with open(os.path.join(mod_base, "init.lua"), "w", encoding="utf-8") as f:
            f.write("\n".join(mock_lua) + "\n")
            f.write("""
-- 覆盖环境检测函数以支持 IF_HP, IF_ENEMY, IF_PROJECTILE
local _old_EntityGetWithTag = EntityGetWithTag
function EntityGetWithTag(tag)
    if tag == "player_unit" and _TWWE_LOW_HP then return { 12345 } end
    return _old_EntityGetWithTag(tag)
end

local _old_GetUpdatedEntityID = GetUpdatedEntityID
function GetUpdatedEntityID()
    if _TWWE_LOW_HP or _TWWE_MANY_ENEMIES or _TWWE_MANY_PROJECTILES then return 12345 end
    return _old_GetUpdatedEntityID()
end

local _old_EntityGetFirstComponent = EntityGetFirstComponent
function EntityGetFirstComponent(ent, type, tag)
    if ent == 12345 and type == "DamageModelComponent" and _TWWE_LOW_HP then return 67890 end
    return _old_EntityGetFirstComponent(ent, type, tag)
end

local _old_ComponentGetValue2 = ComponentGetValue2
function ComponentGetValue2(comp, field)
    if comp == 67890 then
        if field == "hp" then return 0.1 end     -- 10% 血量
        if field == "max_hp" then return 1.0 end
    end
    return _old_ComponentGetValue2(comp, field)
end

local _old_EntityGetInRadiusWithTag = EntityGetInRadiusWithTag
function EntityGetInRadiusWithTag(x, y, radius, tag)
    if tag == "homing_target" and _TWWE_MANY_ENEMIES then
        -- 返回超过 15 个假实体以触发 IF_ENEMY
        local res = {}
        for i=1,20 do table.insert(res, i) end
        return res
    end
    if tag == "projectile" and _TWWE_MANY_PROJECTILES then
        -- 返回超过 20 个假实体以触发 IF_PROJECTILE
        local res = {}
        for i=1,30 do table.insert(res, i) end
        return res
    end
    return _old_EntityGetInRadiusWithTag(x, y, radius, tag)
end
            """)
        cmd.append("-md")
        cmd.append("twwe_mock")

    # 添加始终施法
    always_casts = data.get("always_cast", [])
    if always_casts:
        cmd.append("-ac")
        for ac in always_casts:
            if ac: cmd.append(str(ac))
    
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
        # 执行命令
        result = subprocess.run(
            cmd, 
            cwd=WAND_EVAL_DIR, 
            capture_output=True, 
            text=True, 
            encoding="utf-8",
            errors="replace" # 避免编码错误导致崩溃
        )
        
        if result.returncode != 0:
            print(f"[Eval] Failed with return code {result.returncode}")
            print(f"[Eval] Stderr: {result.stderr}")
            return jsonify({
                "success": False, 
                "error": "Evaluation failed", 
                "details": result.stderr
            }), 500
        
        # 解析返回的 JSON
        try:
            eval_data = json.loads(result.stdout)
            return jsonify({
                "success": True, 
                "data": eval_data
            })
        except json.JSONDecodeError as je:
            print(f"[Eval] JSON parse error: {je}")
            print(f"[Eval] Raw output: {result.stdout}")
            return jsonify({
                "success": False, 
                "error": "Failed to parse evaluator output", 
                "raw": result.stdout
            }), 500

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/")
def index():
    return send_file(os.path.join(FRONTEND_DIST, "index.html"))

@app.route("/assets/<path:path>")
def send_assets(path):
    dist_path = os.path.join(FRONTEND_DIST, "assets")
    return send_from_directory(dist_path, path)

if __name__ == "__main__":
    def open_browser():
        webbrowser.open_new("http://127.0.0.1:17471")

    # Only auto-open if frozen (packaged) or explicitly requested
    if getattr(sys, 'frozen', False):
        Timer(1.5, open_browser).start()

    app.run(host="0.0.0.0", port=17471, debug=True)
