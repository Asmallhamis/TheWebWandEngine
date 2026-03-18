"""
TWWE Backend — Wiki 模板解析服务
解析 Noita Wiki 的 {{Wand2}} / {{Wand}} 模板格式
"""
import re


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


def parse_wiki_wand(text):
    """
    解析 Noita Wiki 的 {{Wand2 ...}} 或旧版 {{Wand ...}} 模板代码。

    参数:
        text: 包含 Wiki 模板的原始文本

    返回:
        dict — 解析出的魔杖数据
    """
    data = {}

    def get_val(key, default=None):
        # 匹配 |key = value (直到 next | or } or newline)
        m = re.search(rf'\|\s*{key}\s*=\s*([^|\n}}]+)', text, re.IGNORECASE)
        if m:
            val = m.group(1).strip()
            val = re.sub(r'<!--.*?-->', '', val).strip()
            return val
        return default

    try:
        mana_max = get_val("manaMax")
        if mana_max:
            data["mana_max"] = float(mana_max)

        mana_charge = get_val("manaCharge")
        if mana_charge:
            data["mana_charge_speed"] = float(mana_charge)

        recharge = get_val("rechargeTime")
        if recharge:
            data["reload_time"] = int(float(recharge) * 60)

        # 兼容不同命名
        fire_rate = get_val("castDelay") or get_val("fireRate")
        if fire_rate:
            data["fire_rate_wait"] = int(float(fire_rate) * 60)

        capacity = get_val("capacity")
        if capacity:
            data["deck_capacity"] = int(capacity)

        spells_cast = get_val("spellsCast") or get_val("spellsPerCast")
        if spells_cast:
            data["actions_per_round"] = int(spells_cast)

        spread = get_val("spread")
        if spread:
            data["spread_degrees"] = float(spread)

        speed = get_val("speed")
        if speed:
            data["speed_multiplier"] = float(speed)

        shuffle = get_val("shuffle")
        if shuffle:
            data["shuffle_deck_when_empty"] = (
                shuffle.lower() == "yes" or shuffle == "1" or shuffle.lower() == "true"
            )

        spells = get_val("spells")

        # Appearance support
        wand_pic = get_val("wandPic") or get_val("wand_file")
        if wand_pic:
            if wand_pic in UNIQUE_WIKI_TO_PATH:
                data["appearance"] = UNIQUE_WIKI_TO_PATH[wand_pic]
            elif wand_pic.startswith("data/") or wand_pic.startswith("mods/"):
                data["appearance"] = {
                    "sprite": wand_pic,
                    "item_sprite": wand_pic.replace(".xml", ".png"),
                }
            else:
                filename = wand_pic.strip().replace(" ", "_")
                filename = filename[0].lower() + filename[1:] if filename else filename
                data["appearance"] = {"item_sprite": f"data/items_gfx/wands/{filename}"}

        if spells:
            # 移除 [[...]] 链接
            spells = re.sub(r'\[\[([^|\]]+\|)?([^\]]+)\]\]', r'\2', spells)
            spells_list = [s.strip() for s in spells.split(',')]
            data["spells"] = {}
            for i, s in enumerate(spells_list):
                if s:
                    data["spells"][str(i + 1)] = s
    except Exception as e:
        print(f"Error parsing wiki wand: {e}")

    return data
