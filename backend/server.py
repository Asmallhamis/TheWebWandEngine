#!/usr/bin/env python3
import json
import sys
import socket
import os
import re
import io
import subprocess
import webbrowser
from threading import Timer
from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

GAME_HOST = "127.0.0.1"
GAME_PORT = 12345
_GAME_ROOT = None

# 自动检测打包环境与路径配置
if getattr(sys, 'frozen', False):
    # PyInstaller 运行模式：从临时解压目录读取 (嵌入数据)
    BASE_DIR = sys._MEIPASS
    EXTRACTED_DATA_ROOT = os.path.join(BASE_DIR, "noitadata_internal")
    FRONTEND_DIST = os.path.join(BASE_DIR, "frontend", "dist")
    WAND_EVAL_DIR = os.path.join(BASE_DIR, "wand_eval_tree-master")
    LUAJIT_PATH = os.path.join(BASE_DIR, "luajit.exe")
else:
    # 开发模式
    BASE_DIR = os.getcwd()
    # 优先使用项目根目录下的 noitadata，否则尝试从环境变量获取，最后使用默认相对路径
    EXTRACTED_DATA_ROOT = os.getenv("NOITA_DATA_PATH", os.path.join(BASE_DIR, "noitadata"))
    
    if not os.path.exists(EXTRACTED_DATA_ROOT):
        # 如果都不存在，可以在此处打印警告，而不是硬编码个人路径
        print(f"Warning: Noita data not found at {EXTRACTED_DATA_ROOT}. Please check your configuration.")
    
    FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "../frontend/dist")
    WAND_EVAL_DIR = os.path.join(BASE_DIR, "wand_eval_tree-master")
    # 开发模式优先尝试 bin 目录下的 luajit，否则用系统的
    local_luajit = os.path.join(BASE_DIR, "bin/luajit.exe")
    LUAJIT_PATH = local_luajit if os.path.exists(local_luajit) else "luajit"

# 预加载法术数据库
_SPELL_CACHE = {}

def load_spell_database():
    global _SPELL_CACHE
    if _SPELL_CACHE: return _SPELL_CACHE
    
    actions_file = os.path.join(EXTRACTED_DATA_ROOT, "data/scripts/gun/gun_actions.lua")
    if not os.path.exists(actions_file):
        print(f"Warning: gun_actions.lua not found at {actions_file}")
        return {}

    try:
        with open(actions_file, "r", encoding="utf-8") as f:
            content = f.read()
        
        # 1. 剥离 Lua 注释
        # 剥离多行注释 --[[ ... ]]
        content = re.sub(r'--\[\[.*?\]\]', '', content, flags=re.DOTALL)
        # 剥离单行注释 -- ...
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
        # 我们寻找以 { id = "..." 开始，并包含 price = ... (通常所有合法法术都有价格) 的结构
        # 使用更精确的正则匹配法术定义块
        action_blocks = re.findall(r'\{\s*(id\s*=\s*"[^"]+".*?price\s*=\s*\d+.*?)\s*\},', content, re.DOTALL)
        
        db = {}
        for block in action_blocks:
            id_match = re.search(r'id\s*=\s*"([^"]+)"', block)
            sprite_match = re.search(r'sprite\s*=\s*"([^"]+)"', block)
            type_match = re.search(r'type\s*=\s*([A-Z0-9_]+)', block)
            uses_match = re.search(r'max_uses\s*=\s*(-?\d+)', block)
            
            if id_match and sprite_match:
                spell_id = id_match.group(1)
                type_str = type_match.group(1) if type_match else "ACTION_TYPE_PROJECTILE"
                db[spell_id] = {
                    "icon": sprite_match.group(1).lstrip("/"),
                    "name": spell_id,
                    "type": TYPE_MAP.get(type_str, 0),
                    "max_uses": int(uses_match.group(1)) if uses_match else None
                }
        _SPELL_CACHE = db
        print(f"Loaded {len(db)} clean spells from local data")
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

@app.route("/api/pull", methods=["GET"])
def pull_wands():
    res = talk_to_game("GET_ALL_WANDS")
    if res: return jsonify({"success": True, "wands": json.loads(res)})
    return jsonify({"success": False, "error": "offline"}), 503

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

# 路径配置
WAND_EVAL_DIR = os.path.join(os.getcwd(), "wand_eval_tree-master")

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

    # 计算相对路径，确保 Lua 引擎能找到嵌入的数据
    data_rel_path = os.path.relpath(EXTRACTED_DATA_ROOT, WAND_EVAL_DIR).replace("\\", "/") + "/"

    cmd = [
        LUAJIT_PATH, "main.lua",
        "-dp", data_rel_path, 
        "-mp", data_rel_path,
        "-j",                    # 开启 JSON 输出
        "-sc", format_lua_arg(data.get("actions_per_round", 1)),
        "-ma", format_lua_arg(data.get("mana_max", 100)),
        "-mx", format_lua_arg(data.get("mana_max", 100)),
        "-mc", format_lua_arg(data.get("mana_charge_speed", 10)),
        "-rt", format_lua_arg(data.get("reload_time", 0)),
        "-cd", format_lua_arg(data.get("fire_rate_wait", 0)),
        "-nc", format_lua_arg(data.get("number_of_casts", 10)), # 默认模拟 10 轮
        "-u", "true" if data.get("unlimited_spells", True) else "false", # 无限法术天赋
    ]
    
    # 添加法术列表
    cmd.append("-sp")
    for i, s in enumerate(spells_data):
        if s: 
            cmd.append(str(s))
            slot_key = str(i + 1)
            if slot_key in spell_uses:
                cmd.append(str(spell_uses[slot_key]))

    try:
        # 执行命令
        result = subprocess.run(
            cmd, 
            cwd=WAND_EVAL_DIR, 
            capture_output=True, 
            text=True, 
            encoding="utf-8",
            shell=True # Windows 下运行 luajit 可能需要
        )
        
        if result.returncode != 0:
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
        except json.JSONDecodeError:
            return jsonify({
                "success": False, 
                "error": "Failed to parse evaluator output", 
                "raw": result.stdout
            }), 500

    except Exception as e:
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
