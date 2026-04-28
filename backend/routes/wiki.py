"""
TWWE Backend — Wiki 解析与图标资源路由
/api/parse-wiki, /api/sync-wiki, /api/icon/*
"""
import json

from flask import Blueprint, request, jsonify, send_file

from services.game_comm import talk_to_game
from services.wiki_parser import parse_wiki_wand
from utils import find_noita_file
from services.game_comm import get_game_root

wiki_bp = Blueprint('wiki', __name__)


@wiki_bp.route("/api/parse-wiki", methods=["POST"])
def parse_wiki():
    text = request.data.decode("utf-8")
    return jsonify({"success": True, "wand": parse_wiki_wand(text)})


@wiki_bp.route("/api/sync-wiki", methods=["POST"])
def sync_wiki():
    body = request.get_json()
    wand = parse_wiki_wand(body.get("wiki", ""))
    slot = body.get("slot", 1)
    wand["slot"] = slot
    talk_to_game(json.dumps(wand))
    return jsonify({"success": True, "parsed_wand": wand})


@wiki_bp.route("/api/icon/<path:icon_path>")
def get_icon(icon_path):
    # 移除首尾空格和首部的斜杠，并统一斜杠方向
    icon_path = icon_path.strip().lstrip("/").replace("\\", "/")
    allowed_exts = (".png", ".webp", ".jpg", ".jpeg", ".gif", ".xml")
    if not icon_path.lower().endswith(allowed_exts):
        return "Not Found", 404

    def resolve_sprite_xml(xml_file_path):
        """从 Noita sprite XML 文件中提取 PNG 路径"""
        try:
            import xml.etree.ElementTree as ET
            tree = ET.parse(xml_file_path)
            root_el = tree.getroot()
            png_path = root_el.get("filename")
            if png_path:
                return png_path.lstrip("/")
        except Exception as e:
            print(f"Failed to parse sprite XML {xml_file_path}: {e}")
        return None

    found = find_noita_file(icon_path)
    if found:
        if found.lower().endswith(".xml"):
            png_rel = resolve_sprite_xml(found)
            if png_rel:
                png_found = find_noita_file(png_rel)
                if png_found:
                    return send_file(png_found, max_age=31536000)
        else:
            return send_file(found, max_age=31536000)

    print(f"[Icon] Not found: {icon_path} (GameRoot: {get_game_root()})")
    return "Not Found", 404
