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

-- math.randomseed 兼容性垫片 (解决 Lua 5.3+ 不接受浮点数 seed 的问题)
local _old_randomseed = math.randomseed
math.randomseed = function(seed)
    local n = tonumber(seed)
    if n then
        -- 使用 math.floor 强制转换为整数 subtype
        _old_randomseed(math.floor(n))
    end
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

async function getNewLuaEngine(customVFS?: Record<string, string>) {
    await loadBundle();
    const engine = await factory.createEngine();
    
    engine.global.set('_JS_PRINT', (msg: string) => console.log('[Lua]', msg));
    engine.global.set('_JS_GET_FILE_CONTENT', (path: string) => {
        // Normalize path
        const cleanPath = path.replace(/^\.\//, '').replace(/\\/g, '/');
        
        // 0. Try Custom/Dynamic VFS (for mocks)
        if (customVFS && customVFS[cleanPath]) {
            return customVFS[cleanPath];
        }

        // 1. Try Cache
        if (VFS_CACHE && VFS_CACHE[cleanPath]) {
            return VFS_CACHE[cleanPath];
        }
        
        // 2. Static Mode Safety: If it's not in cache/custom, it doesn't exist.
        // DO NOT fall back to Sync XHR on GitHub Pages as it causes massive lag.
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

self.onmessage = async (e: MessageEvent) => {
    const { type, data, options, id } = e.data;
    
    if (type === 'EVALUATE') {
        try {
            // 构造环境模拟逻辑 (和后端 server.py 保持一致)
            const mockLuaLines = [
                "-- Environment simulation for IF_HP, IF_ENEMY, IF_PROJECTILE",
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
                "function EntityGetIsAlive(ent) return true end"
            ];

            if (options.simulateLowHp) mockLuaLines.unshift("_TWWE_LOW_HP = true");
            if (options.simulateManyEnemies) mockLuaLines.unshift("_TWWE_MANY_ENEMIES = true");
            if (options.simulateManyProjectiles) mockLuaLines.unshift("_TWWE_MANY_PROJECTILES = true");

            // 注入动态 VFS
            const customVFS = {
                'mods/twwe_mock/init.lua': mockLuaLines.join('\n')
            };

            lua = await getNewLuaEngine(customVFS);
            
            const formatLuaArg = (val: any) => {
                try {
                    const fVal = parseFloat(val);
                    if (fVal < 0) return `.${fVal}`;
                    return String(val);
                } catch (e) {
                    return String(val);
                }
            };

            const luaArgs = [
                '-dp', './',
                '-mp', './',
                '-j', 'true',
                '-sc', formatLuaArg(data.actions_per_round !== undefined ? data.actions_per_round : 1),
                '-ma', formatLuaArg(data.mana_max !== undefined ? data.mana_max : 100),
                '-mx', formatLuaArg(data.mana_max !== undefined ? data.mana_max : 100),
                '-mc', formatLuaArg(data.mana_charge_speed !== undefined ? data.mana_charge_speed : 10),
                '-rt', formatLuaArg(data.reload_time !== undefined ? data.reload_time : 0),
                '-cd', formatLuaArg(data.fire_rate_wait !== undefined ? data.fire_rate_wait : 0),
                '-sm', formatLuaArg(data.speed_multiplier || 1.0),
                '-sd', formatLuaArg(data.spread_degrees || 0.0),
                '-nc', formatLuaArg(options.numCasts || 3),
                '-u', options.unlimitedSpells ? 'true' : 'false',
                '-e', options.initialIfHalf ? 'true' : 'false',
                '-md', 'twwe_mock', // 启用 Mock Mod
            ];

            if (options.evaluationSeed !== undefined && options.evaluationSeed !== null && options.evaluationSeed !== "") {
                luaArgs.push('-se', formatLuaArg(options.evaluationSeed));
            }

            if (options.foldNodes === false) {
                luaArgs.push('-f');
            }

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
            self.postMessage({ type: 'RESULT', data: result, id });
            
        } catch (err: any) {
            console.error('[Worker Error]', err);
            self.postMessage({ type: 'ERROR', error: err.message, id });
        }
    }
};
