"""
TWWE Backend — 导入/导出路由
/api/import/wand-editor, /api/import/spell-lab, /api/export-mod-bundle, /api/bones
"""
import os
import time
import json
import sys

from flask import Blueprint, request, jsonify

from config import mod_state
from services.game_comm import (
    talk_to_game, get_noita_save_path, read_noita_mod_settings, run_lua_helper
)
from spell_db import load_spell_database, get_pinyin_data
from bones_manager import BonesManager
from mod_bundler import ModBundler

import_export_bp = Blueprint('import_export', __name__)


def get_bones_manager():
    save_path = get_noita_save_path()
    if save_path:
        return BonesManager(save_path)
    return None


@import_export_bp.route("/api/import/wand-editor")
def import_wand_editor():
    # Try live game first
    live_data = talk_to_game("GET_WAND_EDITOR_DATA")
    pages_raw = []
    if live_data:
        try:
            pages_raw = json.loads(live_data)
        except (json.JSONDecodeError, ValueError):
            pass

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
            if not page_data:
                continue

            page_folder_id = f"{root_folder_id}_page_{page_idx + 1}"
            folders.append({
                "id": page_folder_id,
                "name": f"第 {page_idx + 1} 页",
                "order": page_idx,
                "isOpen": False,
                "parentId": root_folder_id
            })

            for wand_idx, w in enumerate(page_data):
                if not w or not isinstance(w, dict):
                    continue

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


@import_export_bp.route("/api/import/spell-lab")
def import_spell_lab():
    # Try live game first
    live_data_raw = talk_to_game("GET_SPELL_LAB_DATA")
    all_wands_data = []

    if live_data_raw:
        try:
            live_data = json.loads(live_data_raw)
            for page_str in live_data.get("shugged", []):
                res = run_lua_helper("spell-lab", page_str)
                if res:
                    all_wands_data.extend(res)
            orig_str = live_data.get("original")
            if orig_str:
                res = run_lua_helper("spell-lab", orig_str)
                if res:
                    all_wands_data.extend(res)
        except (json.JSONDecodeError, ValueError):
            pass

    # Fallback to XML
    if not all_wands_data:
        settings = read_noita_mod_settings()
        max_index = settings.get("spell_lab_shugged.wand_box_page_max_index")
        if max_index:
            for i in range(1, int(max_index) + 1):
                page_str = settings.get(f"spell_lab_shugged.wand_box_page_{i}")
                if page_str:
                    res = run_lua_helper("spell-lab", page_str)
                    if res:
                        all_wands_data.extend(res)
        original_data = settings.get("spell_lab_saved_wands")
        if original_data:
            res = run_lua_helper("spell-lab", original_data)
            if res:
                all_wands_data.extend(res)

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
            if not w or not isinstance(w, dict):
                continue

            stats = w.get("stats", {})
            actions = w.get("all_actions", [])
            spells = {}
            spell_uses = {}
            always_cast = []

            for a in actions:
                aid = a.get("action_id")
                if not aid:
                    continue
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


@import_export_bp.route("/api/export-mod-bundle")
def export_mod_bundle():
    """导出当前加载的 Mod 环境包 (支持递归追踪 dofile 依赖)"""
    if not mod_state["spells"]:
        return jsonify({"success": False, "error": "No mod spells loaded. Please sync with game first."}), 400

    bundler = ModBundler(mod_state["active_mods"])

    for mod_id in mod_state["active_mods"]:
        bundler.bundle_mod_directory(mod_id)

    for path, content in mod_state["appends"].items():
        mod_id = None
        parts = path.split("/")
        if len(parts) > 1 and parts[0] == "mods":
            mod_id = parts[1]

        deps = bundler.scan_lua_for_paths(content, mod_id)
        for dep in deps:
            bundler.bundle_file(dep, mod_id)

    bundle_spells = bundler.collect_icons(mod_state["spells"].copy())

    return jsonify({
        "success": True,
        "spells": bundle_spells,
        "appends": mod_state["appends"],
        "active_mods": mod_state["active_mods"],
        "vfs": bundler.vfs,
        "vfs_meta": bundler.vfs_meta
    })


@import_export_bp.route("/api/bones")
def pull_bones():
    manager = get_bones_manager()
    if not manager:
        return jsonify({"success": False, "error": "Save path not found"}), 404

    wands = manager.pull_bones(load_spell_database)
    return jsonify({"success": True, "wands": wands})


@import_export_bp.route("/api/bones", methods=["POST"])
def push_bones():
    manager = get_bones_manager()
    if not manager:
        return jsonify({"success": False, "error": "Save path not found"}), 404

    data = request.get_json()
    wands = data.get("wands", [])

    full_db = load_spell_database().copy()
    if mod_state["spells"]:
        full_db.update(mod_state["spells"])

    count = manager.push_bones(wands, full_db)
    return jsonify({"success": True, "count": count})
