"""
TWWE Backend — Lua Mock 代码生成服务
生成环境模拟 Lua：Entity mock 函数、VFS 注入、占位符修复
"""
import os
import json

from config import WAND_EVAL_DIR


def build_environment_mock(data):
    """
    生成 Noita 环境模拟 Lua 代码块。
    处理 IF_HP, IF_ENEMY, IF_PROJECTILE 等条件的 mock。

    返回: list[str] — Lua 代码行
    """
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
        "function EntityGetIsAlive(ent) return true end",
    ]

    if data.get("simulate_low_hp"):
        mock_lua.insert(0, "_TWWE_LOW_HP = true")
    if data.get("simulate_many_enemies"):
        mock_lua.insert(0, "_TWWE_MANY_ENEMIES = true")
    if data.get("simulate_many_projectiles"):
        mock_lua.insert(0, "_TWWE_MANY_PROJECTILES = true")

    return mock_lua


def build_placeholder_fix_lua(active_mods, req_vfs, generated_vfs):
    """
    生成 VFS 初始化和占位符修复 Lua 代码块。

    返回: list[str] — Lua 代码行
    """
    # Extract all mod IDs for the Lua-side fix
    mods_list = []
    if isinstance(active_mods, list):
        mods_list = active_mods
    elif isinstance(active_mods, dict):
        try:
            keys = sorted(active_mods.keys(), key=lambda x: int(x))
            mods_list = [active_mods[k] for k in keys]
        except Exception:
            mods_list = list(active_mods.values())

    all_mod_ids_lua = "{" + ", ".join([f'"{m}"' for m in mods_list if isinstance(m, str)]) + "}"

    lines = [
        "\n-- TWWE VFS Initialization",
        "local _TWWE_VFS = {}",
    ]

    # 如果请求中带有 VFS 数据（环境包模式），则注入到 Lua 环境中
    if req_vfs:
        combined_vfs = dict(req_vfs)
        combined_vfs.update(generated_vfs)
        for vfs_path, vfs_content in combined_vfs.items():
            safe_vfs_content = (
                vfs_content
                .replace("\\", "\\\\")
                .replace('"', '\\"')
                .replace("\n", "\\n")
                .replace("\r", "\\r")
            )
            lines.append(f'_TWWE_VFS["{vfs_path}"] = "{safe_vfs_content}"')

    lines.extend([
        "\n-- TWWE Placeholder Fixer",
        f"local _TWWE_ACTIVE_MODS = {all_mod_ids_lua}",
        """
-- 将 VFS 数据同步到 fake_engine 的 M.vfs 中（如果存在）
local _old_MTFGC = ModTextFileGetContent
function ModTextFileGetContent(filename)
    if not filename then return nil end
    local actual_filename = filename
    
    -- 1. 修复文件名中的占位符 (支持 dofile("__MOD_ACTIONS__..."))
    if actual_filename:find("__MOD_") or actual_filename:find("___") then
        for _, mid in ipairs(_TWWE_ACTIVE_MODS) do
            if type(mid) ~= "string" then goto continue end
            local mp = "mods/" .. mid .. "/"
            local test_name = actual_filename:gsub("___", mid .. "_")
            test_name = test_name:gsub("__MOD_NAME__", mid)
            test_name = test_name:gsub("__MOD_FILES__", mp .. "files/")
            test_name = test_name:gsub("__MOD_ACTIONS__", mp .. "files/actions/")
            test_name = test_name:gsub("__MOD_LIBS__", mp .. "libs/")
            test_name = test_name:gsub("__MOD_ACTION_UTILS__", mp .. "files/action_utils/")
            
            if _TWWE_VFS[test_name] or _old_MTFGC(test_name) then
                actual_filename = test_name
                break
            end
            ::continue::
        end
    end

    local content = _TWWE_VFS[actual_filename]
    if not content then content = _old_MTFGC(actual_filename) end
    if not content or type(content) ~= "string" then return content end

    -- 2. 修复内容中的占位符
    local mod_id = nil
    if actual_filename:sub(1, 5) == "mods/" then
        local next_slash = actual_filename:find("/", 6)
        if next_slash then mod_id = actual_filename:sub(6, next_slash - 1) end
    end
    
    -- 兜底推断: 如果文件名仍含占位符或在 mod 目录下
    if not mod_id then mod_id = _TWWE_ACTIVE_MODS[1] end

    if mod_id and not actual_filename:find("twwe_mock") then
        local prefix = mod_id .. "_"
        local mp = "mods/" .. mod_id .. "/"
        content = content:gsub("___", prefix)
        content = content:gsub("__MOD_NAME__", mod_id)
        content = content:gsub("__MOD_FILES__", mp .. "files/")
        content = content:gsub("__MOD_ACTIONS__", mp .. "files/actions/")
        content = content:gsub("__MOD_LIBS__", mp .. "libs/")
        content = content:gsub("__MOD_ACTION_UTILS__", mp .. "files/action_utils/")
    end
    
    return content
end

function ModDoesFileExist(filename)
    local c = ModTextFileGetContent(filename)
    return c ~= nil and c ~= ""
end

local _TWWE_WRITTEN_FILES_OWNER = {}
local _old_MTFSC = ModTextFileSetContent
function ModTextFileSetContent(filename, content)
    if debug then
        local info = debug.getinfo(2, "S")
        if info and info.source and info.source:sub(1, 6) == "@mods/" then
            local mid = info.source:match("@mods/([^/]+)/")
            if mid then _TWWE_WRITTEN_FILES_OWNER[filename] = mid end
        end
    end
    if _old_MTFSC then return _old_MTFSC(filename, content) end
end

function ModTextFileWhoSetContent(filename)
    return _TWWE_WRITTEN_FILES_OWNER[filename] or _TWWE_ACTIVE_MODS[1] or ""
end

-- 故障诊断：当找不到法术时 dump 所有已注册 ID
local _old_error = error
function error(msg, level)
    if type(msg) == "string" and msg:find("Unknown spell") then
        print("\\n[TWWE-Debug] Registered Action IDs:")
        if actions then for _, a in ipairs(actions) do print("  " .. tostring(a.id)) end end
    end
    return _old_error(msg, level)
end
""",
    ])

    return lines


def process_mod_appends(data, mock_lua, appends_to_use, active_mods, mock_mod_id="twwe_mock"):
    """
    处理 Mod appends: 生成 gen_x.lua 文件，添加 ModLuaFileAppend 调用。

    返回: generated_vfs (dict) — 生成的虚拟文件内容
    """
    generated_vfs = {}
    if not appends_to_use:
        return generated_vfs

    mock_mod_dir = os.path.join(WAND_EVAL_DIR, "mods", mock_mod_id)
    os.makedirs(mock_mod_dir, exist_ok=True)

    for i, (path, content) in enumerate(appends_to_use.items()):
        file_name = f"gen_{i}.lua"

        # Python-side placeholder pre-processing for mods like The-Focus
        if "___" in content or "__MOD_" in content:
            mod_id = None
            parts = path.split("/")
            if len(parts) > 1 and parts[0] == "mods":
                mod_id = parts[1]

            if not mod_id and active_mods:
                first_mod = active_mods[0] if isinstance(active_mods, list) else next(iter(active_mods.values()), None)
                mod_id = first_mod

            if mod_id:
                mp = f"mods/{mod_id}/"
                content = content.replace("___", f"{mod_id}_")
                content = content.replace("__MOD_NAME__", mod_id)
                content = content.replace("__MOD_FILES__", f"{mp}files/")
                content = content.replace("__MOD_ACTIONS__", f"{mp}files/actions/")
                content = content.replace("__MOD_LIBS__", f"{mp}libs/")
                content = content.replace("__MOD_ACTION_UTILS__", f"{mp}files/action_utils/")

        file_path = os.path.join(mock_mod_dir, file_name)
        mock_lua.append(f'ModLuaFileAppend("data/scripts/gun/gun_actions.lua", "mods/{mock_mod_id}/{file_name}")')
        generated_vfs[f"mods/{mock_mod_id}/{file_name}"] = content

        with open(file_path, "w", encoding="utf-8", errors="replace") as f:
            f.write(content)

    return generated_vfs


def write_init_lua(mock_lua, data, active_mods, req_vfs, generated_vfs, mock_mod_id="twwe_mock"):
    """
    将完整的 mock Lua 代码写入 mods/twwe_mock/init.lua

    返回: 无
    """
    if not mock_lua:
        return

    mock_mod_dir = os.path.join(WAND_EVAL_DIR, "mods", mock_mod_id)
    os.makedirs(mock_mod_dir, exist_ok=True)

    init_path = os.path.join(mock_mod_dir, "init.lua")
    init_content = "\n".join(mock_lua) + "\n"

    # 缓存检查：仅在内容变化时写入
    write_init = True
    try:
        if os.path.exists(init_path):
            with open(init_path, "r", encoding="utf-8", errors="ignore") as f:
                if f.read() == init_content:
                    write_init = False
    except Exception:
        pass

    if write_init:
        with open(init_path, "w", encoding="utf-8") as f:
            f.write(init_content)

    # 追加 VFS + 占位符修复代码
    if req_vfs:
        mock_lua.insert(0, "_TWWE_VFS_ONLY = true")

    placeholder_fix_lua = build_placeholder_fix_lua(active_mods, req_vfs, generated_vfs)

    with open(init_path, "a", encoding="utf-8") as f:
        f.write("\n".join(placeholder_fix_lua))
