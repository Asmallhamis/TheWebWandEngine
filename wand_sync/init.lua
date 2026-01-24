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
    if type(t) == "string" then return '"' .. t:gsub('\\', '\\\\'):gsub('"', '\\"'):gsub("\n", "\\n") .. '"' end
    local parts = {}
    local is_arr = false
    if t[1] ~= nil then is_arr = true end
    if is_arr then
        for i=1, #t do table.insert(parts, table_to_json(t[i])) end
        return "[" .. table.concat(parts, ",") .. "]"
    else
        for k, v in pairs(t) do table.insert(parts, '"' .. tostring(k) .. '":' .. table_to_json(v)) end
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
    while true do
        local client = server:accept()
        if client then
            client:settimeout(1)
            local line = client:receive("*l")
            if line == "GET_ALL_WANDS" then
                chan:push("REQUEST_FETCH")
                client:send((resp_chan:pop(2) or "{}") .. "\n")
            elseif line == "GET_GAME_INFO" then
                client:send('{"root":"' .. root_path:gsub("\\", "/") .. '"}\n')
            elseif line then
                chan:push("DATA:" .. line)
                client:send("OK\n")
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
