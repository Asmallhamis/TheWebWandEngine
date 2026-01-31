import { LuaFactory } from 'wasmoon';

const factory = new LuaFactory();
let lua: any = null;
let VFS_CACHE: Record<string, string> | null = null;

async function loadBundle() {
    if (VFS_CACHE) return;
    
    try {
        const isProd = import.meta.url.includes('/assets/');
        const bundlePath = isProd ? '../static_data/lua_bundle.json' : '../../static_data/lua_bundle.json';
        const url = new URL(bundlePath, import.meta.url).href;
        
        const res = await fetch(url);
        if (res.ok) {
            VFS_CACHE = await res.json();
            console.log(`[Worker] Bundle loaded, ${Object.keys(VFS_CACHE || {}).length} files cached.`);
        } else {
            console.error('[Worker] Failed to load lua_bundle.json');
            VFS_CACHE = {};
        }
    } catch (e) {
        console.error('[Worker] Error loading bundle:', e);
        VFS_CACHE = {};
    }
}

// 模拟 Noita 环境的核心 Lua 代码
const BOOTSTRAP_LUA = `
-- 简单的 print 拦截
function print(...)
    local args = {...}
    local str = ""
    for i, v in ipairs(args) do
        str = str .. tostring(v) .. (i < #args and "\\\\t" or "")
    end
    _JS_PRINT(str)
end

-- 兼容性层
if not loadstring then
    loadstring = load
end

if not unpack then
    unpack = table.unpack
end

-- bit 库 polyfill (针对 Lua 5.3)
if not bit then
    bit = {
        bor = function(a, b) return (a | b) & 0xFFFFFFFF end,
        band = function(a, b) return (a & b) & 0xFFFFFFFF end,
        bxor = function(a, b) return (a ~ b) & 0xFFFFFFFF end,
        lshift = function(a, b) return (a << b) & 0xFFFFFFFF end,
        rshift = function(a, b) return (a >> b) & 0xFFFFFFFF end,
        arshift = function(a, b) return (a >> b) & 0xFFFFFFFF end,
    }
end

-- 核心文件读取逻辑 (私有变量，防止被 shadow)
local _REAL_BRIDGE_GET_CONTENT = function(filename)
    if not filename then return nil end
    filename = filename:gsub("^%./", "")
    return _JS_GET_FILE_CONTENT(filename)
end

-- 公开给全局使用
ModTextFileGetContent = _REAL_BRIDGE_GET_CONTENT

-- 拦截 dofile，确保它使用我们的桥接
function dofile(filename)
    local content = _REAL_BRIDGE_GET_CONTENT(filename)
    if not content then error("dofile: File not found: " .. tostring(filename)) end
    local f, err = loadstring(content, "@" .. filename)
    if not f then error(err) end
    return f()
end

-- 拦截 io.open
io = io or {}
local _old_io_open = io.open
function io.open(filename, mode)
    local content = _REAL_BRIDGE_GET_CONTENT(filename)
    if content then
        return {
            read = function(self, arg) 
                if arg == "*a" or arg == "*all" then return content end
                return content -- 简化版
            end,
            close = function(self) end
        }
    end
    if _old_io_open then return _old_io_open(filename, mode) end
    return nil, "File not found in VFS: " .. tostring(filename)
end

-- 配置 require 搜索器
-- 我们要确保即使有人重写了 ModTextFileGetContent，我们的搜索器依然能工作
local function vfs_searcher(modname)
    local filename = modname:gsub("%.", "/") .. ".lua"
    local attempts = { filename, "src/" .. filename, "extra/" .. filename }
    
    for _, path in ipairs(attempts) do
        local content = _REAL_BRIDGE_GET_CONTENT(path)
        if content and type(content) == "string" then
            local f, err = loadstring(content, "@" .. path)
            if f then return f end
            return "\\\\n\\\\tsyntax error in VFS file '" .. path .. "': " .. tostring(err)
        end
    end
    return "\\\\n\\\\tno file '" .. filename .. "' in VFS"
end

local searchers = package.searchers or package.loaders
-- 放在第 1 位，确保最高优先级，防止被 Lua 默认搜索器截获并返回布尔值
table.insert(searchers, 1, vfs_searcher)
`;

async function getNewLuaEngine() {
    await loadBundle();
    const engine = await factory.createEngine();
    
    engine.global.set('_JS_PRINT', (msg: string) => console.log('[Lua]', msg));
    engine.global.set('_JS_GET_FILE_CONTENT', (path: string) => {
        // Normalize path
        const cleanPath = path.replace(/^\.\//, '').replace(/\\/g, '/');
        
        // 1. Try Cache
        if (VFS_CACHE && VFS_CACHE[cleanPath]) {
            return VFS_CACHE[cleanPath];
        }
        
        // 2. Fallback to Sync XHR (Slow, Deprecated, but backup)
        try {
            const isProd = import.meta.url.includes('/assets/');
            const relPath = isProd ? `../static_data/lua/${cleanPath}` : `../../static_data/lua/${cleanPath}`;
            const url = new URL(relPath, import.meta.url).href;
            
            console.warn(`[Worker] Cache miss for ${cleanPath}, falling back to sync XHR`);
            
            const xhr = new XMLHttpRequest();
            xhr.open('GET', url, false); 
            xhr.send(null);
            if (xhr.status === 200) {
                return xhr.responseText;
            }
        } catch (e) {}
        return undefined;
    });

    engine.global.set('os', {
        ...engine.global.get('os'),
        exit: (code: number) => {
            console.warn(`[Lua] os.exit(${code}) blocked`);
        }
    });

    await engine.doString(BOOTSTRAP_LUA);
    return engine;
}

self.onmessage = async (e) => {
    const { type, data, options } = e.data;
    
    if (type === 'EVALUATE') {
        try {
            lua = await getNewLuaEngine();
            
            const luaArgs = [
                '-dp', './',
                '-mp', './',
                '-j', 'true',
                '-sc', String(data.actions_per_round || 1),
                '-ma', String(data.mana_max || 100),
                '-mx', String(data.mana_max || 100),
                '-mc', String(data.mana_charge_speed || 10),
                '-rt', String(data.reload_time || 0),
                '-cd', String(data.fire_rate_wait || 0),
                '-nc', String(options.numCasts || 3),
                '-u', options.unlimitedSpells ? 'true' : 'false',
                '-e', options.initialIfHalf ? 'true' : 'false',
            ];

            if (data.always_cast && data.always_cast.length > 0) {
                const acs = data.always_cast.filter((ac: string) => !!ac);
                if (acs.length > 0) luaArgs.push('-ac', ...acs);
            }

            const spellsToAdd: string[] = [];
            const capacity = data.deck_capacity || 10;
            for (let i = 1; i <= capacity; i++) {
                const spellId = data.spells[String(i)];
                if (spellId) {
                    // Inject index info: SlotID:SpellID (e.g. 5:SPARK_BOLT)
                    spellsToAdd.push(`${i}:${spellId}`);
                    const uses = data.spell_uses?.[String(i)];
                    if (uses !== undefined && uses !== -1) spellsToAdd.push(String(uses));
                }
            }
            if (spellsToAdd.length > 0) luaArgs.push('-sp', ...spellsToAdd);

            lua.global.set('_JS_ARGS', luaArgs);
            await lua.doString(`
                arg = {}
                local count = 0
                while true do
                    local val = _JS_ARGS[count]
                    if val == nil then break end
                    arg[count + 1] = val
                    count = count + 1
                end
            `);
            
            if (luaArgs.length > 0) {
                const checkLen = await lua.doString('return #arg');
                if (checkLen === 0) {
                    const assignments = luaArgs.map((v, i) => {
                        const safeV = String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
                        return `arg[${i + 1}] = "${safeV}"`;
                    }).join('\n');
                    await lua.doString(assignments);
                }
            }

            let lastOutput = '';
            lua.global.set('_JS_PRINT', (msg: string) => {
                if (msg.trim().startsWith('{')) {
                    lastOutput = msg;
                } else {
                    console.log('[Lua Log]', msg);
                }
            });

            // 预加载 tcsv 模块，防止 dot require 失败
            await lua.doString(`
                local content = ModTextFileGetContent("extra/tcsv.lua")
                if content then
                    local f = loadstring(content, "@extra/tcsv.lua")
                    if f then package.loaded["extra.tcsv"] = f() end
                end
            `);

            await lua.doString('dofile("main.lua")');
            
            if (!lastOutput) {
                throw new Error('Lua 执行完成但没有输出有效的 JSON 结果');
            }
            
            const result = JSON.parse(lastOutput);
            self.postMessage({ type: 'RESULT', data: result });
            
        } catch (err: any) {
            console.error('[Worker Error]', err);
            self.postMessage({ type: 'ERROR', error: err.message });
        }
    }
};
