import os
import re
import time
import shutil
import xml.etree.ElementTree as ET
from datetime import datetime

class BonesManager:
    def __init__(self, save_path):
        self.save_path = save_path.replace("\\", "/")
        self.bones_dir = os.path.join(self.save_path, "persistent/bones_new").replace("\\", "/")
        self.backup_root = os.path.join(self.save_path, "persistent/twwe_bones_backups").replace("\\", "/")

    def _get_attr(self, el, key, default):
        return el.get(key, default) if el is not None else default

    def pull_bones(self, spell_db_loader):
        """拉取：磁盘 XML -> JSON 列表"""
        if not os.path.exists(self.bones_dir):
            return []
        
        wands = []
        for filename in os.listdir(self.bones_dir):
            if filename.lower().endswith(".xml"):
                path = os.path.join(self.bones_dir, filename)
                try:
                    with open(path, "r", encoding="utf-8", errors="ignore") as f:
                        xml_str = f.read()
                        wand = self.xml_to_wand(xml_str, filename)
                        if wand:
                            wands.append(wand)
                except Exception as e:
                    print(f"[Bones] Failed to parse {filename}: {e}")
        return wands

    def xml_to_wand(self, xml_str, filename):
        """解析单根法杖 XML"""
        try:
            root = ET.fromstring(xml_str)
        except:
            return None
            
        ability = root.find("AbilityComponent")
        if ability is None: return None
        
        gun_config = ability.find("gun_config")
        gunaction_config = ability.find("gunaction_config")
        
        # 基础属性转换
        wand = {
            "id": f"bone_{filename}",
            "name": self._get_attr(ability, "ui_name", "Bones Wand"),
            "mana_max": float(self._get_attr(ability, "mana_max", 400)),
            "mana_charge_speed": float(self._get_attr(ability, "mana_charge_speed", 10)),
            "reload_time": int(float(self._get_attr(gun_config, "reload_time", 30))),
            "fire_rate_wait": int(float(self._get_attr(gunaction_config, "fire_rate_wait", 10))),
            "deck_capacity": int(float(self._get_attr(gun_config, "deck_capacity", 10))),
            "shuffle_deck_when_empty": self._get_attr(gun_config, "shuffle_deck_when_empty", "0") == "1",
            "spread_degrees": float(self._get_attr(gunaction_config, "spread_degrees", 0)),
            "speed_multiplier": float(self._get_attr(ability, "speed_multiplier", 1)),
            "actions_per_round": int(float(self._get_attr(gun_config, "actions_per_round", 1))),
            "spells": {},
            "spell_uses": {},
            "always_cast": [],
            "appearance": {
                "sprite": self._get_attr(ability, "sprite_file", ""),
            },
            "tags": ["Bones"],
            "createdAt": int(os.path.getmtime(os.path.join(self.bones_dir, filename)) * 1000)
        }
        
        sprite_comp = root.find("SpriteComponent")
        if sprite_comp is not None:
            wand["appearance"]["item_sprite"] = sprite_comp.get("image_file")

        # 法术解析
        slot_idx = 1
        for child in root.findall("Entity"):
            if "card_action" not in child.get("tags", ""): continue
            
            action = child.find("ItemActionComponent")
            item = child.find("ItemComponent")
            if action is not None:
                aid = action.get("action_id")
                if not aid: continue
                
                if item is not None and item.get("permanently_attached") == "1":
                    wand["always_cast"].append(aid)
                else:
                    wand["spells"][str(slot_idx)] = aid
                    uses = action.get("uses_remaining")
                    if uses and uses != "-1":
                        wand["spell_uses"][str(slot_idx)] = int(uses)
                    slot_idx += 1
        return wand

    def push_bones(self, wands_json, spell_db):
        """推送：JSON 列表 -> 磁盘 XML (带备份)"""
        if not os.path.exists(self.bones_dir):
            os.makedirs(self.bones_dir, exist_ok=True)

        # 1. 自动备份
        if os.listdir(self.bones_dir):
            os.makedirs(self.backup_root, exist_ok=True)
            ts = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_path = os.path.join(self.backup_root, f"backup_{ts}")
            shutil.copytree(self.bones_dir, backup_path)
            print(f"[Bones] Backed up to {backup_path}")

        # 2. 清空旧文件 (Noita 只认这些 XML)
        for f in os.listdir(self.bones_dir):
            if f.lower().endswith(".xml"):
                os.remove(os.path.join(self.bones_dir, f))

        # 3. 写入新文件
        for i, wand in enumerate(wands_json):
            xml_str = self.wand_to_xml(wand, spell_db)
            # 使用 item_0001.xml 这种标准格式
            file_path = os.path.join(self.bones_dir, f"item_{i:04d}.xml")
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(xml_str)
        
        return len(wands_json)

    def wand_to_xml(self, wand, spell_db):
        """将魔杖 JSON 转换为 Noita Entity XML"""
        # 核心：使用完整的 Entity 结构，包含所有物理和 AI 组件
        root = ET.Element("Entity", {
            "_version": "1",
            "serialize": "1",
            "tags": "teleportable_NOT,item,wand,teleportable"
        })
        
        # 1. Transform
        ET.SubElement(root, "_Transform", {
            "position.x": "0",
            "position.y": "0",
            "rotation": "0",
            "scale.x": "1",
            "scale.y": "1"
        })
        
        appearance = wand.get("appearance", {})
        
        # 2. AbilityComponent (核心属性)
        ability_attrs = {
            "_enabled": "1",
            "amount_in_inventory": "1",
            "base_item_file": "data/entities/base_item.xml",
            "charge_wait_frames": "10",
            "click_to_use": "1",
            "drop_as_item_on_death": "1",
            "entity_count": "1",
            "fast_projectile": "0",
            "is_petris_gun": "0",
            "item_recoil_max": "1",
            "item_recoil_offset_coeff": "1",
            "item_recoil_recovery_speed": "15",
            "item_recoil_rotation_coeff": "5",
            "mCastDelayStartFrame": "0",
            "mChargeCount": "0",
            "mIsInitialized": "1",
            "mNextFrameUsable": "0",
            "mReloadFramesLeft": "0",
            "mReloadNextFrameUsable": "0",
            "mana": str(int(wand.get("mana_max", 400))),
            "mana_charge_speed": str(int(wand.get("mana_charge_speed", 10))),
            "mana_max": str(int(wand.get("mana_max", 400))),
            "reload_time_frames": str(int(wand.get("reload_time", 30))),
            "sprite_file": appearance.get("sprite", "data/items_gfx/wands/wand_0001.png"),
            "ui_name": wand.get("name", "Rapid bolt wand"),
            "use_gun_script": "1"
        }
        ability = ET.SubElement(root, "AbilityComponent", ability_attrs)
        
        ET.SubElement(ability, "gun_config", {
            "shuffle_deck_when_empty": "1" if wand.get("shuffle_deck_when_empty") else "0",
            "actions_per_round": str(wand.get("actions_per_round", 1)),
            "deck_capacity": str(wand.get("deck_capacity", 10)),
            "reload_time": str(wand.get("reload_time", 30)),
            "shuffle_deck_when_empty": "1" if wand.get("shuffle_deck_when_empty") else "0"
        })
        
        ET.SubElement(ability, "gunaction_config", {
            "fire_rate_wait": str(wand.get("fire_rate_wait", 10)),
            "spread_degrees": str(wand.get("spread_degrees", 0)),
            "speed_multiplier": "1"
        })
        
        # 3. AudioLoopComponent (音效)
        for tag in ["sound_digger", "sound_spray"]:
            ET.SubElement(root, "AudioLoopComponent", {
                "_enabled": "1",
                "_tags": f"enabled_in_world,enabled_in_hand,{tag}",
                "event_name": f"player_projectiles/{tag.split('_')[1]}/loop",
                "file": "data/audio/Desktop/projectiles.bank",
                "volume_autofade_speed": "0.1"
            })

        # 4. HitboxComponent (物理碰撞)
        ET.SubElement(root, "HitboxComponent", {
            "_enabled": "0",
            "_tags": "enabled_in_world",
            "aabb_max_x": "4",
            "aabb_max_y": "4",
            "aabb_min_x": "-4",
            "aabb_min_y": "-4"
        })

        # 5. ItemAIKnowledgeComponent (AI识别的核心)
        ET.SubElement(root, "ItemAIKnowledgeComponent", {
            "_enabled": "1",
            "is_ranged_weapon": "1",
            "is_safe": "1",
            "is_weapon": "1"
        })

        # 6. ItemComponent (物品属性)
        ET.SubElement(root, "ItemComponent", {
            "_enabled": "0",
            "_tags": "enabled_in_world",
            "auto_pickup": "0",
            "has_been_picked_by_player": "1",
            "is_identified": "1",
            "is_pickable": "1",
            "item_name": wand.get("name", ""),
            "mFramePickedUp": "0",
            "max_child_items": "0",
            "next_frame_pickable": "0",
            "preferred_inventory": "QUICK",
            "uses_remaining": "-1"
        })

        # 7. LightComponent (光效)
        ET.SubElement(root, "LightComponent", {
            "_enabled": "0",
            "_tags": "enabled_in_world",
            "r": "255", "g": "178", "b": "118",
            "radius": "64"
        })
        
        # 8. ManaReloaderComponent (回魔)
        ET.SubElement(root, "ManaReloaderComponent", {
            "_enabled": "1",
            "_tags": "enabled_in_world,enabled_in_hand,enabled_in_inventory"
        })

        # 9. SimplePhysicsComponent (物理下落)
        ET.SubElement(root, "SimplePhysicsComponent", {
            "_enabled": "0",
            "_tags": "enabled_in_world",
            "can_go_up": "1"
        })

        # 10. SpriteComponent (视觉)
        item_sprite = appearance.get("item_sprite")
        if not item_sprite and appearance.get("sprite"):
            item_sprite = appearance["sprite"].replace(".xml", ".png")
        
        ET.SubElement(root, "SpriteComponent", {
            "_enabled": "1",
            "_tags": "enabled_in_world,enabled_in_hand,item",
            "image_file": item_sprite or "data/items_gfx/wands/wand_0821.png",
            "offset_x": "4",
            "offset_y": "3",
            "update_transform": "1",
            "update_transform_rotation": "1",
            "z_index": "0.575"
        })

        # 11. HotspotComponent (发射点)
        ET.SubElement(root, "HotspotComponent", {
            "_enabled": "0",
            "_tags": "shoot_pos",
            "offset.x": "18",
            "offset.y": "0"
        })

        # 12. VelocityComponent (速度)
        ET.SubElement(root, "VelocityComponent", {
            "_enabled": "0",
            "_tags": "enabled_in_world",
            "air_friction": "0.55",
            "gravity_y": "400",
            "mass": "0.05",
            "terminal_velocity": "1000",
            "updates_velocity": "1"
        })

        # 法术实体生成
        def add_spell(aid, is_always, inventory_x, uses=None):
            s_ent = ET.SubElement(root, "Entity", {
                "_version": "1",
                "tags": "card_action",
                "serialize": "1"
            })
            
            # 法术也需要基本的物理和物品组件
            ET.SubElement(s_ent, "HitboxComponent", {
                "_enabled": "0",
                "_tags": "enabled_in_world",
                "aabb_max_x": "4", "aabb_max_y": "3",
                "aabb_min_x": "-4", "aabb_min_y": "-3"
            })

            ET.SubElement(s_ent, "ItemActionComponent", {
                "_enabled": "0",
                "_tags": "enabled_in_world",
                "action_id": aid
            })

            ET.SubElement(s_ent, "ItemComponent", {
                "_enabled": "0",
                "_tags": "enabled_in_world",
                "inventory_slot.x": str(inventory_x),
                "inventory_slot.y": "0",
                "is_pickable": "1",
                "permanently_attached": "1" if is_always else "0",
                "uses_remaining": str(uses) if (uses is not None and uses != -1) else "-1"
            })
            
            s_info = spell_db.get(aid)
            icon_file = s_info.get("icon", "data/ui_gfx/gun_actions/unidentified.png") if s_info else "data/ui_gfx/gun_actions/unidentified.png"
            
            ET.SubElement(s_ent, "SpriteComponent", {
                "_enabled": "0",
                "_tags": "enabled_in_world,item_identified",
                "image_file": icon_file,
                "offset_x": "8",
                "offset_y": "17",
                "z_index": "0.575"
            })

            ET.SubElement(s_ent, "VelocityComponent", {
                "_enabled": "0",
                "_tags": "enabled_in_world",
                "updates_velocity": "1"
            })

        # 注入法术
        current_inv_x = 0
        for aid in wand.get("always_cast", []):
            if aid:
                add_spell(aid, True, current_inv_x)
                current_inv_x += 1

        slots = sorted(wand.get("spells", {}).keys(), key=int)
        for slot in slots:
            aid = wand["spells"][slot]
            if not aid: continue
            uses = wand.get("spell_uses", {}).get(slot)
            add_spell(aid, False, current_inv_x, uses)
            current_inv_x += 1

        return ET.tostring(root, encoding="utf-8").decode("utf-8")

        
        item_sprite = appearance.get("item_sprite")
        if not item_sprite and appearance.get("sprite"):
            item_sprite = appearance["sprite"].replace(".xml", ".png")
        
        if item_sprite:
            ET.SubElement(root, "SpriteComponent", {
                "image_file": item_sprite,
                "offset_x": "4",
                "offset_y": "3",
                "update_transform": "1",
                "z_index": "0.575"
            })

        # 发射位置组件 (Hotspot)
        ET.SubElement(root, "HotspotComponent", {
            "_tags": "shoot_pos",
            "offset.x": "18",
            "offset.y": "0"
        })

        # 法术实体生成辅助函数
        def add_spell(aid, is_always, inventory_x, uses=None):
            s_ent = ET.SubElement(root, "Entity", {
                "tags": "card_action",
                "serialize": "1"
            })
            ET.SubElement(s_ent, "ItemComponent", {
                "item_name": aid,
                "permanently_attached": "1" if is_always else "0",
                "inventory_slot.x": str(inventory_x),
                "inventory_slot.y": "0",
                "is_pickable": "1",
                "uses_remaining": str(uses) if uses is not None else "-1"
            })
            
            ac_attrs = {"action_id": aid}
            ET.SubElement(s_ent, "ItemActionComponent", ac_attrs)
            
            # 必须带上法术图标，否则在法杖栏显示是空的
            s_info = spell_db.get(aid)
            icon_file = s_info.get("icon", "data/ui_gfx/gun_actions/unidentified.png") if s_info else "data/ui_gfx/gun_actions/unidentified.png"
            ET.SubElement(s_ent, "SpriteComponent", {
                "image_file": icon_file,
                "offset_x": "8",
                "offset_y": "17",
                "z_index": "0.575"
            })

        # 注入法术，保持 slot 对应
        current_inv_x = 0
        
        # 注入始终施法
        for aid in wand.get("always_cast", []):
            if aid:
                add_spell(aid, True, current_inv_x)
                current_inv_x += 1

        # 注入普通法术
        slots = sorted(wand.get("spells", {}).keys(), key=int)
        for slot in slots:
            aid = wand["spells"][slot]
            if not aid: continue
            uses = wand.get("spell_uses", {}).get(slot)
            add_spell(aid, False, current_inv_x, uses)
            current_inv_x += 1

        return ET.tostring(root, encoding="utf-8").decode("utf-8")
