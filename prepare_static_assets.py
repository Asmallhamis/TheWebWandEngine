import os
import re
import json
import csv
import shutil
from pathlib import Path

# --- 配置 ---
# 请根据实际情况修改这个路径，或者脚本会自动尝试检测
NOITA_DATA_PATH = os.environ.get("NOITA_DATA_PATH", r"./noitadata")
FRONTEND_PUBLIC = Path("frontend/public/static_data")
WAND_EVAL_SRC = Path("wand_eval_tree")

def get_pinyin(text):
    try:
        from pypinyin import pinyin, Style
        full = "".join([item[0] for item in pinyin(text, style=Style.NORMAL)])
        initials = "".join([item[0] for item in pinyin(text, style=Style.FIRST_LETTER)])
        return full.lower(), initials.lower()
    except ImportError:
        return "", ""

def load_translations(data_path):
    trans = {}
    csv_path = Path(data_path) / "data/translations/common.csv"
    if not csv_path.exists():
        print(f"警告: 未找到翻译文件 {csv_path}")
        return trans

    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        header = next(reader, None)
        if not header: return trans
        
        en_idx, zh_idx = 1, 9
        for i, h in enumerate(header):
            h_lower = h.lower()
            if h_lower == 'en': en_idx = i
            elif h_lower == 'zh-cn': zh_idx = i
            elif 'zh-cn汉化mod' in h_lower: zh_idx = i
        
        for row in reader:
            if not row or len(row) < 2: continue
            key = row[0].lstrip('$')
            en_val = row[en_idx] if len(row) > en_idx else ""
            zh_val = row[zh_idx] if len(row) > zh_idx else ""
            trans[key] = {
                "en": en_val.replace('\\n', '\n').strip('"'),
                "zh": zh_val.replace('\\n', '\n').strip('"')
            }
    return trans

def load_spell_mapping():
    mapping_path = Path("spell_mapping.md")
    if not mapping_path.exists():
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

def prepare_assets():
    print(f"开始准备静态资源，使用数据源: {NOITA_DATA_PATH}")
    
    if not os.path.exists(NOITA_DATA_PATH):
        print(f"错误: 找不到 Noita 数据目录: {NOITA_DATA_PATH}")
        return

    # 1. 创建输出目录并清理旧资源
    if FRONTEND_PUBLIC.exists():
        print("清理旧资源...")
        shutil.rmtree(FRONTEND_PUBLIC)
    
    icon_dir = FRONTEND_PUBLIC / "icons"
    lua_dir = FRONTEND_PUBLIC / "lua"
    icon_dir.mkdir(parents=True, exist_ok=True)
    lua_dir.mkdir(parents=True, exist_ok=True)

    trans = load_translations(NOITA_DATA_PATH)
    mapping = load_spell_mapping()
    
    # 2. 提取法术图标和数据
    print("正在提取法术数据...")
    actions_file = Path(NOITA_DATA_PATH) / "data/scripts/gun/gun_actions.lua"
    if not actions_file.exists():
        print(f"错误: 找不到 {actions_file}")
        return

    with open(actions_file, "r", encoding="utf-8") as f:
        content = f.read()
    
    content = re.sub(r'--\[\[.*?\]\]', '', content, flags=re.DOTALL)
    content = re.sub(r'--.*', '', content)

    TYPE_MAP = {
        "ACTION_TYPE_PROJECTILE": 0, "ACTION_TYPE_STATIC_PROJECTILE": 1,
        "ACTION_TYPE_MODIFIER": 2, "ACTION_TYPE_DRAW_MANY": 3,
        "ACTION_TYPE_MATERIAL": 4, "ACTION_TYPE_OTHER": 5,
        "ACTION_TYPE_UTILITY": 6, "ACTION_TYPE_PASSIVE": 7
    }

    action_blocks = re.findall(r'\{\s*(id\s*=\s*"[^"]+".*?price\s*=\s*\d+.*?)\s*\},', content, re.DOTALL)
    
    spell_db = {}
    for block in action_blocks:
        id_match = re.search(r'id\s*=\s*"([^"]+)"', block)
        name_match = re.search(r'name\s*=\s*"([^"]+)"', block)
        sprite_match = re.search(r'sprite\s*=\s*"([^"]+)"', block)
        type_match = re.search(r'type\s*=\s*([A-Z0-9_]+)', block)
        uses_match = re.search(r'max_uses\s*=\s*(-?\d+)', block)
        
        if id_match and sprite_match:
            spell_id = id_match.group(1)
            raw_name = name_match.group(1) if name_match else spell_id
            
            en_name = raw_name
            zh_name = raw_name
            if raw_name.startswith("$"):
                tk = raw_name.lstrip("$")
                if tk in trans:
                    en_name = trans[tk]["en"] or raw_name
                    zh_name = trans[tk]["zh"] or raw_name
            
            py_full, py_init = get_pinyin(zh_name)
            
            # Merge from mapping
            aliases = ""
            alias_py = ""
            alias_init = ""
            if spell_id in mapping:
                m = mapping[spell_id]
                # If common.csv didn't have a good name, use mapping
                if zh_name == raw_name or not zh_name:
                    zh_name = m["mod"] or m["official"] or zh_name
                    py_full, py_init = get_pinyin(zh_name)
                
                aliases = m["aliases"]
                if aliases:
                    alias_py, alias_init = get_pinyin(aliases)

            icon_path = sprite_match.group(1).lstrip("/")
            src_icon = Path(NOITA_DATA_PATH) / icon_path
            if src_icon.exists():
                dst_icon = icon_dir / icon_path
                dst_icon.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(src_icon, dst_icon)

            type_str = type_match.group(1) if type_match else "ACTION_TYPE_PROJECTILE"
            spell_db[spell_id] = {
                "id": spell_id,
                "icon": icon_path,
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

    with open(FRONTEND_PUBLIC / "spells.json", "w", encoding="utf-8") as f:
        json.dump(spell_db, f, ensure_ascii=False, indent=2)

    # 3. 全量收集 Noita 核心 Lua 脚本
    print("正在全量收集 Noita 核心 Lua 脚本...")
    folders_needed = [
        "data/scripts/gun",
        "data/scripts/lib",
    ]
    for rel_dir in folders_needed:
        src_dir = Path(NOITA_DATA_PATH) / rel_dir
        if src_dir.exists():
            print(f"  同步目录: {rel_dir}")
            dst_dir = lua_dir / rel_dir
            shutil.copytree(src_dir, dst_dir, dirs_exist_ok=True)
        else:
            print(f"  警告: 找不到目录 {src_dir}")

    # 4. 补全翻译文件和缺失的 Generated 脚本
    print("正在补全翻译和生成脚本...")
    additional_needed = [
        "data/translations/common.csv",
        "data/scripts/gun/gunaction_generated.lua",
        "data/scripts/gun/gun_generated.lua",
        "data/scripts/gun/gunshoteffects_generated.lua",
    ]
    for rel_path in additional_needed:
        src = Path(NOITA_DATA_PATH) / rel_path
        dst = lua_dir / rel_path
        if src.exists():
            if not dst.exists():
                dst.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(src, dst)
        elif rel_path.endswith("_generated.lua"):
            print(f"  创建 Generated 占位符: {rel_path}")
            dst.parent.mkdir(parents=True, exist_ok=True)
            with open(dst, "w", encoding="utf-8") as f:
                f.write("function _set_gun()\nend\nfunction _set_gun2()\nend\nfunction _add_card_to_deck()\nend\n")
        elif "common.csv" in rel_path:
            print(f"  错误: 找不到核心翻译文件 {src}")

    # 5. 复制评估引擎脚本 (wand_eval_tree)
    if WAND_EVAL_SRC.exists():
        print(f"正在复制评估引擎脚本...")
        for d in ["src", "extra", "meta"]:
            src_dir = WAND_EVAL_SRC / d
            if src_dir.exists():
                shutil.copytree(src_dir, lua_dir / d, dirs_exist_ok=True)
        
        for f in ["main.lua", "user_config.lua"]:
            src_file = WAND_EVAL_SRC / f
            if src_file.exists():
                shutil.copy2(src_file, lua_dir / f)
            elif f == "user_config.lua":
                with open(lua_dir / f, "w", encoding="utf-8") as file:
                    file.write("return {}\n")

    # 6. 生成 Lua 文件 Bundle (优化加载速度)
    print("正在打包 Lua 脚本...")
    lua_bundle = {}
    
    # 遍历 lua_dir 下的所有文件
    for root, dirs, files in os.walk(lua_dir):
        for file in files:
            if file.endswith(".lua") or file.endswith(".csv"):
                full_path = Path(root) / file
                # 计算相对路径，例如 data/scripts/gun/gun_actions.lua
                rel_path = full_path.relative_to(lua_dir).as_posix()
                
                try:
                    with open(full_path, "r", encoding="utf-8") as f:
                        lua_bundle[rel_path] = f.read()
                except Exception as e:
                    print(f"  无法打包文件 {rel_path}: {e}")
    
    bundle_path = FRONTEND_PUBLIC / "lua_bundle.json"
    with open(bundle_path, "w", encoding="utf-8") as f:
        json.dump(lua_bundle, f, ensure_ascii=False)
    print(f"  已打包 {len(lua_bundle)} 个文件到 {bundle_path}")

    print(f"完成! 资源已就绪: {FRONTEND_PUBLIC}")

if __name__ == "__main__":
    prepare_assets()
