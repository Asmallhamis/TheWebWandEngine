"""
TWWE Backend — 游戏同步与法术数据路由
/api/status, /api/sync, /api/pull, /api/sync-game-spells, /api/fetch-*
"""
import json
import time

from flask import Blueprint, request, jsonify

from config import mod_state, realtime_sync_state, SYNC_LEASE_TIMEOUT_SECONDS, process_lock
from services.game_comm import talk_to_game, get_game_root
from spell_db import load_spell_database, get_pinyin_data
from utils import set_active_mods

sync_bp = Blueprint('sync', __name__)


def _build_realtime_owner_status_locked(now, client_id=None):
    owner = realtime_sync_state.get("owner_client_id")
    last_seen = realtime_sync_state.get("last_seen", 0.0)
    remaining = max(0.0, SYNC_LEASE_TIMEOUT_SECONDS - max(0.0, now - last_seen)) if owner else 0.0
    return {
        "owner_client_id": owner,
        "owner_tab_id": realtime_sync_state.get("owner_tab_id"),
        "owned": bool(owner and client_id and owner == client_id),
        "has_owner": bool(owner),
        "expires_in_ms": int(remaining * 1000),
    }


def _cleanup_realtime_owner_locked(now=None):
    now = now if now is not None else time.time()
    owner = realtime_sync_state.get("owner_client_id")
    last_seen = realtime_sync_state.get("last_seen", 0.0)
    if owner and now - last_seen > SYNC_LEASE_TIMEOUT_SECONDS:
        _clear_realtime_owner_locked()


def _clear_realtime_owner_locked():
    realtime_sync_state["owner_client_id"] = None
    realtime_sync_state["owner_tab_id"] = None
    realtime_sync_state["last_seen"] = 0.0


def _get_realtime_owner_status(client_id=None):
    now = time.time()
    with process_lock:
        _cleanup_realtime_owner_locked(now)
        return _build_realtime_owner_status_locked(now, client_id)


def _claim_realtime_owner(client_id, tab_id=None):
    now = time.time()
    with process_lock:
        _cleanup_realtime_owner_locked(now)
        current_owner = realtime_sync_state.get("owner_client_id")
        if current_owner in (None, client_id):
            realtime_sync_state["owner_client_id"] = client_id
            realtime_sync_state["owner_tab_id"] = tab_id
            realtime_sync_state["last_seen"] = now
        return _build_realtime_owner_status_locked(now, client_id)


def _release_realtime_owner(client_id):
    now = time.time()
    with process_lock:
        _cleanup_realtime_owner_locked(now)
        if realtime_sync_state.get("owner_client_id") == client_id:
            _clear_realtime_owner_locked()
        return _build_realtime_owner_status_locked(now, client_id)


def _heartbeat_realtime_owner(client_id):
    now = time.time()
    with process_lock:
        _cleanup_realtime_owner_locked(now)
        if realtime_sync_state.get("owner_client_id") == client_id:
            realtime_sync_state["last_seen"] = now
        return _build_realtime_owner_status_locked(now, client_id)


def _reject_if_not_realtime_owner(client_id):
    now = time.time()
    with process_lock:
        _cleanup_realtime_owner_locked(now)
        status = _build_realtime_owner_status_locked(now, client_id)
        if status["has_owner"] and not status["owned"]:
            return jsonify({
                "success": False,
                "error": "Realtime sync is controlled by another client",
                **status,
            }), 409
    return None


def _parse_request_json():
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


def _get_request_client_id():
    data = _parse_request_json()
    client_id = data.get("client_id") or request.args.get("client_id")
    return client_id, data


@sync_bp.route("/api/status")
def status():
    test_res = talk_to_game("PING")
    is_live = test_res is not None
    client_id = request.args.get("client_id")
    return jsonify({
        "connected": is_live,
        "game_root": get_game_root(),
        **_get_realtime_owner_status(client_id),
    })


@sync_bp.route("/api/pull")
def pull_game_wands():
    client_id = request.args.get("client_id")
    if client_id:
        rejection = _reject_if_not_realtime_owner(client_id)
        if rejection:
            return rejection

    print(f"[sync.pull] request client_id={client_id or '-'}")

    res = talk_to_game("GET_ALL_WANDS")
    if not res:
        return jsonify({"success": False, "error": "Could not connect to game"}), 503

    try:
        payload = json.loads(res)
        if isinstance(payload, dict) and "wands" in payload:
            wand_count = len(payload.get("wands") or {})
            return jsonify({
                "success": True,
                "wands": payload.get("wands") or {},
                "stable": bool(payload.get("stable", True)),
                "paused": bool(payload.get("paused", False)),
                "frame": payload.get("frame"),
                "warmup_until": payload.get("warmup_until"),
                "debug_source": "mod_status_payload",
            })

        wand_count = len(payload or {}) if isinstance(payload, dict) else -1
        print(f"[sync.pull] legacy payload stable=True paused=False wands={wand_count}")
        return jsonify({"success": True, "wands": payload, "stable": True, "paused": False, "debug_source": "legacy_payload"})

        
    except Exception as e:
        print(f"[sync.pull] parse error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500



@sync_bp.route("/api/sync", methods=["POST"])
def sync_wand():
    client_id, data = _get_request_client_id()
    if client_id:
        rejection = _reject_if_not_realtime_owner(client_id)
        if rejection:
            return rejection

    talk_to_game(json.dumps(data))
    return jsonify({"success": True})


@sync_bp.route("/api/sync/claim", methods=["POST"])
def claim_realtime_sync():
    data = _parse_request_json()
    client_id = data.get("client_id")
    tab_id = data.get("tab_id")
    if not client_id:
        return jsonify({"success": False, "error": "client_id is required"}), 400

    status = _claim_realtime_owner(client_id, tab_id)
    return jsonify({"success": True, **status})


@sync_bp.route("/api/sync/release", methods=["POST"])
def release_realtime_sync():
    data = _parse_request_json()
    client_id = data.get("client_id")
    if not client_id:
        return jsonify({"success": False, "error": "client_id is required"}), 400

    return jsonify({"success": True, **_release_realtime_owner(client_id)})


@sync_bp.route("/api/sync/owner")
def get_realtime_sync_owner():
    client_id = request.args.get("client_id")
    return jsonify({"success": True, **_get_realtime_owner_status(client_id)})


@sync_bp.route("/api/sync/heartbeat", methods=["POST"])
def heartbeat_realtime_sync():
    data = _parse_request_json()
    client_id = data.get("client_id")
    if not client_id:
        return jsonify({"success": False, "error": "client_id is required"}), 400

    status = _heartbeat_realtime_owner(client_id)
    return jsonify({"success": True, **status})


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
