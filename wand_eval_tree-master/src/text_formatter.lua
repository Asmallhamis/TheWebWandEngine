---@class text_formatter
local M = {}

local col_map = {}

---@param colour_codes {[string]: string}
---@param do_cols boolean
function M.init_cols(colour_codes, do_cols)
	local colour_char = string.char(27)

	M.colour_codes = {}
	for k, v in pairs(colour_codes) do
		M.colour_codes[k] = v
	end

	if do_cols then
		for k, v in pairs(M.colour_codes) do
			M.colour_codes[k] = colour_char .. "[" .. v .. "m"
		end
	else
		for k, _ in pairs(M.colour_codes) do
			M.colour_codes[k] = ""
		end
	end

	-- we may not always be called in a context where the engine exists (i.e. help menu)
	if ACTION_TYPE_PROJECTILE then
		col_map = {
			[ACTION_TYPE_PROJECTILE] = M.colour_codes.RED,
			[ACTION_TYPE_STATIC_PROJECTILE] = M.colour_codes.RED,
			[ACTION_TYPE_MODIFIER] = M.colour_codes.BLUE,
			[ACTION_TYPE_UTILITY] = M.colour_codes.PINK,
			[ACTION_TYPE_MATERIAL] = M.colour_codes.GREEN,
			[ACTION_TYPE_OTHER] = M.colour_codes.YELLOW,
			[ACTION_TYPE_DRAW_MANY] = M.colour_codes.CYAN,
			[ACTION_TYPE_PASSIVE] = M.colour_codes.CYAN,
		}
	end
end

M.ty_map = {}

---@param id string
---@return string
local function colour_of(id)
	local key = M.ty_map[id] or ACTION_TYPE_DRAW_MANY
	if key then return col_map[key] end
	return ""
end

---@param id string
---@param translations table<string, string>
---@return string
function M.id_text(id, translations)
	local name = translations[id] or id
	name = colour_of(id) .. name
	return name
end

---@param a node
---@param b node
---@return boolean?
function M.colour_compare(a, b)
	if colour_of(a.name) ~= colour_of(b.name) then return colour_of(a.name) > colour_of(b.name) end
	return nil
end

return M
