import os
import re

try:
    from pypinyin import pinyin, Style
    HAS_PYPINYIN = True
except ImportError:
    HAS_PYPINYIN = False

_BASE_DIR = None
_EXTRACTED_DATA_ROOT = None
_SPELL_CACHE = {}
_TRANSLATIONS = {}
_MAPPING_CACHE = {}


def init_spell_db(base_dir, extracted_data_root):
    global _BASE_DIR, _EXTRACTED_DATA_ROOT
    _BASE_DIR = base_dir
    _EXTRACTED_DATA_ROOT = extracted_data_root


def get_pinyin_data(text):
    if not HAS_PYPINYIN or not text:
        return "", ""
    try:
        full = "".join([item[0] for item in pinyin(text, style=Style.NORMAL)])
        initials = "".join([item[0] for item in pinyin(text, style=Style.FIRST_LETTER)])
        return full.lower(), initials.lower()
    except Exception:
        return "", ""


def load_translations():
    global _TRANSLATIONS
    if _TRANSLATIONS:
        return _TRANSLATIONS

    if not _BASE_DIR or not _EXTRACTED_DATA_ROOT:
        return {}

    trans_files = [
        os.path.join(_EXTRACTED_DATA_ROOT, "data/translations/common.csv"),
        os.path.join(_EXTRACTED_DATA_ROOT, "data/translations/common_dev.csv"),
        os.path.join(_BASE_DIR, "spell_mapping.md"),
    ]

    translations = {}
    for file_path in trans_files:
        if not os.path.exists(file_path):
            continue
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                if file_path.endswith(".md"):
                    for line in f:
                        if "|" not in line or "SPELL ID" in line or "---" in line:
                            continue
                        parts = [p.strip() for p in line.split("|")]
                        if len(parts) >= 4:
                            key = parts[0].lstrip('$')
                            translations[key] = {
                                "en": key,
                                "zh": parts[2] or parts[1],
                                "aliases": parts[3],
                            }
                    continue

                import csv

                reader = csv.reader(f)
                header = next(reader, None)
                if not header:
                    continue

                en_idx = 1
                zh_idx = 9

                for i, h in enumerate(header):
                    h_lower = h.lower()
                    if h_lower == 'en':
                        en_idx = i
                    elif h_lower == 'zh-cn':
                        zh_idx = i
                    elif 'zh-cn汉化mod' in h_lower:
                        zh_idx = i
                    elif h_lower == '简体中文' and zh_idx == 9:
                        zh_idx = i

                for row in reader:
                    if not row or len(row) < 2:
                        continue
                    key = row[0].lstrip('$')
                    if not key:
                        continue

                    en_val = row[en_idx] if len(row) > en_idx else ""
                    zh_val = row[zh_idx] if len(row) > zh_idx else ""

                    if key not in translations:
                        translations[key] = {"en": "", "zh": ""}

                    if en_val:
                        translations[key]["en"] = en_val.replace('\\n', '\n').strip('"')
                    if zh_val:
                        translations[key]["zh"] = zh_val.replace('\\n', '\n').strip('"')
        except Exception as e:
            print(f"Error loading translations from {file_path}: {e}")

    _TRANSLATIONS = translations
    return translations


def load_spell_mapping():
    global _MAPPING_CACHE
    if _MAPPING_CACHE:
        return _MAPPING_CACHE

    if not _BASE_DIR:
        return {}

    mapping_path = os.path.join(_BASE_DIR, "spell_mapping.md")
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
                        "aliases": parts[3],
                    }
    except Exception as e:
        print(f"Error loading spell mapping: {e}")

    _MAPPING_CACHE = mapping
    return mapping


def load_spell_database():
    global _SPELL_CACHE
    if _SPELL_CACHE:
        return _SPELL_CACHE

    if not _EXTRACTED_DATA_ROOT:
        return {}

    trans = load_translations()
    mapping = load_spell_mapping()
    actions_file = os.path.join(_EXTRACTED_DATA_ROOT, "data/scripts/gun/gun_actions.lua")
    if not os.path.exists(actions_file):
        print(f"Warning: gun_actions.lua not found at {actions_file}")
        return {}

    try:
        with open(actions_file, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()

        content = re.sub(r'--\[\[.*?\]\]', '', content, flags=re.DOTALL)
        content = re.sub(r'--.*', '', content)

        type_map = {
            "ACTION_TYPE_PROJECTILE": 0,
            "ACTION_TYPE_STATIC_PROJECTILE": 1,
            "ACTION_TYPE_MODIFIER": 2,
            "ACTION_TYPE_DRAW_MANY": 3,
            "ACTION_TYPE_MATERIAL": 4,
            "ACTION_TYPE_OTHER": 5,
            "ACTION_TYPE_UTILITY": 6,
            "ACTION_TYPE_PASSIVE": 7,
        }

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

                en_name = raw_name
                zh_name = raw_name

                if raw_name.startswith("$"):
                    trans_key = raw_name.lstrip("$")
                    if trans_key in trans:
                        en_name = trans[trans_key]["en"] or raw_name
                        zh_name = trans[trans_key]["zh"] or raw_name

                py_full, py_init = get_pinyin_data(zh_name)

                aliases = ""
                alias_py = ""
                alias_init = ""
                if spell_id in mapping:
                    m = mapping[spell_id]
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
                    "type": type_map.get(type_str, 0),
                    "max_uses": int(uses_match.group(1)) if uses_match else None,
                }
        _SPELL_CACHE = db
        print(f"Loaded {len(db)} clean spells with translations")
        return db
    except Exception as e:
        print(f"Error parsing local spells: {e}")
        return {}
