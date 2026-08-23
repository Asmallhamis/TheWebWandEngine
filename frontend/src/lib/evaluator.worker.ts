import { LuaFactory } from 'wasmoon';
import wasmoonWasmUrl from 'wasmoon/dist/glue.wasm?url';
import {
    advanceCompactTimelineState,
    cloneTimelineDecoderState,
    createTimelineDecoderState,
    rehydrateTimelinePiles,
} from './timeline';
import { EvalTimelineCard, EvalTimelineStorage } from '../types';

const factory = new LuaFactory(wasmoonWasmUrl);
const DEFAULT_TIMELINE_EVENT_LIMIT = 10_000;
const DEFAULT_TIMELINE_CHUNK_SIZE = 25_000;
const TIMELINE_DIRECTORY = 'twwe-timelines';
let lua: any = null;
let VFS_CACHE: Record<string, string> | null = null;
let timelineDirectoryPrepared = false;

async function loadBundle() {
    if (VFS_CACHE) return;

    try {
        const isProd = import.meta.url.includes('/assets/');
        const bundlePath = isProd ? '../static_data/lua_bundle.json' : '../../static_data/lua_bundle.json';
        const url = new URL(bundlePath, import.meta.url).href;

        // 文件名没有内容哈希，静态部署更新后必须重新校验缓存，避免新版
        // Worker 与浏览器/CDN 缓存中的旧 Lua 参数解析器混用。
        const res = await fetch(url, { cache: 'no-cache' });
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

/**
 * 释放 Lua state。
 * wasmoon 的 WASM 堆只能增长、无法归还操作系统，因此每个未 close 的
 * engine 都是永久泄漏（GC 无法回收 WASM 内部分配）。必须显式释放。
 */
function closeLuaEngine(engine: any) {
    if (!engine) return;
    try {
        engine.global.close();
    } catch (e) {
        console.warn('[Worker] Failed to close Lua engine:', e);
    }
}

class OpfsTimelineWriter {
    private readonly encoder = new TextEncoder();
    private readonly cards = new Map<number, EvalTimelineCard>();
    private readonly decoderState = createTimelineDecoderState();
    private readonly chunks: EvalTimelineStorage['chunks'] = [];
    private offset = 0;
    private failed = false;
    private closed = false;

    private constructor(
        private readonly directory: any,
        private readonly file: string,
        private readonly access: any,
    ) {}

    static async create(requestId: number): Promise<OpfsTimelineWriter | null> {
        try {
            const storage = (navigator as any).storage;
            if (!storage?.getDirectory) return null;
            const root = await storage.getDirectory();
            const directory = await root.getDirectoryHandle(TIMELINE_DIRECTORY, { create: true });
            if (!timelineDirectoryPrepared) {
                timelineDirectoryPrepared = true;
                const staleBefore = Date.now() - 24 * 60 * 60 * 1000;
                for await (const [name, entry] of directory.entries()) {
                    if (entry.kind !== 'file') continue;
                    const file = await entry.getFile();
                    if (file.lastModified < staleBefore) await directory.removeEntry(name);
                }
            }
            const suffix = typeof crypto.randomUUID === 'function'
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            const file = `timeline-${requestId}-${suffix}.json`;
            const handle = await directory.getFileHandle(file, { create: true });
            const access = await handle.createSyncAccessHandle();
            access.truncate(0);
            return new OpfsTimelineWriter(directory, file, access);
        } catch (error) {
            console.warn('[Timeline] OPFS streaming is unavailable:', error);
            return null;
        }
    }

    addCard(uid: number, id: string, slot?: number, permanent?: boolean) {
        this.cards.set(uid, {
            uid,
            id,
            slot: typeof slot === 'number' ? slot : undefined,
            permanent: permanent || undefined,
        });
    }

    write(payload: string, firstEvent: number, eventCount: number): boolean {
        if (this.failed || this.closed) return false;
        try {
            const compactEvents = JSON.parse(payload);
            const checkpoint = cloneTimelineDecoderState(this.decoderState);
            const advanced = advanceCompactTimelineState(
                compactEvents,
                this.cards,
                this.decoderState,
                firstEvent,
                false,
            );
            const bytes = this.encoder.encode(payload);
            let written = 0;
            while (written < bytes.length) {
                const count = this.access.write(bytes.subarray(written), { at: this.offset + written });
                if (!Number.isFinite(count) || count <= 0) throw new Error('OPFS write returned no progress');
                written += count;
            }
            this.chunks.push({
                offset: this.offset,
                length: bytes.length,
                first_event: firstEvent,
                event_count: eventCount,
                first_timeline_id: advanced.firstTimelineId,
                last_timeline_id: advanced.lastTimelineId,
                checkpoint,
            });
            this.offset += bytes.length;
            return true;
        } catch (error) {
            this.failed = true;
            console.warn('[Timeline] Failed to stream a timeline chunk:', error);
            return false;
        }
    }

    finish(totalEvents: number): EvalTimelineStorage | null {
        if (this.closed) return null;
        this.closed = true;
        try {
            if (this.failed) return null;
            this.access.flush();
            return {
                kind: 'opfs-compact-v1',
                directory: TIMELINE_DIRECTORY,
                file: this.file,
                chunks: this.chunks,
                total_events: totalEvents,
                total_bytes: this.offset,
            };
        } finally {
            this.access.close();
        }
    }

    async abort() {
        if (!this.closed) {
            this.closed = true;
            try { this.access.close(); } catch {}
        }
        try {
            await this.directory.removeEntry(this.file);
        } catch (error: any) {
            if (error?.name !== 'NotFoundError') console.warn('[Timeline] Failed to discard timeline file:', error);
        }
    }
}

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
    const { type, data, options, id, mod_appends, active_mods, vfs } = e.data;

    if (type === 'EVALUATE') {
        let timelineWriter: OpfsTimelineWriter | null = null;
        let timelineCommitted = false;
        try {
            // 构造环境模拟逻辑 (和后端 server.py 保持一致)
            const activeModsList = active_mods || [];
            const allModIdsJson = JSON.stringify(activeModsList).replace(/\[/g, '{').replace(/\]/g, '}');

            const mockLuaLines = [
                "-- Environment simulation and Mod ID Placeholder Fixer",
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
                "function EntityGetIsAlive(ent) return true end",
                "",
                "-- TWWE Placeholder Fixer (Sync with server.py)",
                "local _TWWE_VFS = _TWWE_VFS or {}",
                `local _TWWE_ACTIVE_MODS = ${allModIdsJson}`,
                "local _old_MTFGC = ModTextFileGetContent",
                "function ModTextFileGetContent(filename)",
                "    if not filename then return nil end",
                "    local actual_filename = filename",
                "    ",
                "    -- 1. 修复文件名中的占位符",
                "    if actual_filename:find('__MOD_') or actual_filename:find('___') then",
                "        for _, mid in ipairs(_TWWE_ACTIVE_MODS) do",
                "            if type(mid) ~= 'string' then goto continue end",
                "            local mp = 'mods/' .. mid .. '/'",
                "            local test_name = actual_filename:gsub('___', mid .. '_')",
                "            test_name = test_name:gsub('__MOD_NAME__', mid)",
                "            test_name = test_name:gsub('__MOD_FILES__', mp .. 'files/')",
                "            test_name = test_name:gsub('__MOD_ACTIONS__', mp .. 'files/actions/')",
                "            test_name = test_name:gsub('__MOD_LIBS__', mp .. 'libs/')",
                "            test_name = test_name:gsub('__MOD_ACTION_UTILS__', mp .. 'files/action_utils/')",
                "            ",
                "            if _TWWE_VFS[test_name] or _old_MTFGC(test_name) then",
                "                actual_filename = test_name",
                "                break",
                "            end",
                "            ::continue::",
                "        end",
                "    end",
                "",
                "    local content = _old_MTFGC(actual_filename)",
                "    if not content or type(content) ~= 'string' then return content end",
                "",
                "    -- 2. 修复内容中的占位符",
                "    local mod_id = nil",
                "    if actual_filename:sub(1, 5) == 'mods/' then",
                "        local next_slash = actual_filename:find('/', 6)",
                "        if next_slash then mod_id = actual_filename:sub(6, next_slash - 1) end",
                "    end",
                "    ",
                "    if not mod_id then mod_id = _TWWE_ACTIVE_MODS[1] end",
                "",
                "    if mod_id and not actual_filename:find('twwe_mock') then",
                "        local prefix = mod_id .. '_'",
                "        local mp = 'mods/' .. mod_id .. '/'",
                "        content = content:gsub('___', prefix)",
                "        content = content:gsub('__MOD_NAME__', mod_id)",
                "        content = content:gsub('__MOD_FILES__', mp .. 'files/')",
                "        content = content:gsub('__MOD_ACTIONS__', mp .. 'files/actions/')",
                "        content = content:gsub('__MOD_LIBS__', mp .. 'libs/')",
                "        content = content:gsub('__MOD_ACTION_UTILS__', mp .. 'files/action_utils/')",
                "    end",
                "    ",
                "    return content",
                "end",
                "",
                "function ModDoesFileExist(filename)",
                "    local c = ModTextFileGetContent(filename)",
                "    return c ~= nil and c ~= ''",
                "end",
                "",
                "local _TWWE_WRITTEN_FILES_OWNER = {}",
                "local _old_MTFSC = ModTextFileSetContent",
                "function ModTextFileSetContent(filename, content)",
                "    if _old_MTFSC then return _old_MTFSC(filename, content) end",
                "end",
                "",
                "function ModTextFileWhoSetContent(filename)",
                "    return _TWWE_WRITTEN_FILES_OWNER[filename] or _TWWE_ACTIVE_MODS[1] or ''",
                "end",
                "",
                "-- 对齐 ModLuaFileAppend，它在模拟器内部维护 append_map",
                "ModLuaFileAppend = ModLuaFileAppend"
            ];

            if (options.simulateLowHp) mockLuaLines.unshift("_TWWE_LOW_HP = true");
            if (options.simulateManyEnemies) mockLuaLines.unshift("_TWWE_MANY_ENEMIES = true");
            if (options.simulateManyProjectiles) mockLuaLines.unshift("_TWWE_MANY_PROJECTILES = true");

            // 注入动态 VFS
            const customVFS: Record<string, string> = {
                'mods/twwe_mock/init.lua': mockLuaLines.join('\n')
            };

            // Inject mod appends
            if (mod_appends) {
                Object.entries(mod_appends).forEach(([path, content], i) => {
                    // Skip if it's already in the provided vfs to avoid duplication
                    // but usually appends are special
                    if (vfs && vfs[path]) {
                        // If it's already in VFS, we might want to use the VFS version or the appends version
                    }
                    let processedContent = content as string;
                    const fileName = `gen_${i}.lua`;

                    // Placeholder pre-processing (Sync with server.py logic)
                    if (processedContent.includes('___') || processedContent.includes('__MOD_')) {
                        let mod_id = 'unknown';
                        if (path.startsWith('mods/')) {
                            const parts = path.split('/');
                            if (parts.length > 1) mod_id = parts[1];
                        }
                        if (mod_id !== 'unknown') {
                            processedContent = processedContent.replace(/___/g, mod_id + '_');
                            processedContent = processedContent.replace(/__MOD_NAME__/g, mod_id);
                            processedContent = processedContent.replace(/__MOD_FILES__/g, `mods/${mod_id}/files/`);
                            processedContent = processedContent.replace(/__MOD_ACTIONS__/g, `mods/${mod_id}/files/actions/`);
                            processedContent = processedContent.replace(/__MOD_LIBS__/g, `mods/${mod_id}/libs/`);
                            processedContent = processedContent.replace(/__MOD_ACTION_UTILS__/g, `mods/${mod_id}/files/action_utils/`);
                        }
                    }

                    customVFS[`mods/twwe_mock/${fileName}`] = processedContent;
                    // 核心修复：始终追加到 gun_actions.lua，因为这些是 captured appends
                    mockLuaLines.push(`ModLuaFileAppend("data/scripts/gun/gun_actions.lua", "mods/twwe_mock/${fileName}")`);
                });
            }

            // Inject provided VFS files from the bundle into Lua's _TWWE_VFS
            if (vfs) {
                Object.entries(vfs).forEach(([vPath, vContent]) => {
                    customVFS[vPath] = vContent as string;
                    // 转义 Lua 字符串
                    const safeContent = (vContent as string)
                        .replace(/\\/g, '\\\\')
                        .replace(/"/g, '\\"')
                        .replace(/\n/g, '\\n')
                        .replace(/\r/g, '\\r');
                    mockLuaLines.push(`_TWWE_VFS["${vPath}"] = "${safeContent}"`);
                });
                customVFS['mods/twwe_mock/init.lua'] = mockLuaLines.join('\n');
            }

            // Inject provided VFS files from the bundle
            if (vfs) {
                Object.entries(vfs).forEach(([path, content]) => {
                    customVFS[path] = content as string;
                });
            }

            // 释放上一次评估残留的引擎（防御性：正常路径已由 finally 释放）
            if (lua) {
                closeLuaEngine(lua);
                lua = null;
            }
            lua = await getNewLuaEngine(customVFS);
            const timelineEnabled = (options as any).timelineEnabled !== false;
            const requestedTimelineLimit = Number((options as any).timelineEventLimit ?? DEFAULT_TIMELINE_EVENT_LIMIT);
            const timelineEventLimit = Number.isFinite(requestedTimelineLimit)
                ? Math.max(0, Math.floor(requestedTimelineLimit))
                : DEFAULT_TIMELINE_EVENT_LIMIT;
            const requestedChunkSize = Number((options as any).timelineChunkSize ?? DEFAULT_TIMELINE_CHUNK_SIZE);
            const timelineChunkSize = Number.isFinite(requestedChunkSize)
                ? Math.max(100, Math.floor(requestedChunkSize))
                : DEFAULT_TIMELINE_CHUNK_SIZE;
            if (timelineEnabled && (options as any).timelineStream !== false) {
                timelineWriter = await OpfsTimelineWriter.create(id);
            }
            lua.global.set('_TWWE_TIMELINE_EVENT_LIMIT', timelineEventLimit);
            lua.global.set('_TWWE_TIMELINE_CHUNK_SIZE', timelineChunkSize);
            if (timelineWriter) {
                lua.global.set('_TWWE_TIMELINE_CARD', (
                    uid: number,
                    cardId: string,
                    slot?: number,
                    permanent?: boolean,
                ) => {
                    timelineWriter?.addCard(uid, cardId, slot, permanent);
                });
                lua.global.set('_TWWE_TIMELINE_FLUSH', (
                    payload: string,
                    firstEvent: number,
                    eventCount: number,
                ) => timelineWriter?.write(payload, firstEvent, eventCount) === true);
            }
            lua.global.set('_TWWE_INCREMENTAL_FOLD', (options as any).incrementalFold !== false);

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
                '-tl', timelineEnabled ? 'true' : 'false',
                '-md', 'twwe_mock', // 启用 Mock Mod
            ];

            // Add active mods to support VFS searching in worker
            if (active_mods) {
                active_mods.forEach((m: string) => {
                    if (m && typeof m === 'string' && !luaArgs.includes(m)) luaArgs.push(m);
                });
            }

            if (options.stopAtRecharge) {
                luaArgs.push('-sr', 'true');
            }

            let seedToUse = options.evaluationSeed;
            if (data.evaluation_seed !== undefined) {
                seedToUse = data.evaluation_seed;
            }

            if (seedToUse !== undefined && seedToUse !== null && seedToUse !== "") {
                luaArgs.push('-se', formatLuaArg(seedToUse));
            }

            if (options.foldNodes === false) {
                luaArgs.push('-f');
            }

            // Perks (Extra Modifiers) support
            if (options.perks) {
                const perkList = Object.entries(options.perks as Record<string, number>)
                    .flatMap(([id, count]) => Array.from({ length: count as number }, () => id));
                if (perkList.length > 0) {
                    luaArgs.push('-pk', ...perkList);
                }
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
            if (!timelineEnabled) {
                delete result.timeline;
                result.timeline_disabled = true;
            } else if (result.timeline) {
                const totalEvents = Number(result.timeline.total_events || result.timeline.events?.length || 0);
                const storage = result.timeline.streamed && timelineWriter
                    ? timelineWriter.finish(totalEvents)
                    : null;
                if (storage) {
                    result.timeline.storage = storage;
                    result.timeline.complete = true;
                    result.timeline.truncated = false;
                    timelineCommitted = true;
                } else {
                    result.timeline.complete = !result.timeline.truncated
                        && totalEvents <= (result.timeline.events?.length || 0);
                }
                delete result.timeline.streamed;
            }
            // 还原增量 piles。在 worker 侧做，让主线程拿到的结构与旧格式一致。
            // 未变化的事件共享同一份 piles 引用，结构化克隆会保留这种别名关系，
            // 因此不会在传递时被重新展开成多份副本。
            rehydrateTimelinePiles(result);
            self.postMessage({ type: 'RESULT', data: result, id });

        } catch (err: any) {
            console.error('[Worker Error]', err);
            self.postMessage({ type: 'ERROR', error: err.message, id });
        } finally {
            // 关键：无论成功或失败都必须释放 Lua state，否则 WASM 堆单调增长
            closeLuaEngine(lua);
            lua = null;
            if (timelineWriter && !timelineCommitted) await timelineWriter.abort();
        }
    }
};
