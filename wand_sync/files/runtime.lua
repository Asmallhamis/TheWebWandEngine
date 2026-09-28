local ffi = require("ffi")

assert(ffi.os == "Windows" and ffi.abi("32bit"), "Wand Sync requires Noita's 32-bit Windows LuaJIT runtime and unsafe mods enabled")

ffi.cdef[[
unsigned long __stdcall GetCurrentDirectoryW(unsigned long length, wchar_t *buffer);
int __stdcall WideCharToMultiByte(unsigned int code_page, unsigned long flags, const wchar_t *wide_string, int wide_length, char *buffer, int buffer_length, const char *default_char, int *used_default_char);
void * __stdcall LoadLibraryExW(const wchar_t *filename, void *file, unsigned long flags);
unsigned long __stdcall GetLastError(void);
]]

local root_capacity = ffi.C.GetCurrentDirectoryW(0, nil)
assert(root_capacity > 0, "Wand Sync could not determine the game directory")
local root_wide = ffi.new("wchar_t[?]", root_capacity)
local root_length = ffi.C.GetCurrentDirectoryW(root_capacity, root_wide)
assert(root_length > 0 and root_length < root_capacity, "Wand Sync could not read the game directory")

local utf8_length = ffi.C.WideCharToMultiByte(65001, 0, root_wide, root_length, nil, 0, nil, nil)
assert(utf8_length > 0, "Wand Sync could not encode the game directory")
local root_utf8 = ffi.new("char[?]", utf8_length)
assert(ffi.C.WideCharToMultiByte(65001, 0, root_wide, root_length, root_utf8, utf8_length, nil, nil) == utf8_length, "Wand Sync could not encode the game directory")
local game_root = ffi.string(root_utf8, utf8_length):gsub("\\", "/")

for _, filename in ipairs({ "vcruntime140.dll", "msvcp140.dll" }) do
    local suffix = "\\mods\\wand_sync\\files\\module\\" .. filename
    local library_path = ffi.new("wchar_t[?]", root_length + #suffix + 1)
    ffi.copy(library_path, root_wide, root_length * ffi.sizeof("wchar_t"))
    for character_index = 1, #suffix do
        library_path[root_length + character_index - 1] = suffix:byte(character_index)
    end
    local handle = ffi.C.LoadLibraryExW(library_path, nil, 8)
    assert(handle ~= nil, "Wand Sync could not load " .. filename .. " (Windows error " .. tonumber(ffi.C.GetLastError()) .. "). Copy the entire wand_sync folder, including files/module.")
end

package.path = "./mods/wand_sync/files/lib/?.lua;" .. package.path
package.cpath = "./mods/wand_sync/files/module/?.dll;" .. package.cpath

local effil = require("effil")
require("socket")

return { effil = effil, game_root = game_root }
