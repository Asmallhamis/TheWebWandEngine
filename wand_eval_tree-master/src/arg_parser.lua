local user_config = require("user_config")

local option_list = {
	h = "help",
	a = "ansi",
	d = "drained",
	e = "every_other",
	u = "unlimited_spells",
	t = "tree",
	c = "counts",
	s = "states",
	j = "json",
	f = "fold",
	ln = "language",
	sc = "spells_per_cast",
	ma = "mana",
	mc = "mana_charge",
	mx = "mana_max",
	rt = "reload_time",
	cd = "cast_delay",
	nc = "number_of_casts",
	ac = "always_casts",
	md = "mods",
	sp = "spells",
	mp = "noita_path",
	dp = "data_path",
	cs = "colour_scheme",
	fp = "fuzz_pool",
	ft = "fuzz_target",
	fs = "fuzz_size",
	fo = "fuzz_out",
	fm = "fuzz_minimise",
	fM = "fuzz_maximise",
	fb = "fuzz_begin",
	fe = "fuzz_end",
}

-- we duplicate the type to have an inexact variant
---@type options
local defaults = {
	ansi = false,
	drained = false,
	every_other = false,
	unlimited_spells = true,
	tree = true,
	counts = true,
	states = true,
	json = false,
	fold = true,
	spells_per_cast = 26,
	mana = 10000,
	mana_charge = 0,
	mana_max = 10000,
	reload_time = 0,
	cast_delay = 0,
	number_of_casts = 1,
	always_casts = {},
	mods = {},
	spells = {},
	noita_path = "/home/wand_crafter/.local/share/Steam/steamapps/common/Noita/",
	data_path = "/home/wand_crafter/Documents/code/noitadata/",
	colour_scheme = {
		RESET = "0",
		GREY = "30",
		RED = "31",
		GREEN = "32",
		YELLOW = "33",
		BLUE = "34",
		PINK = "35",
		CYAN = "36",
	},
	-- we want all the fuzz settings to be nil so that we can check if one was specified but not all
	full_pool = nil,
	full_target = nil,
	fuzz_size = nil,
	fuzz_out = nil,
	fuzz_minimise = nil,
	fuzz_maximise = nil,
	fuzz_begin = nil,
	fuzz_end = nil,
}

for k, v in pairs(user_config) do
	defaults[k] = v
end

---@param obj any
---@param reset_col string
---@return string
local function stringify(obj, reset_col)
	if type(obj) == "table" then
		local build = "{"
		local num_keys = 0
		for _, _ in pairs(obj) do
			num_keys = num_keys + 1
		end
		if num_keys ~= #obj then
			-- kinda hacky, but the only thing that uses this is colour codes
			local ansi = string.char(27)
			for k, v in pairs(obj) do
				v = ansi .. "[" .. v .. "m" .. v .. reset_col
				build = build .. k .. " = " .. v .. ", "
			end
			local l = build:len()
			build = build:sub(1, l - 2) .. "}"
			return build
		end
		for k, v in ipairs(obj) do
			build = build .. stringify(v, reset_col) .. k == #obj and "" or ", "
		end
		return build .. "}"
	end
	return tostring(obj)
end

---@param name string
---@return fun(val: string?): boolean
local function boolify(name)
	return function(val)
		if val == nil then
			error("fully specified flag " .. name .. " missing boolean value y/n/true/false")
		end
		val = val:lower()
		if val == "y" or val == "true" then
			return true
		elseif val == "n" or val == "false" then
			return false
		end
		error(val .. " is not any of y/n/true/false")
	end
end

---@param name string
---@return fun(values: string[]): number
local function numeric(name)
	return function(val)
		val = val[1]
		if not val then error("no numeric value passed to numeric option " .. name) end
		if val:sub(1, 2) == ".-" then val = val:sub(2) end
		local value = tonumber(val)
		if value then return value end
		error("argument to " .. name .. " cannot be converted to a number")
	end
end

---@param name string
---@return fun(val: string[]): integer
local function integer(name)
	local base = numeric(name)
	return function(val)
		return math.floor(base(val))
	end
end

---@param name string
---@return fun(val: string[]): string
local function str(name)
	return function(val)
		if val[1] then return val[1] end
		error("no string argument to string option " .. name)
	end
end

---@param name string
---@return fun(val: string[]): string
local function path(name)
	local base = str(name)
	return function(val)
		local arg = base(val)
		if arg:sub(#arg) ~= "/" then arg = arg .. "/" end
		return arg
	end
end

---@generic T
---@param x T
---@return T
local function identity(x)
	return x
end

---@generic T
---@param x T[]
---@return T
local function first(x)
	return x[1]
end

---@param x string[]
---@return spell[]
local function spell_parse(x)
	local ptr = 1
	local spells = {}
	while ptr <= #x do
		---@type spell
		local spell = x[ptr]
		if tonumber(spell) then error("invalid spell sequence with number " .. tonumber(spell)) end
		local next = x[ptr + 1]
		local number = tonumber(next)
		if number then
			spell = { name = x[ptr], count = number }
			ptr = ptr + 1
		end
		table.insert(spells, spell)
		ptr = ptr + 1
	end
	return spells
end

---@param x string[]
---@return fuzz_config
local function fuzz_parse(x)
	---@type fuzz_config
	local config = {}
	for _, item in ipairs(x) do
		---@type string[]
		local parts = {}
		for part in item:gmatch("[^=]+") do
			table.insert(parts, part)
		end
		if #parts ~= 2 then
			error("missing fuzz parts, should have one = sign, got " .. (#parts - 1))
		end
		local spell = parts[1]
		local count_str = parts[2]
		local count = tonumber(count_str)
		local low, high
		if count then
			low = count
			high = count
		else
			local range_seperator = count_str:find("%.%.")
			if not range_seperator then
				error("missing fuzz range seperator, should be of the form SPELL=LOW..HIGH")
			end

			local low_str = count_str:sub(1, range_seperator - 1)
			if low_str == "" then
				low = 0
			else
				low = tonumber(low_str)
				if not low then error("low part of range is not a number, got " .. low_str) end
			end

			local high_str = count_str:sub(range_seperator + 2)
			if high_str == "" then
				high = 1 / 0
			else
				high = tonumber(high_str)
				if not high then error("high part of range is not a number, got " .. high_str) end
			end
		end

		---@type fuzz_config_item
		local config_item = { spell = spell, low = low, high = high }
		table.insert(config, config_item)
	end
	return config
end

local help_order = {
	"help",
	"ansi",
	"drained",
	"every_other",
	"unlimited_spells",
	"tree",
	"counts",
	"states",
	"json",
	"fold",
	"language",
	"spells_per_cast",
	"mana",
	"mana_charge",
	"mana_max",
	"reload_time",
	"cast_delay",
	"number_of_casts",
	"always_casts",
	"mods",
	"spells",
	"data_path",
	"noita_path",
	"colour_scheme",
	"fuzz_pool",
	"fuzz_target",
	"fuzz_size",
	"fuzz_out",
	"fuzz_minimise",
	"fuzz_maximise",
	"fuzz_begin",
	"fuzz_end",
}

local help_defs = {
	help = "whether or not to show this menu",
	ansi = "whether or not to show ansi colour codes and discord formatting",
	drained = "when true charged spells default to 0 charges, otherwise they use max",
	every_other = "the initial state of requirement every other",
	unlimited_spells = "whether you have unlimited spells or not",
	tree = "whether or not to render the tree",
	counts = "whether or not to show the counts table",
	states = "whether or not to show the shot states table, tree always renders the shot states",
	json = "output json instead of human readable trees",
	fold = "convert repeated tree nodes into a single node with count",
	language = "use translations of language given",
	spells_per_cast = "the number of spells per cast",
	mana = "the wands starting mana",
	mana_charge = "the wands mana charge rate, in mana / second",
	mana_max = "the maximum amount of mana the wand can hold",
	reload_time = "the wands base reload time",
	cast_delay = "the wands base cast delay",
	number_of_casts = "the number of casts to calculate",
	always_casts = "the list of always casts",
	mods = "the list of mods to load",
	spells = "the list of spells",
	data_path = "the path to /Nolla_Games_Noita/ which contains /data/",
	noita_path = "the path to /Noita/ which contains /mods/",
	colour_scheme = "a map written KEY=VALUE where each element maps a key to an ansi escape code",
	fuzz_pool = "the list of spells to use when fuzzing for a certain condition",
	fuzz_target = "the spells and counts to fuzz for, written SPELL=LOW..HIGH SPELL=LOW..HIGH where LOW..HIGH is the range [LOW, HIGH]",
	fuzz_size = "the number of random spells in a fuzzer generated wand",
	fuzz_out = "the spells to output the counts of when a passing match is found",
	fuzz_minimise = "whenever a solution with less of this spell in the output counts is found set the new constraint for this spell to be less than it",
	fuzz_maximise = "whenever a solution with more of this spell in the output counts is found set the new constraint for this spell to be more than it",
	fuzz_begin = "spells to add to the start of a fuzzed wand, note these don't take from fuzz_size",
	fuzz_end = "spells to add to the end of a fuzzed wand, note these don't take from fuzz_size",
}

local help_text = [[
options are -... or --...
values that are negative use .- instead of -
arg is an option or a value
single character options are flags, specifying them toggles from the default.
multiple flags can be specified like -abc, it must not be followed by a value.
you can also specify flags fully with -a true
other values can be specified like -ma 1000, or --mods grahams_perks boss_reworks
if no options are specified the -sp option is automatically added to the start
spell options are used like -sp DAMAGE LIGHT_BULLET
]]

local function help()
	local text_formatter = require("src.text_formatter")
	text_formatter.init_cols(defaults.colour_scheme, true)

	print(help_text)
	local inverted = {}
	for k, v in pairs(option_list) do
		inverted[v] = k
	end
	for _, full in ipairs(help_order) do
		local short = inverted[full]
		local extra_space = (short:len() == 1) and " " or ""
		print(
			text_formatter.colour_codes.GREY
				.. "-"
				.. text_formatter.colour_codes.GREEN
				.. short
				.. extra_space
				.. text_formatter.colour_codes.GREY
				.. " --"
				.. text_formatter.colour_codes.GREEN
				.. full
				.. text_formatter.colour_codes.RESET
				.. ": "
				.. help_defs[full]
				.. text_formatter.colour_codes.GREY
				.. " ("
				.. text_formatter.colour_codes.BLUE
				.. stringify(defaults[full], text_formatter.colour_codes.BLUE)
				.. text_formatter.colour_codes.GREY
				.. ")"
		)
	end
end

---@param name string
---@param default_values {[string]: string}
---@return fun(args: string[]): {[string]: string}
local function map_parse(name, default_values)
	---@param args string[]
	---@return {[string]: string}
	return function(args)
		local map = {}
		for k, v in pairs(default_values) do
			map[k] = v
		end
		for _, v in ipairs(args) do
			local eq = v:find("=")
			if not eq then error("map value for " .. name .. " without = sign") end
			local key = v:sub(1, eq - 1)
			local value = v:sub(eq + 1)
			map[key] = value
		end
		return map
	end
end

---@type table<string, fun(values: string[]): any>
local complex_option_fns = {
	language = first,
	spells_per_cast = numeric("spells_per_cast"),
	mana = numeric("mana"),
	mana_charge = numeric("mana_charge"),
	mana_max = numeric("mana_max"),
	reload_time = integer("reload_time"),
	cast_delay = integer("cast_delay"),
	number_of_casts = integer("number_of_casts"),
	always_casts = spell_parse,
	mods = identity,
	noita_path = path("noita_path"),
	data_path = path("data_path"),
	spells = spell_parse,
	colour_scheme = map_parse("colour_scheme", defaults.colour_scheme),
	fuzz_pool = spell_parse,
	fuzz_target = fuzz_parse,
	fuzz_size = integer("fuzz_size"),
	fuzz_out = identity,
	fuzz_minimise = identity,
	fuzz_maximise = identity,
	fuzz_begin = spell_parse,
	fuzz_end = spell_parse,
	help = function()
		error("do help!")
	end,
}

---@nodiscard
---@param option string
---@param value string[]
---@return any, string
local function apply_option(option, value)
	local short_flag = option:sub(2, 2) ~= "-"
	if short_flag then
		local longer = option_list[option:sub(2)]
		if not longer then error("unknown short flag " .. option) end
		option = longer
	else
		option = option:sub(3)
	end
	if not complex_option_fns[option] then
		if defaults[option] ~= nil then return boolify(option)(value[1]), option end
		error("unknown option " .. option)
	end
	return complex_option_fns[option](value), option
end

---@class arg_parser
local M = {}

---@class (exact) charged_spell
---@field name string
---@field count integer

---@alias spell string | charged_spell

---@class (exact) fuzz_config_item
---@field low integer inclusive
---@field high integer inclusive
---@field spell string

---@alias fuzz_config fuzz_config_item[]

---@class (exact) options
---@field ansi boolean
---@field drained boolean
---@field every_other boolean
---@field unlimited_spells boolean
---@field tree boolean
---@field counts boolean
---@field states boolean
---@field json boolean
---@field fold boolean
---@field language string?
---@field spells_per_cast integer
---@field mana number
---@field mana_charge number
---@field mana_max number
---@field reload_time integer
---@field cast_delay integer
---@field number_of_casts integer
---@field always_casts spell[]
---@field mods string[]
---@field spells spell[]
---@field noita_path string
---@field data_path string
---@field colour_scheme {[string]: string}
---@field fuzz_pool spell[]?
---@field fuzz_target fuzz_config?
---@field fuzz_size integer?
---@field fuzz_out string[]?
---@field fuzz_minimise string[]?
---@field fuzz_maximise string[]?
---@field fuzz_begin spell[]?
---@field fuzz_end spell[]?

---@param args string[]
---@return options
local function internal_parse(args)
	---@type options
	---@diagnostic disable-next-line: missing-fields
	local cur_options = {}
	for k, v in pairs(defaults) do
		cur_options[k] = v
	end

	if #args == 0 then error("must pass args") end
	local ptr = 1
	if args[1]:sub(1, 1) ~= "-" then
		table.insert(args, 1, "-sp")
		while ptr <= #args and args[ptr]:sub(1, 1) ~= "-" do
			ptr = ptr + 1
		end
	end
	while ptr <= #args do
		local cur_arg = args[ptr]
		local is_opt = cur_arg:sub(1, 1) == "-"
		local is_long_opt = cur_arg:sub(2, 2) == "-"
		local is_short_opt = is_opt and not is_long_opt
		local next_arg = args[ptr + 1]
		local next_arg_is_opt = false
		if next_arg then next_arg_is_opt = (next_arg:sub(1, 1) == "-") end
		local flag_block = is_short_opt and (not next_arg or next_arg_is_opt)
		if flag_block then
			for i = 2, #cur_arg do
				local flag_char = cur_arg:sub(i, i)
				local full_name = option_list[flag_char]
				if defaults[full_name] == nil then
					if full_name == "help" then -- help cheats because it's single char non flag
						complex_option_fns[full_name]()
					else
						error("unknown flag " .. flag_char)
					end
				end
				cur_options[full_name] = not defaults[full_name]
			end
		elseif is_opt then
			local parameter_list = {}
			ptr = ptr + 1
			while ptr <= #args do
				local cur = args[ptr]
				if cur:sub(1, 1) == "-" then
					ptr = ptr - 1
					break
				end
				ptr = ptr + 1
				table.insert(parameter_list, cur)
			end
			local value, name = apply_option(cur_arg, parameter_list)
			cur_options[name] = value
		else
			error("stray value " .. cur_arg)
		end
		ptr = ptr + 1
	end
	return cur_options
end

---@param args string[]
---@return options
function M.parse(args)
	local success, result = pcall(internal_parse, args)
	if not success then
		print(result)
		help()
		require("os").exit(1, true)
	end
	return result
end

---@paraam cur_word integer
---@param args string[]
---@return string[] cmp
function M.complete(cur_word, args)
	local cmp = {}
	local last = args[#args]
	local no_last = #args == 1
	if no_last or last:sub(1, 1) == "-" then
		local double = last:sub(2, 2) == "-"
		if not double then table.insert(cmp, "--") end
		for k, v in pairs(option_list) do
			if not double then
				table.insert(cmp, "-" .. k)
			else
				table.insert(cmp, "--" .. v)
			end
		end
		return cmp
	end
	return cmp
end

return M
