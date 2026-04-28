#!/usr/bin/env python3
"""
TWWE Backend — 应用入口
Flask app factory, Blueprint 注册, 启动逻辑
"""
import sys
import os

from config import (
    BASE_DIR, EXTRACTED_DATA_ROOT, FRONTEND_DIST,
    API_TOKEN, SERVER_HOST, SERVER_PORT, get_cors_origins,
    kill_existing_instance,
)

from threading import Timer
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from spell_db import init_spell_db
from utils import init_utils
from services.game_comm import get_game_root

# --- Blueprint 导入 ---
from routes.sync import sync_bp
from routes.wiki import wiki_bp
from routes.import_export import import_export_bp
from routes.evaluate import evaluate_bp


def create_app():
    """创建并配置 Flask 应用"""
    app = Flask(__name__)
    CORS(
        app,
        resources={
            r"/api/*": {
                "origins": get_cors_origins(),
                "allow_headers": ["Content-Type", "X-TWWE-Token"],
                "methods": ["GET", "POST", "OPTIONS"],
            }
        },
    )

    # 配置 Flask 静态资源目录 (用于打包 EXE 后能找到网页)
    app.static_folder = FRONTEND_DIST

    # 初始化法术数据库
    init_spell_db(BASE_DIR, EXTRACTED_DATA_ROOT)

    # 注册 Blueprints
    app.register_blueprint(sync_bp)
    app.register_blueprint(wiki_bp)
    app.register_blueprint(import_export_bp)
    app.register_blueprint(evaluate_bp)

    @app.before_request
    def require_api_token():
        if request.method == "OPTIONS" or not request.path.startswith("/api/"):
            return None

        # The session endpoint bootstraps the token for Vite dev/proxy mode.
        # Icon images are loaded by <img> tags, which cannot attach headers;
        # path validation keeps this read-only route constrained.
        if request.path == "/api/session" or request.path.startswith("/api/icon/"):
            return None

        if request.headers.get("X-TWWE-Token") != API_TOKEN:
            return jsonify({"success": False, "error": "Unauthorized"}), 401

        return None

    # --- 静态文件路由 ---
    @app.route("/api/session")
    def api_session():
        return jsonify({"success": True, "token": API_TOKEN})

    @app.route("/")
    def index():
        index_path = os.path.join(app.static_folder, "index.html")
        try:
            with open(index_path, "r", encoding="utf-8") as f:
                html = f.read()
            token_meta = f'<meta name="twwe-api-token" content="{API_TOKEN}">'
            if "twwe-api-token" not in html:
                html = html.replace("</head>", f"  {token_meta}\n</head>")
            return app.response_class(html, mimetype="text/html")
        except OSError:
            return send_from_directory(app.static_folder, "index.html")

    @app.route("/assets/<path:path>")
    def send_assets(path):
        return send_from_directory(os.path.join(app.static_folder, "assets"), path)

    @app.route("/static_data/<path:path>")
    def send_static_data(path):
        return send_from_directory(os.path.join(app.static_folder, "static_data"), path)

    return app


if __name__ == "__main__":
    is_frozen = getattr(sys, 'frozen', False)

    # 启动前清理旧进程，防止端口占用
    kill_existing_instance()

    init_utils(get_game_root(), EXTRACTED_DATA_ROOT)

    app = create_app()

    def open_browser():
        import webbrowser
        browser_host = "127.0.0.1" if SERVER_HOST == "0.0.0.0" else SERVER_HOST
        webbrowser.open_new(f"http://{browser_host}:{SERVER_PORT}")

    # Only auto-open if frozen (packaged)
    if is_frozen and not os.environ.get("WERKZEUG_RUN_MAIN"):
        Timer(1.5, open_browser).start()

    # 开发模式下保留 debug，但关闭 Werkzeug reloader。
    # Windows 下 reloader 可能误监控到 site-packages 等目录并反复触发重载。
    # 打包模式下本来就不需要 reloader。
    app.run(
        host=SERVER_HOST, port=SERVER_PORT, debug=not is_frozen, use_reloader=False
    )
