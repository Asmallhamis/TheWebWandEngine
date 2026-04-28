"""
TWWE Backend — 魔杖评估路由
POST /api/evaluate — 构建命令行参数、管理进程、返回结果
"""
import json
import os
import re
import shutil
import subprocess
import time

from flask import Blueprint, Flask, request, jsonify

from config import (
    WAND_EVAL_DIR, EXTRACTED_DATA_ROOT, LUAJIT_PATH,
    active_processes, process_lock, mod_state,
)
from services.game_comm import talk_to_game, get_game_root
from services.lua_codegen import (
    build_environment_mock, process_mod_appends, write_init_lua,
)

evaluate_bp = Blueprint('evaluate', __name__)


def format_lua_arg(val):
    """处理 wand_eval_tree 的负数参数解析 bug"""
    try:
        f_val = float(val)
        if f_val < 0:
            return f".{f_val}"
        return str(val)
    except Exception:
        return str(val)


@evaluate_bp.route("/api/evaluate", methods=["POST"])
def evaluate_wand():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"success": False, "error": "Invalid JSON body"}), 400

    # 获取标识符，用于管理该插槽的进程
    tab_id = data.get("tab_id", "default")
    slot_id = data.get("slot_id", "1")
    proc_key = f"{tab_id}-{slot_id}"
    safe_proc_key = re.sub(r"[^A-Za-z0-9_-]+", "_", proc_key)[:64] or "default"
    mock_mod_id = f"twwe_mock_{safe_proc_key}_{int(time.time() * 1000)}"
    mock_mod_dir = os.path.join(WAND_EVAL_DIR, "mods", mock_mod_id)

    # 提取参数
    spells_data = data.get("spells", [])
    spell_uses = data.get("spell_uses", {})

    if not spells_data:
        return jsonify({"success": False, "error": "No spells to evaluate"})

    # 使用绝对路径并统一斜杠方向
    abs_data_path = EXTRACTED_DATA_ROOT.replace("\\", "/") + "/"
    game_root = get_game_root()
    if game_root:
        game_root = game_root.replace("\\", "/") + "/"
    else:
        game_root = abs_data_path

    # --- 构建命令行 ---
    cmd = [
        LUAJIT_PATH,
        "main.lua",
        "-dp", abs_data_path,
        "-mp", game_root,
        "-j",
        "-sc", format_lua_arg(data.get("actions_per_round", 1)),
        "-ma", format_lua_arg(data.get("mana_max", 100)),
        "-mx", format_lua_arg(data.get("mana_max", 100)),
        "-mc", format_lua_arg(data.get("mana_charge_speed", 10)),
        "-rt", format_lua_arg(data.get("reload_time", 0)),
        "-cd", format_lua_arg(data.get("fire_rate_wait", 0)),
        "-sm", format_lua_arg(data.get("speed_multiplier", 1.0)),
        "-sd", format_lua_arg(data.get("spread_degrees", 0.0)),
        "-nc", format_lua_arg(data.get("number_of_casts", 10)),
        "-u", "true" if data.get("unlimited_spells", True) else "false",
        "-e", "true" if data.get("initial_if_half", True) else "false",
    ]

    if data.get("stop_at_recharge"):
        cmd.extend(["-sr", "true"])

    always_casts = data.get("always_cast", [])
    if always_casts:
        cmd.append("-ac")
        cmd.extend([str(ac) for ac in always_casts if ac])

    perks = data.get("perks", [])
    if perks:
        cmd.append("-pk")
        cmd.extend([str(pk) for pk in perks if pk])

    evaluation_seed = data.get("evaluation_seed")
    if evaluation_seed is not None and evaluation_seed != "":
        cmd.extend(["-se", format_lua_arg(evaluation_seed)])

    if data.get("fold_nodes") == False:
        cmd.append("-f")

    # --- 生成 Lua mock 代码 ---
    mock_lua = build_environment_mock(data)

    # --- 处理 Mod Appends ---
    req_mod_appends = data.get("mod_appends")
    req_active_mods = data.get("active_mods")

    active_mods = []
    if req_active_mods is not None:
        active_mods = req_active_mods
    else:
        live_active_mods_res = talk_to_game("GET_ACTIVE_MODS")
        if live_active_mods_res:
            try:
                active_mods = json.loads(live_active_mods_res)
            except (json.JSONDecodeError, ValueError):
                pass

    if req_active_mods is None and not active_mods and mod_state["active_mods"]:
        active_mods = mod_state["active_mods"]

    appends_to_use = req_mod_appends if req_mod_appends is not None else mod_state["appends"]

    generated_vfs = process_mod_appends(data, mock_lua, appends_to_use, active_mods, mock_mod_id)

    # --- 写入 init.lua + VFS 代码 ---
    req_vfs = data.get("vfs")
    if mock_lua:
        write_init_lua(mock_lua, data, active_mods, req_vfs, generated_vfs, mock_mod_id)

        cmd.extend(["-md", mock_mod_id])

        # 补全其他 mod 以支持 VFS 搜索
        if isinstance(active_mods, list):
            for m in active_mods:
                if isinstance(m, str) and m not in cmd and m not in ["wand_sync", "appends", "spells", "active_mods"]:
                    cmd.append(m)
        elif isinstance(active_mods, dict):
            for m in active_mods.values():
                if isinstance(m, str) and m not in cmd and m not in ["wand_sync", "appends", "spells", "active_mods"]:
                    cmd.append(m)

    # --- 添加法术列表 ---
    cmd.append("-sp")
    spell_count = 0
    for i, s in enumerate(spells_data):
        if s:
            cmd.append(f"{i+1}:{s}")
            spell_count += 1
            slot_key = str(i + 1)
            if slot_key in spell_uses:
                cmd.append(str(spell_uses[slot_key]))

    if spell_count == 0:
        return jsonify({"success": False, "error": "No spells selected for evaluation"})

    print(f"[Eval] Executing in {WAND_EVAL_DIR}")
    print(f"[Eval] Command: {' '.join(cmd)}")

    # --- 执行 ---
    try:
        # 管理旧进程
        with process_lock:
            if proc_key in active_processes:
                try:
                    old_proc = active_processes[proc_key]
                    if old_proc.poll() is None:
                        print(f"[Eval] Terminating stale process for {proc_key}")
                        old_proc.terminate()
                except Exception as e:
                    print(f"[Eval] Error terminating process: {e}")
                del active_processes[proc_key]

        proc = subprocess.Popen(
            cmd,
            cwd=WAND_EVAL_DIR,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            shell=False,
        )

        with process_lock:
            active_processes[proc_key] = proc

        try:
            stdout, stderr = proc.communicate(timeout=60)
        except subprocess.TimeoutExpired:
            proc.kill()
            return jsonify({"success": False, "error": "Evaluation timeout"}), 504
        finally:
            with process_lock:
                if proc_key in active_processes and active_processes[proc_key] == proc:
                    del active_processes[proc_key]
            if os.path.isdir(mock_mod_dir):
                shutil.rmtree(mock_mod_dir, ignore_errors=True)

        if proc.returncode != 0:
            if proc.returncode < 0:
                return jsonify({"success": False, "error": "Cancelled"}), 200

            err_msg = stderr.decode("utf-8", "replace") if stderr else "Unknown error"
            print(f"[Eval] Failed with return code {proc.returncode}")
            print(f"[Eval] Lua Error: {err_msg}")
            return jsonify({
                "success": False,
                "error": "Evaluation failed",
                "details": err_msg,
            }), 500

        # 解析返回的 JSON
        try:
            if stdout:
                size_mb = len(stdout) / (1024 * 1024)

                if size_mb > 15 and not data.get("fold_nodes", True):
                    return jsonify({
                        "success": False,
                        "error": "结果数据过大 ({:.1f}MB)，浏览器无法在'未开启折叠'的情况下渲染。".format(size_mb),
                        "details": "检测到数百万级法术递归，请在右侧设置中开启'合并完全一致的节点'后再进行评估。",
                    }), 400

                if size_mb > 20:
                    print(f"[Eval] Warning: Huge result detected ({size_mb:.1f} MB).")

                from flask import current_app
                return current_app.response_class(
                    response=b'{"success":true,"data":' + stdout + b'}',
                    status=200,
                    mimetype='application/json',
                )
            else:
                return jsonify({"success": False, "error": "Empty output from evaluator"}), 500
        except Exception as je:
            print(f"[Eval] JSON parse error: {je}")
            raw_out = stdout.decode("utf-8", "replace") if stdout else "Empty"
            print(f"[Eval] Raw output: {raw_out}")
            return jsonify({
                "success": False,
                "error": "Failed to parse evaluator output",
                "raw": raw_out,
            }), 500

    except Exception as e:
        import traceback
        traceback.print_exc()
        if os.path.isdir(mock_mod_dir):
            shutil.rmtree(mock_mod_dir, ignore_errors=True)
        return jsonify({"success": False, "error": str(e)}), 500
