io.stdout:setvbuf("no")
dofile_once = dofile

local frame = 0
local next_entity = 100
local next_component = 100
local entities = {
    [1] = { name = "player", children = { 2 }, components = {} },
    [2] = { name = "inventory_quick", children = { 3 }, components = {} },
    [3] = { name = "wand", children = { 4 }, components = { AbilityComponent = 10, ItemComponent = 11, SpriteComponent = 12 } },
    [4] = { name = "spell", children = {}, components = { ItemActionComponent = 20, ItemComponent = 21 } },
}
local components = {
    [10] = {
        mana_max = 321, mana_charge_speed = 50, sprite_file = "data/items_gfx/wands/wand_0000.xml",
        gun_config = { reload_time = 30, deck_capacity = 8, shuffle_deck_when_empty = false, actions_per_round = 1 },
        gunaction_config = { fire_rate_wait = 10, spread_degrees = 0, speed_multiplier = 1 },
    },
    [11] = { item_name = "Standalone wand", inventory_slot = { 0, 0 } },
    [12] = { image_file = "data/items_gfx/wands/wand_0000.png" },
    [20] = { action_id = "LIGHT_BULLET" },
    [21] = { permanently_attached = false, inventory_slot = { 0, 0 } },
}

function GameGetFrameNum() return frame end
function GameIsPaused() return false end
function EntityGetWithTag()
    if os.getenv("TWWE_TEST_EMPTY") == "1" then return {} end
    return { 1 }
end
function EntityGetAllChildren(entity) return { unpack(entities[entity].children) } end
function EntityGetName(entity) return entities[entity].name end
function EntityGetFirstComponentIncludingDisabled(entity, component)
    return entities[entity].components[component]
end
EntityGetFirstComponent = EntityGetFirstComponentIncludingDisabled
function EntityGetComponentIncludingDisabled(entity, component)
    local component_id = EntityGetFirstComponentIncludingDisabled(entity, component)
    return component_id and { component_id } or {}
end
function ComponentGetValue2(component, field)
    local value = components[component][field]
    if type(value) == "table" then return unpack(value) end
    return value
end
function ComponentSetValue2(component, field, ...)
    local values = { ... }
    components[component][field] = #values > 1 and values or values[1]
end
function ComponentObjectGetValue2(component, object, field)
    return components[component][object][field]
end
function ComponentObjectSetValue2(component, object, field, value)
    components[component][object][field] = value
end
function ComponentGetTags() return "item" end
function EntityRefreshSprite() end
function EntityHasTag(entity, tag) return tag == "card_action" and entities[entity].name == "spell" end
function EntityKill(entity)
    for _, parent in pairs(entities) do
        for child_index = #parent.children, 1, -1 do
            if parent.children[child_index] == entity then table.remove(parent.children, child_index) end
        end
    end
    entities[entity] = nil
end
function CreateItemActionEntity(action_id)
    next_entity = next_entity + 1
    next_component = next_component + 2
    entities[next_entity] = {
        name = "spell", children = {},
        components = { ItemActionComponent = next_component, ItemComponent = next_component + 1 },
    }
    components[next_component] = { action_id = action_id }
    components[next_component + 1] = { permanently_attached = false, inventory_slot = { 0, 0 } }
    return next_entity
end
function EntityAddChild(parent, child) table.insert(entities[parent].children, child) end
function ModSettingGet() return nil end
function ModGetActiveModIDs() return { "wand_sync" } end
function ModLuaFileGetAppends() return {} end
function GameTextGetTranslatedOrNot(value) return value end
actions = {
    { id = "LIGHT_BULLET", name = "Spark bolt", sprite = "data/ui_gfx/gun_actions/light_bullet.png", type = 0, mana = 5 },
}

dofile("mods/wand_sync/init.lua")
local socket = require("socket")
local deadline = socket.gettime() + (tonumber(os.getenv("TWWE_TEST_SECONDS")) or 60)
print("WAND_SYNC_TEST_READY")
while socket.gettime() < deadline do
    frame = frame + 1
    OnWorldPostUpdate()
    socket.sleep(0.005)
end
