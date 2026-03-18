"""
TWWE Backend — 游戏同步与法术数据路由
/api/status, /api/sync, /api/pull, /api/sync-game-spells, /api/fetch-*
"""
import json

from flask import Blueprint, request, jsonify

from config import mod_state
from services.game_comm import talk_to_game, get_game_root
from spell_db import load_spell_database, get_pinyin_data
from utils import set_active_mods

sync_bp = Blueprint('sync', __name__)


@sync_bp.route("/api/status")
def status():
    test_res = talk_to_game("PING")
    is_live = test_res is not None
    return jsonify({
        "connected": is_live,
        "game_root": get_game_root()
    })


@sync_bp.route("/api/pull")
def pull_game_wands():
    res = talk_to_game("GET_ALL_WANDS")
    if not res:
        return jsonify({"success": False, "error": "Could not connect to game"}), 503
    try:
        return jsonify({"success": True, "wands": json.loads(res)})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@sync_bp.route("/api/sync", methods=["POST"])
def sync_wand():
    data = request.get_json()
    talk_to_game(json.dumps(data))
    return jsonify({"success": True})


@sync_bp.route("/api/fetch-spells")
def fetch_spells():
    db = load_spell_database().copy()
    if mod_state["spells"]:
        db.update(mod_state["spells"])
    if db:
        return jsonify({"success": True, "spells": db})
    return jsonify({"success": False, "error": "Local data not found"}), 404


@sync_bp.route("/api/fetch-spells-base")
def fetch_spells_base():
    db = load_spell_database().copy()
    if db:
        return jsonify({"success": True, "spells": db})
    return jsonify({"success": False, "error": "Local data not found"}), 404


@sync_bp.route("/api/fetch-mod-data")
def fetch_mod_data():
    return jsonify({
        "success": True,
        "spells": mod_state["spells"],
        "appends": mod_state["appends"],
        "active_mods": mod_state["active_mods"],
    })


@sync_bp.route("/api/sync-game-spells")
def sync_game_spells():
    res = talk_to_game("GET_ALL_SPELLS")
    if not res:
        return jsonify({"success": False, "error": "Could not connect to game"}), 503

    try:
        data = json.loads(res)
        # 兼容处理：Noita 有时直接返回法术列表，有时返回包含 spells/appends 的字典
        if isinstance(data, list):
            spells = data
            mod_state["appends"] = {}
            mod_state["active_mods"] = []
        else:
            spells = data.get("spells", [])
            mod_state["appends"] = data.get("appends", {})
            mod_state["active_mods"] = data.get("active_mods", [])
        set_active_mods(mod_state["active_mods"])

        static_db = load_spell_database()
        mod_db = {}
        for s in spells:
            if not isinstance(s, dict):
                continue
            spell_id = s.get("id")
            if not spell_id:
                continue

            name = s.get("name", spell_id)
            py_full, py_init = get_pinyin_data(name)

            aliases = ""
            alias_py = ""
            alias_init = ""
            if spell_id in static_db:
                entry = static_db[spell_id]
                if isinstance(entry, dict):
                    aliases = entry.get("aliases", "")
                    alias_py = entry.get("alias_pinyin", "")
                    alias_init = entry.get("alias_initials", "")

            mod_entry = {
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
                "is_mod": True,
            }
            mod_id = s.get("mod_id")
            if mod_id:
                mod_entry["mod_id"] = mod_id

            mod_db[spell_id] = mod_entry

        mod_state["spells"] = mod_db
        return jsonify({"success": True, "count": len(mod_db)})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500
