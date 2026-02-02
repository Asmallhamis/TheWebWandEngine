---@class mod_interface
local M = {}

function M.load_mods(mod_list)
	for _, v in ipairs(mod_list) do
		-- 只有 twwe_mock 这个补丁 Mod 才允许运行其逻辑代码
		-- 其他 Mod 仅作为 VFS 文件搜索路径使用，不运行 init.lua 避免 UI 冲突导致崩溃
		if v == "twwe_mock" then
			local path = "mods/" .. v .. "/settings.lua"
			if ModTextFileGetContent(path) then
				dofile(path)
				ModSettingsUpdate(0)
				ModSettingsGuiCount()
				ModSettingsGui(GuiCreate(), false)
				ModSettingsUpdate(0)
			end
		end
	end
	for _, v in ipairs(mod_list) do
		if v == "twwe_mock" then
			dofile("mods/" .. v .. "/init.lua")
		end
	end
end

return M
