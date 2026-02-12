import re
import os
import base64
from utils import find_noita_file, resolve_placeholders, get_game_root

class ModBundler:
    def __init__(self, active_mods):
        self.active_mods = active_mods
        self.vfs = {}  # 路径 -> 内容 (字符串)
        self.scanned_files = set()
        self.text_exts = ('.lua', '.xml', '.csv', '.txt')
        
    def scan_lua_for_paths(self, content, current_mod_id):
        """从 Lua 代码中提取可能的文件引用"""
        paths = []
        # 1. 标准函数调用
        patterns = [
            r'(?:dofile|dofile_once|loadfile|ModTextFileGetContent|ModDoesFileExist)\s*\(\s*"([^"]+)"\s*\)',
            r'ModLuaFileAppend\s*\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\)'
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, content)
            for m in matches:
                if isinstance(m, tuple):
                    paths.extend(m)
                else:
                    paths.append(m)
        
        # 2. 启发式：匹配所有包含 .lua 的字符串 (解决 PATH .. "action.lua" 这种动态拼接)
        lua_strings = re.findall(r'"([^"]+\.lua)"', content)
        paths.extend(lua_strings)

        # 3. 针对 The-Focus 等 Mod 的特殊占位符初步处理
        resolved_paths = []
        for p in paths:
            # 尝试在当前 Mod 语境下解析占位符
            resolved = resolve_placeholders(p, current_mod_id)
            resolved_paths.append(resolved)
            
        return list(set(resolved_paths))

    def bundle_file(self, rel_path, mod_id_hint=None):
        """递归抓取文件并存入 VFS"""
        rel_path = rel_path.replace("\\", "/").lstrip("/")
        if rel_path in self.scanned_files:
            return
        self.scanned_files.add(rel_path)
        
        full_path = find_noita_file(rel_path, self.active_mods)
        if not full_path:
            return

        try:
            # 自动推断 Mod ID
            current_mod_id = mod_id_hint
            if rel_path.startswith("mods/"):
                parts = rel_path.split("/")
                if len(parts) > 1:
                    current_mod_id = parts[1]

            # 目前只抓取文本类资源
            if rel_path.lower().endswith(self.text_exts):
                with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                
                self.vfs[rel_path] = content
                
                # 如果是 Lua 文件，递归扫描其内部引用的其他文件
                if rel_path.lower().endswith('.lua'):
                    deps = self.scan_lua_for_paths(content, current_mod_id)
                    for dep in deps:
                        self.bundle_file(dep, current_mod_id)
        except Exception as e:
            print(f"[Bundler] Failed to bundle {rel_path}: {e}")

    def bundle_mod_directory(self, mod_id):
        root = get_game_root()
        if not root or not mod_id:
            return
        mod_root = os.path.join(root, "mods", mod_id)
        if not os.path.isdir(mod_root):
            return

        for dirpath, _, filenames in os.walk(mod_root):
            for filename in filenames:
                if not filename.lower().endswith(self.text_exts):
                    continue
                full_path = os.path.join(dirpath, filename)
                rel_path = os.path.relpath(full_path, root).replace("\\", "/")
                if rel_path in self.scanned_files:
                    continue
                try:
                    with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read()
                    self.vfs[rel_path] = content
                    self.scanned_files.add(rel_path)
                except Exception as e:
                    print(f"[Bundler] Failed to bundle {rel_path}: {e}")

    def collect_icons(self, spell_cache):
        """为所有法术提取图标 Base64"""
        for sid, info in spell_cache.items():
            icon_path = info.get("icon", "").lstrip("/")
            if not icon_path: continue
            
            # 这里我们重用 find_noita_file
            found = find_noita_file(icon_path, self.active_mods)
            if found:
                # 如果是 XML，我们目前直接把 XML 存入 VFS 即可，由前端去解析
                # 但为了兼容性，我们也可以在这里直接读取 PNG
                try:
                    with open(found, "rb") as f:
                        b64 = base64.b64encode(f.read()).decode('utf-8')
                        info["icon_base64"] = f"data:image/png;base64,{b64}"
                except: pass
        return spell_cache
