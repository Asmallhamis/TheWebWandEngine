---@class mod_interface
local M = {}

function M.load_mods(mod_list)
	for _, v in ipairs(mod_list) do
		local path = "mods/" .. v .. "/settings.lua"
		if ModTextFileGetContent(path) then
			dofile(path)
			ModSettingsUpdate(0)
			ModSettingsGuiCount()
			ModSettingsGui(GuiCreate(), false)
			ModSettingsUpdate(0)
		end
	end
	for _, v in ipairs(mod_list) do
		dofile("mods/" .. v .. "/init.lua")
	end
end

return M
