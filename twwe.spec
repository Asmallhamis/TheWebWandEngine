# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

a = Analysis(
    ['backend/server.py'],
    pathex=[],
    binaries=[],
    datas=[
        # 嵌入前端网页
        ('frontend/dist', 'frontend/dist'),
        ('backend/import_helper.lua', 'backend'),
        # 嵌入核心数据 (Lua定义)
        ('noitadata/data/scripts', 'noitadata_internal/data/scripts'),
        # 嵌入核心数据 (图标 - 整个目录)
        ('noitadata/data/ui_gfx/gun_actions', 'noitadata_internal/data/ui_gfx/gun_actions'),
        # 嵌入法杖外观图片 (仓库卡片 & Wand2 模板)
        ('noitadata/data/items_gfx/wands', 'noitadata_internal/data/items_gfx/wands'),
        ('noitadata/data/items_gfx/handgun.png', 'noitadata_internal/data/items_gfx'),
        ('noitadata/data/items_gfx/handgun.xml', 'noitadata_internal/data/items_gfx'),
        ('noitadata/data/items_gfx/bomb_wand.png', 'noitadata_internal/data/items_gfx'),
        ('noitadata/data/items_gfx/bomb_wand.xml', 'noitadata_internal/data/items_gfx'),
        ('noitadata/data/items_gfx/flute.png', 'noitadata_internal/data/items_gfx'),
        ('noitadata/data/items_gfx/flute.xml', 'noitadata_internal/data/items_gfx'),
        ('noitadata/data/items_gfx/kantele.png', 'noitadata_internal/data/items_gfx'),
        ('noitadata/data/items_gfx/kantele.xml', 'noitadata_internal/data/items_gfx'),
        ('noitadata/data/entities/items/wands/experimental', 'noitadata_internal/data/entities/items/wands/experimental'),
        # 嵌入翻译数据
        ('noitadata/data/translations/common.csv', 'noitadata_internal/data/translations'),
        ('noitadata/data/translations/common_dev.csv', 'noitadata_internal/data/translations'),
        ('spell_mapping.md', '.'),
        # 嵌入 Lua 引擎和评估脚本
        ('bin', 'bin'),
        ('wand_eval_tree', 'wand_eval_tree')
    ],
    hiddenimports=['flask', 'flask_cors', 'engineio.async_drivers.threading', 'pypinyin'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='TheWebWandEngine',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True, # 保留控制台以便查看日志，发布时可改为 False
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    # icon='frontend/public/vite.svg' # 临时使用 vite 图标，如果有的话
)
