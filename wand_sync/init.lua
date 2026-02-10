-- wand_sync/init.lua
local WAND_EDITOR_PATH = "mods/wand_editor/"
function ws_log(msg) print("[WandSync] " .. tostring(msg)) end

package.cpath = package.cpath .. ";./" .. WAND_EDITOR_PATH .. "files/module/?.dll;./" .. WAND_EDITOR_PATH .. "files/module/socket/?.dll"
package.path = package.path .. ";./" .. WAND_EDITOR_PATH .. "files/socket_lua/?.lua;./" .. WAND_EDITOR_PATH .. "files/socket_lua/socket/?.lua"

local effil = require("effil")
local Cpp = nil
pcall(function() Cpp = require("WandEditorDll") end)

local game_root = "."
if Cpp and Cpp.CurrentPath then game_root = Cpp.CurrentPath() end
ws_log("Game root identified: " .. game_root)

local sync_channel = effil.channel()
local response_channel = effil.channel()

local function table_to_json(t)
    if t == nil then return "null" end
    if type(t) == "number" or type(t) == "boolean" then return tostring(t) end
    if type(t) == "string" then 
        return '"' .. t:gsub('\\', '\\\\'):gsub('"', '\\"'):gsub("\n", "\\n"):gsub("\r", "\\r"):gsub("\t", "\\t") .. '"' 
    end
    local parts = {}
    local is_arr = false
    if t[1] ~= nil then is_arr = true end
    if is_arr then
        for i=1, #t do table.insert(parts, table_to_json(t[i])) end
        return "[" .. table.concat(parts, ",") .. "]"
    else
        for k, v in pairs(t) do 
            table.insert(parts, '"' .. tostring(k) .. '":' .. table_to_json(v)) 
        end
        return "{" .. table.concat(parts, ",") .. "}"
    end
end

local function parse_json(s)
    if not s or s == "" then return nil end
    local p = s:gsub('null', 'nil'):gsub('%[', '{'):gsub('%]', '}'):gsub('"([^"]-)":', '["%1"]=')
    local f = loadstring("return " .. p)
    if f then 
        local ok, res = pcall(f)
        if ok then return res end
    end
    return nil
end

local function server_thread_func(chan, resp_chan, pkg_path, pkg_cpath, root_path)
    package.path = pkg_path; package.cpath = pkg_cpath
    local socket = require("socket")
    local server = socket.tcp()
    server:setoption("reuseaddr", true)
    if not server:bind("127.0.0.1", 12345) then return end
    server:listen(5); server:settimeout(0)
    local function safe_send(client, data)
        local total = #data
        local sent = 0
        while sent < total do
            local s, err, last = client:send(data, sent + 1)
            if s then
                sent = s
            elseif err == "timeout" then
                sent = last
            else
                return false, err
            end
        end
        return true
    end

    while true do
        local client = server:accept()
        if client then
            client:settimeout(5) -- 增加超时时间到 5s
            local line = client:receive("*l")
            if line == "GET_ALL_WANDS" then
                chan:push("REQUEST_FETCH")
                safe_send(client, (resp_chan:pop(2) or "{}") .. "\n")
            elseif line == "GET_WAND_EDITOR_DATA" then
                chan:push("REQUEST_WAND_EDITOR")
                safe_send(client, (resp_chan:pop(2) or "{}") .. "\n")
            elseif line == "GET_SPELL_LAB_DATA" then
                chan:push("REQUEST_SPELL_LAB")
                safe_send(client, (resp_chan:pop(2) or "{}") .. "\n")
            elseif line == "GET_ALL_SPELLS" then
                chan:push("REQUEST_ALL_SPELLS")
                safe_send(client, (resp_chan:pop(15) or "[]") .. "\n")
            elseif line == "GET_MOD_APPENDS" then
                chan:push("REQUEST_MOD_APPENDS")
                safe_send(client, (resp_chan:pop(15) or "{}") .. "\n")
            elseif line == "GET_ACTIVE_MODS" then
                chan:push("REQUEST_ACTIVE_MODS")
                safe_send(client, (resp_chan:pop(2) or "[]") .. "\n")
            elseif line == "GET_GAME_INFO" then
                safe_send(client, '{"root":"' .. root_path:gsub("\\", "/") .. '"}\n')
            elseif line then
                chan:push("DATA:" .. line)
                safe_send(client, "OK\n")
            end
            client:close()
        end
        require("effil").sleep(0.05)
    end
end
effil.thread(server_thread_func)(sync_channel, response_channel, package.path, package.cpath, game_root)

local function GetWandAtSlot(slot)
    local p = EntityGetWithTag("player_unit")[1]
    if not p then return nil end
    local inv = nil
    for _, c in ipairs(EntityGetAllChildren(p) or {}) do if EntityGetName(c) == "inventory_quick" then inv = c break end end
    if not inv then return nil end
    for _, item in ipairs(EntityGetAllChildren(inv) or {}) do
        local ic = EntityGetFirstComponentIncludingDisabled(item, "ItemComponent")
        if ic and ComponentGetValue2(ic, "inventory_slot") == (slot - 1) then return item end
    end
    return nil
end

local function serialize_wand(w)
    local ab = EntityGetFirstComponentIncludingDisabled(w, "AbilityComponent")
    if not ab then return nil end

    local appearance = {}
    local sprite_file = ComponentGetValue2(ab, "sprite_file")
    appearance.sprite = sprite_file

    local item_comp = EntityGetFirstComponentIncludingDisabled(w, "ItemComponent")
    if item_comp then
        appearance.name = ComponentGetValue2(item_comp, "item_name")
    end

    -- 尝试获取 SpriteComponent (tag="item") 上的 image_file (PNG 路径)
    -- 这比 AbilityComponent.sprite_file (XML) 更适合直接在前端显示
    local all_sprites = EntityGetComponentIncludingDisabled(w, "SpriteComponent") or {}
    for _, sc in ipairs(all_sprites) do
        local tags = ComponentGetTags(sc)
        if tags and string.find(tags, "item") then
            local img = ComponentGetValue2(sc, "image_file")
            if img and img ~= "" then
                appearance.item_sprite = img
            end
            break
        end
    end

    local data = {
        mana_max = ComponentGetValue2(ab, "mana_max"),
        mana_charge_speed = ComponentGetValue2(ab, "mana_charge_speed"),
        reload_time = ComponentObjectGetValue2(ab, "gun_config", "reload_time"),
        fire_rate_wait = ComponentObjectGetValue2(ab, "gunaction_config", "fire_rate_wait"),
        deck_capacity = ComponentObjectGetValue2(ab, "gun_config", "deck_capacity"),
        shuffle_deck_when_empty = ComponentObjectGetValue2(ab, "gun_config", "shuffle_deck_when_empty"),
        spread_degrees = ComponentObjectGetValue2(ab, "gunaction_config", "spread_degrees"),
        speed_multiplier = ComponentObjectGetValue2(ab, "gunaction_config", "speed_multiplier"),
        actions_per_round = ComponentObjectGetValue2(ab, "gun_config", "actions_per_round") or 1,
        spells = {}, always_cast = {}
    }
    data.appearance = appearance

    for _, c in ipairs(EntityGetAllChildren(w) or {}) do
        local ac = EntityGetFirstComponentIncludingDisabled(c, "ItemActionComponent")
        local ic = EntityGetFirstComponentIncludingDisabled(c, "ItemComponent")
        if ac and ic then
            local id = ComponentGetValue2(ac, "action_id")
            if ComponentGetValue2(ic, "permanently_attached") then table.insert(data.always_cast, id)
            else local x, y = ComponentGetValue2(ic, "inventory_slot"); data.spells[tostring(x+1)] = id end
        end
    end
    return data
end

local function ApplyFullWand(w, data)
    local ab = EntityGetFirstComponentIncludingDisabled(w, "AbilityComponent")
    if not ab then return end
    if data.mana_max then ComponentSetValue2(ab, "mana_max", tonumber(data.mana_max)) ComponentSetValue2(ab, "mana", tonumber(data.mana_max)) end
    if data.mana_charge_speed then ComponentSetValue2(ab, "mana_charge_speed", tonumber(data.mana_charge_speed)) end
    if data.reload_time then ComponentObjectSetValue2(ab, "gun_config", "reload_time", tonumber(data.reload_time)) end
    if data.fire_rate_wait then ComponentObjectSetValue2(ab, "gunaction_config", "fire_rate_wait", tonumber(data.fire_rate_wait)) end
    if data.deck_capacity then ComponentObjectSetValue2(ab, "gun_config", "deck_capacity", tonumber(data.deck_capacity)) end
    if data.shuffle_deck_when_empty ~= nil then ComponentObjectSetValue2(ab, "gun_config", "shuffle_deck_when_empty", data.shuffle_deck_when_empty) end
    if data.spread_degrees then ComponentObjectSetValue2(ab, "gunaction_config", "spread_degrees", tonumber(data.spread_degrees)) end
    if data.speed_multiplier then ComponentObjectSetValue2(ab, "gunaction_config", "speed_multiplier", tonumber(data.speed_multiplier)) end
    if data.actions_per_round then ComponentObjectSetValue2(ab, "gun_config", "actions_per_round", tonumber(data.actions_per_round)) end
    
    if data.appearance then
        local app = data.appearance
        if app.sprite then
            ComponentSetValue2(ab, "sprite_file", app.sprite)
        end
        if app.name then
            local ic = EntityGetFirstComponentIncludingDisabled(w, "ItemComponent")
            if ic then
                ComponentSetValue2(ic, "item_name", app.name)
                ComponentSetValue2(ic, "always_use_item_name_in_ui", true)
            end
        end
        if app.item_sprite then
            local sc = EntityGetFirstComponentIncludingDisabled(w, "SpriteComponent", "item")
            if sc then
                ComponentSetValue2(sc, "image_file", app.item_sprite)
            end
        end
        EntityRefreshSprite(w, EntityGetFirstComponentIncludingDisabled(w, "SpriteComponent", "item"))
    end

    if data.spells or data.always_cast then
        for _, c in ipairs(EntityGetAllChildren(w) or {}) do if EntityHasTag(c, "card_action") then EntityKill(c) end end
        if data.always_cast then
            for i, id in ipairs(data.always_cast) do
                local s = CreateItemActionEntity(id)
                if s then
                    local ic = EntityGetFirstComponentIncludingDisabled(s, "ItemComponent")
                    ComponentSetValue2(ic, "permanently_attached", true); ComponentSetValue2(ic, "inventory_slot", 0, i)
                    EntityAddChild(w, s)
                end
            end
        end
        if data.spells then
            for i, id in pairs(data.spells) do
                if id and id ~= "null" then
                    local s = CreateItemActionEntity(id)
                    if s then
                        local ic = EntityGetFirstComponentIncludingDisabled(s, "ItemComponent")
                        ComponentSetValue2(ic, "inventory_slot", tonumber(i)-1, 0)
                        EntityAddChild(w, s)
                    end
                end
            end
        end
    end
    local p = EntityGetWithTag("player_unit")[1]
    if p then local i2 = EntityGetFirstComponent(p, "Inventory2Component"); if i2 then ComponentSetValue2(i2, "mForceRefresh", true) end end
end

function OnWorldPostUpdate()
    local msg = sync_channel:pop(0)
    if msg == "REQUEST_FETCH" then
        local all = {}
        for i=1, 4 do local w = GetWandAtSlot(i); if w then all[tostring(i)] = serialize_wand(w) end end
        response_channel:push(table_to_json(all))
    elseif msg == "REQUEST_WAND_EDITOR" then
        local pages = {}
        local idx = 1
        while true do
            -- Try both with and without mod prefix
            local val = ModSettingGet("wand_editor.wand_editorWandDepot" .. tostring(idx)) or ModSettingGet("wand_editorWandDepot" .. tostring(idx))
            if val then
                table.insert(pages, val)
                idx = idx + 1
            else
                break
            end
        end
        response_channel:push(table_to_json(pages))
    elseif msg == "REQUEST_SPELL_LAB" then
        local data = {}
        -- Spell Lab Shugged
        local max_idx = ModSettingGet("spell_lab_shugged.spell_lab_shugged.wand_box_page_max_index") or ModSettingGet("spell_lab_shugged.wand_box_page_max_index")
        if max_idx then
            data.shugged = {}
            for i = 1, max_idx do
                local val = ModSettingGet("spell_lab_shugged.spell_lab_shugged.wand_box_page_" .. tostring(i)) or ModSettingGet("spell_lab_shugged.wand_box_page_" .. tostring(i))
                if val then table.insert(data.shugged, val) end
            end
        end
        -- Original Spell Lab
        local orig = ModSettingGet("spell_lab.spell_lab_saved_wands") or ModSettingGet("spell_lab_saved_wands")
        if orig then data.original = orig end
        
        response_channel:push(table_to_json(data))
    elseif msg == "REQUEST_ALL_SPELLS" then
        ws_log("Processing REQUEST_ALL_SPELLS with deep analysis...")
        if not actions then
            dofile("data/scripts/gun/gun_enums.lua")
            dofile("data/scripts/gun/gun_actions.lua")
        end

        -- 模拟 wand_editor 的环境抓取法术属性
        local dummy_c = {}
        local function reset_c()
            dummy_c = {
                fire_rate_wait = 0,
                reload_time = 0,
                spread_degrees = 0,
                speed_multiplier = 1,
                mana_max = 0,
                mana_charge_speed = 0,
                extra_entities = "",
            }
        end
        
        -- 临时替换全局变量和危险函数以防同步时触发法术效果
        local old_c = c
        local old_shot_effects = shot_effects
        local old_GlobalsSetValue = GlobalsSetValue
        local old_StartReload = StartReload
        local old_GamePrint = GamePrint
        local old_GamePrintImportant = GamePrintImportant
        local old_GameScreenshake = GameScreenshake
        local old_PlaySound = PlaySound
        local old_reflecting = reflecting
        
        -- 劫持所有可能产生实体的底层 API
        local old_EntityLoad = EntityLoad
        local old_EntityLoadCameraBound = EntityLoadCameraBound
        local old_EntityLoadToEntity = EntityLoadToEntity
        local old_EntityLoadEndGameItem = EntityLoadEndGameItem
        local old_EntityCreateNew = EntityCreateNew
        local old_EntityAddChild = EntityAddChild
        local old_EntityAddComponent = EntityAddChild
        local old_EntityInflictDamage = EntityInflictDamage
        local old_add_projectile = add_projectile
        local old_add_projectile_trigger_timer = add_projectile_trigger_timer
        local old_add_projectile_trigger_hit_world = add_projectile_trigger_hit_world
        local old_add_projectile_trigger_death = add_projectile_trigger_death
        local old_GameShootProjectile = GameShootProjectile
        local old_CreateItemActionEntity = CreateItemActionEntity

        -- 定义更聪明的 Stub 函数
        local function dummy_id() return 12345678 end
        local function dummy_table() return {12345678} end
        local dummy_fn = function() end
        
        -- 核心环境隔离
        c = dummy_c
        shot_effects = {}
        reflecting = true 
        WAND_EDITOR_RELEFCTING = true -- 很多 Mod 识别这个
        
        -- 全局屏蔽
        GlobalsSetValue = dummy_fn
        GamePrint = dummy_fn
        GamePrintImportant = dummy_fn
        GameScreenshake = dummy_fn
        PlaySound = dummy_fn
        
        -- 实体操作屏蔽（返回假 ID 避免脚本报错）
        EntityLoad = dummy_id
        EntityLoadCameraBound = dummy_id
        EntityLoadToEntity = dummy_id
        EntityLoadEndGameItem = dummy_id
        EntityCreateNew = dummy_id
        EntityAddChild = dummy_id
        EntityAddComponent = dummy_id
        EntityInflictDamage = dummy_fn
        add_projectile = dummy_fn
        add_projectile_trigger_timer = dummy_fn
        add_projectile_trigger_hit_world = dummy_fn
        add_projectile_trigger_death = dummy_fn
        GameShootProjectile = dummy_fn
        CreateItemActionEntity = dummy_id
        
        -- 抓取 StartReload
        local temp_reload = 0
        StartReload = function(reload_time)
            temp_reload = reload_time
        end

        local old_draw_actions = draw_actions
        draw_actions = dummy_fn
        
        local all_actions = {}
        for _, a in ipairs(actions or {}) do
            if a and a.id then
                reset_c()
                temp_reload = 0
                -- 执行 action
                if a.action and type(a.action) == "function" then
                    -- 给 action 传入一个假的卡牌对象，模仿游戏内的调用
                    local dummy_card = { 
                        id = a.id, 
                        custom_xml_file = a.custom_xml_file,
                        mana = a.mana,
                        action = a.action
                    }
                    pcall(a.action, dummy_card)
                end

                table.insert(all_actions, {
                    id = a.id,
                    name = GameTextGetTranslatedOrNot(a.name or ""),
                    sprite = a.sprite or "",
                    type = a.type or 0,
                    max_uses = a.max_uses or -1,
                    mana = a.mana or 0,
                    fire_rate_wait = dummy_c.fire_rate_wait,
                    reload_time = dummy_c.reload_time ~= 0 and dummy_c.reload_time or temp_reload,
                    spread_degrees = dummy_c.spread_degrees,
                    speed_multiplier = dummy_c.speed_multiplier,
                    custom_xml_file = a.custom_xml_file,
                    never_unlimited = a.never_unlimited or false
                })
            end
        end
        
        -- 彻底还原
        c = old_c
        shot_effects = old_shot_effects
        reflecting = old_reflecting
        WAND_EDITOR_RELEFCTING = nil
        GlobalsSetValue = old_GlobalsSetValue
        StartReload = old_StartReload
        GamePrint = old_GamePrint
        GamePrintImportant = old_GamePrintImportant
        GameScreenshake = old_GameScreenshake
        PlaySound = old_PlaySound
        
        EntityLoad = old_EntityLoad
        EntityLoadCameraBound = old_EntityLoadCameraBound
        EntityLoadToEntity = old_EntityLoadToEntity
        EntityLoadEndGameItem = old_EntityLoadEndGameItem
        EntityCreateNew = old_EntityCreateNew
        EntityAddChild = old_EntityAddChild
        EntityAddComponent = old_EntityAddComponent
        EntityInflictDamage = old_EntityInflictDamage
        add_projectile = old_add_projectile
        add_projectile_trigger_timer = old_add_projectile_trigger_timer
        add_projectile_trigger_hit_world = old_add_projectile_trigger_hit_world
        add_projectile_trigger_death = old_add_projectile_trigger_death
        GameShootProjectile = old_GameShootProjectile
        CreateItemActionEntity = old_CreateItemActionEntity
        draw_actions = old_draw_actions
        
        -- 获取当前的 Mod 追加信息
        local appends = ModLuaFileGetAppends("data/scripts/gun/gun_actions.lua") or {}
        local append_data = {}
        for _, path in ipairs(appends) do
            append_data[path] = ModTextFileGetContent(path) or ""
        end

        local response = {
            spells = all_actions,
            appends = append_data,
            active_mods = ModGetActiveModIDs() or {}
        }
        
        ws_log("Encoding " .. #all_actions .. " spells and " .. #appends .. " appends...")
        response_channel:push(table_to_json(response))
    elseif msg == "REQUEST_MOD_APPENDS" then
        local appends = ModLuaFileGetAppends("data/scripts/gun/gun_actions.lua") or {}
        local data = {}
        for _, path in ipairs(appends) do
            data[path] = ModTextFileGetContent(path)
        end
        response_channel:push(table_to_json(data))
    elseif msg == "REQUEST_ACTIVE_MODS" then
        response_channel:push(table_to_json(ModGetActiveModIDs() or {}))
    elseif msg and msg:sub(1,5) == "DATA:" then
        local data = parse_json(msg:sub(6))
        if data and not data.ping then
            local slot = tonumber(data.slot) or 1
            local w = GetWandAtSlot(slot)
            
            if data.delete then
                if w then EntityKill(w) end
            else
                if not w and slot <= 4 then
                    -- Try to spawn a new wand if it doesn't exist in the slot
                    local player = EntityGetWithTag("player_unit")[1]
                    if player then
                        local x, y = EntityGetTransform(player)
                        w = EntityLoad("data/entities/items/wand_level_01.xml", x, y)
                        
                        -- CRITICAL: Disable physics and sprites that cause "ghosts" at 0,0
                        local components = EntityGetAllComponents(w) or {}
                        for _, c in ipairs(components) do
                            local type_name = ComponentGetTypeName(c)
                            -- These components cause world-space rendering or physics bobbing
                            if type_name == "SpriteOffsetAnimComponent" or 
                               type_name == "VelocityComponent" or 
                               type_name == "SimplePhysicsComponent" or
                               type_name == "PhysicsBodyComponent" or
                               type_name == "LuaComponent" then
                                EntityRemoveComponent(w, c)
                            end
                        end

                        local ic = EntityGetFirstComponentIncludingDisabled(w, "ItemComponent")
                        if ic then
                            ComponentSetValue2(ic, "inventory_slot", slot - 1, 0)
                            ComponentSetValue2(ic, "is_on_floor", false)
                            ComponentSetValue2(ic, "is_pickable", false)
                            ComponentSetValue2(ic, "mItemIsInventoryItem", true)
                        end

                        -- Find quick inventory and force child attachment
                        local inv = nil
                        for _, c in ipairs(EntityGetAllChildren(player) or {}) do 
                            if EntityGetName(c) == "inventory_quick" then inv = c break end 
                        end
                        if inv then 
                            EntityAddChild(inv, w)
                            EntitySetTransform(w, 0, 0) 
                        end

                        -- Force refresh inventory UI
                        local i2 = EntityGetFirstComponent(player, "Inventory2Component")
                        if i2 then
                            ComponentSetValue2(i2, "mForceRefresh", true)
                        end
                    end
                end
                
                if w then ApplyFullWand(w, data) end
            end
        end
    end
end
ws_log("WandSync Ready!")
