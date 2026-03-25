-- backend/import_helper.lua
local mode = arg[1]
local input_file = arg[2]

-- Add search paths for libraries
local base_dir = "./"
package.path = package.path .. ";" .. base_dir .. "spell_lab_shugged/files/lib/?.lua"
package.path = package.path .. ";" .. base_dir .. "wand_editor/files/libs/?.lua"

local smallfolk = nil
if mode == "spell-lab" then
    smallfolk = require("smallfolk")
end

local function table_to_json(t)
    if t == nil then return "null" end
    if type(t) == "number" or type(t) == "boolean" then return tostring(t) end
    if type(t) == "string" then 
        return '"' .. t:gsub('\\', '\\\\'):gsub('"', '\\"'):gsub("\n", "\\n"):gsub("\r", "") .. '"' 
    end
    local parts = {}
    
    -- Check if it's an array
    local is_arr = true
    local max_idx = 0
    local count = 0
    for k, v in pairs(t) do
        count = count + 1
        if type(k) ~= "number" or k < 1 or math.floor(k) ~= k then
            is_arr = false
            break
        end
        if k > max_idx then max_idx = k end
    end
    if is_arr and max_idx > 0 and max_idx > count * 2 then is_arr = false end -- heuristic for sparse arrays

    if is_arr and count > 0 then
        for i=1, max_idx do 
            table.insert(parts, table_to_json(t[i])) 
        end
        return "[" .. table.concat(parts, ",") .. "]"
    else
        for k, v in pairs(t) do
            local key = tostring(k)
            table.insert(parts, '"' .. key .. '":' .. table_to_json(v))
        end
        return "{" .. table.concat(parts, ",") .. "}"
    end
end

local f = io.open(input_file, "r")
if not f then
    print("null")
    return
end
local content = f:read("*all")
f:close()

if mode == "wand-editor" then
    local func, err = loadstring(content)
    if func then
        local status, result = pcall(func)
        if status then
            print(table_to_json(result))
        else
            io.stderr:write("Error executing wand-editor data: " .. tostring(result) .. "\n")
            print("null")
        end
    else
        io.stderr:write("Error loading wand-editor data: " .. tostring(err) .. "\n")
        print("null")
    end
elseif mode == "spell-lab" then
    local status, result = pcall(smallfolk.loads, content)
    if status then
        print(table_to_json(result))
    else
        io.stderr:write("Error loading spell-lab data: " .. tostring(result) .. "\n")
        print("null")
    end
end
