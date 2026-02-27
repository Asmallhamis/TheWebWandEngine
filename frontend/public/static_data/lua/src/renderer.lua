---@class renderer
local M = {}

---@param node node
---@param engine_data fake_engine
---@return boolean
local function make_text(node, engine_data)
	if engine_data.nodes_to_shot_ref[node] then return false end
	local build = (node.count or 1) .. " " .. node.name .. " ["
	for _, v in ipairs(node.children) do
		local res = make_text(v, engine_data)
		if res == false then return false end
		build = build .. res
	end
	return build .. "]"
end

---@param node node
---@param engine_data fake_engine
local function fold(node, engine_data)
	local raw = require("src.data")
	local equal = true
	if engine_data.nodes_to_shot_ref[node] then
		for k, v in pairs(engine_data.nodes_to_shot_ref[node].state) do
			if raw[k] ~= v and not ({ action_draw_many_count = true, reload_time = true })[k] then
				equal = false
			end
		end

		if equal then
			local num = engine_data.shot_refs_to_nums[engine_data.nodes_to_shot_ref[node]]
			for k, v in pairs(engine_data.shot_refs_to_nums) do
				if num.real < v.real then
					engine_data.shot_refs_to_nums[k].disp = engine_data.shot_refs_to_nums[k].disp
						- 1
				end
			end

			engine_data.nodes_to_shot_ref[node] = nil
		end
	end

	node.count = 1
	local i = 1
	---@type string | false
	local last = ""
	local cur_c = 1
	local index_set = {}
	while i <= #node.children do
		local v = node.children[i]
		fold(v, engine_data)
		local cur = make_text(v, engine_data)
		if last == cur and cur ~= false then
			local idx = node.children[i].index
			if type(idx) == "table" then
				for _, idv in ipairs(idx) do index_set[idv] = true end
			elseif idx then
				index_set[idx] = true
			end
			cur_c = cur_c + 1
			table.remove(node.children, i)
		else
			last = cur
			if i ~= 1 then
				local prev_node = node.children[i - 1]
				local idx = prev_node.index
				if type(idx) == "table" then
					for _, idv in ipairs(idx) do index_set[idv] = true end
				elseif idx then
					index_set[idx] = true
				end
				local indexes = {}
				for k, _ in pairs(index_set) do
					table.insert(indexes, k)
				end
				table.sort(indexes)
				index_set = {}
				prev_node.count = cur_c
				prev_node.index = indexes
				cur_c = 1
			end
			i = i + 1
		end
	end
	if i ~= 1 then
		local prev_node = node.children[i - 1]
		local idx = prev_node.index
		if type(idx) == "table" then
			for _, idv in ipairs(idx) do index_set[idv] = true end
		elseif idx then
			index_set[idx] = true
		end
		local indexes = {}
		for k, _ in pairs(index_set) do
			table.insert(indexes, k)
		end
		table.sort(indexes)
		index_set = {}
		prev_node.count = cur_c
		prev_node.index = indexes
		cur_c = 1
	end
end

---@param node node
---@param val integer
local function pre_multiply(node, val)
	node.count = (node.count or 1) * val
	for _, v in ipairs(node.children) do
		pre_multiply(v, node.count)
	end
end

---@param str string
---@return integer
local function len(str)
	return str:gsub("[\128-\191]", ""):len()
end

---@class (exact) node
---@field name string
---@field children node[]
---@field count integer?
---@field extra string?
---@field index (integer|integer[])?

---@class (exact) bar
---@field start integer
---@field finish integer
---@field right_shift integer
---@field value integer

---@class (exact) incomplete_render
---@field tree_semi_rendered string
---@field bars bar[]

---@param incomplete_render incomplete_render
---@param engine_data fake_engine
---@param text_formatter text_formatter
---@return incomplete_render
local function post_multiply(incomplete_render, engine_data, text_formatter)
	local bars = incomplete_render.bars
	local bar_idx = 1
	local out_sp = {}
	for str in incomplete_render.tree_semi_rendered:gmatch("([^\n]+)") do
		table.insert(out_sp, str)
	end
	for k, str in ipairs(out_sp) do
		local colourless = str:gsub(string.char(27) .. ".-m", "")
		if bars[bar_idx].finish < k then bar_idx = bar_idx + 1 end
		bars[bar_idx].right_shift = math.max(bars[bar_idx].right_shift, len(colourless))
	end
	bar_idx = 1
	for line_num, line_text in ipairs(out_sp) do
		local colourless = line_text:gsub(string.char(27) .. ".-m", "")
		if bars[bar_idx].finish < line_num then bar_idx = bar_idx + 1 end
		local cur_bar = bars[bar_idx]
		local extra = (" "):rep(cur_bar.right_shift - len(colourless) + 1)
		if cur_bar.start == cur_bar.finish then
			extra = extra .. "]"
		elseif cur_bar.start == line_num then
			extra = extra .. "┐"
		elseif cur_bar.finish == line_num then
			extra = extra .. "┘"
		else
			extra = extra .. "│"
		end
		if math.floor((cur_bar.start + cur_bar.finish) / 2) == line_num then
			extra = extra
				.. " "
				.. text_formatter.colour_codes.RESET
				.. cur_bar.value
				.. text_formatter.colour_codes.GREY
		end
		if cur_bar.value ~= 1 then out_sp[line_num] = out_sp[line_num] .. extra end
		if engine_data.lines_to_shot_nums[line_num] then
			out_sp[line_num] = out_sp[line_num]
				.. " @ "
				.. text_formatter.colour_codes.RESET
				.. engine_data.lines_to_shot_nums[line_num]
				.. text_formatter.colour_codes.GREY
		end
	end
	local out = table.concat(out_sp, "\n") .. "\n"
	return { tree_semi_rendered = out, bars = bars }
end

---@param node node
---@param prefix string
---@param no_extra boolean
---@param indent_level integer
---@param engine_data fake_engine
---@param text_formatter text_formatter
---@param incomplete_render incomplete_render
---@param options options
local function handle(
	node,
	prefix,
	no_extra,
	indent_level,
	engine_data,
	text_formatter,
	incomplete_render,
	options
)
	indent_level = indent_level or 0
	local t_prefix = ""
	for k = 1, prefix:len() do
		local v = prefix:sub(k, k)
		if v == "#" then
			t_prefix = t_prefix .. (k == prefix:len() and (no_extra and "└" or "├") or "│")
		else
			t_prefix = t_prefix .. " "
		end
	end
	incomplete_render.tree_semi_rendered = incomplete_render.tree_semi_rendered
		.. t_prefix
		.. text_formatter.id_text(node.name, engine_data.translations)
		.. (node.extra and (" " .. text_formatter.colour_codes.RESET .. node.extra) or "")
		.. text_formatter.colour_codes.GREY
		.. "\n"
	if engine_data.nodes_to_shot_ref[node] then
		local _, c = incomplete_render.tree_semi_rendered:gsub("\n", "\n")
		local cur_line = engine_data.shot_refs_to_nums[engine_data.nodes_to_shot_ref[node]].disp
		engine_data.lines_to_shot_nums[c] = cur_line
	end
	local last_bar = incomplete_render.bars[#incomplete_render.bars]
	if last_bar.right_shift <= indent_level and last_bar.value == node.count then
		last_bar.finish = last_bar.finish + 1
	else
		local new_bar = {
			start = last_bar.finish + 1,
			finish = last_bar.finish + 1,
			right_shift = indent_level,
			value = node.count,
		}
		table.insert(incomplete_render.bars, new_bar)
	end
	for k, v in ipairs(node.children) do
		local dont = k == #node.children
		if no_extra then prefix = prefix:sub(1, prefix:len() - 1) .. " " end
		handle(
			v,
			prefix .. "#",
			dont,
			indent_level + 1,
			engine_data,
			text_formatter,
			incomplete_render,
			options
		)
	end
end

---@param src node
---@param engine_data fake_engine
---@param indent string?
---@return string
local function render_json(src, engine_data, out)
	local shot_id = nil
	if engine_data.nodes_to_shot_ref[src] then
		local num = engine_data.shot_refs_to_nums[engine_data.nodes_to_shot_ref[src]]
		if num then shot_id = num.id_in_cast end
	end

	table.insert(out, "{\"name\":\"")
	table.insert(out, src.name)
	table.insert(out, "\"")

	if shot_id then
		table.insert(out, ",\"shot_id\":")
		table.insert(out, tostring(shot_id))
	end

	if src.iteration then
		table.insert(out, ",\"iteration\":")
		table.insert(out, tostring(src.iteration))
	end

	if src.recursion then
		table.insert(out, ",\"recursion\":")
		table.insert(out, tostring(src.recursion))
	end

	src.count = src.count or 1
	table.insert(out, ",\"count\":")
	table.insert(out, tostring(src.count))

	if src.extra and src.extra ~= "" then
		table.insert(out, ",\"extra\":\"")
		table.insert(out, src.extra)
		table.insert(out, "\"")
	end

	src.index = src.index or {}
	local idx = src.index
	if type(idx) == "number" then idx = { idx } end
	table.insert(out, ",\"index\":[")
	table.insert(out, table.concat(idx, ","))
	table.insert(out, "],\"children\":[")

	for k, v in ipairs(src.children) do
		render_json(v, engine_data, out)
		if k ~= #src.children then table.insert(out, ",") end
	end
	table.insert(out, "]}")
end

local function gather_state_modifications(state, first)
	local default = require("src.data")
	local diff = {}
	for k, v in pairs(state) do
		if default[k] ~= v then diff[k] = tostring(v) end
	end
	diff.action_name = nil
	diff.action_description = nil
	diff.action_id = nil
	diff.action_mana_drain = nil
	diff.action_draw_many_count = nil
	diff.action_type = nil
	diff.action_recursive = nil
	-- diff.reload_time = nil
	if not first then 
		-- diff.fire_rate_wait = nil 
	end

	---@param csv string?
	---@return string[]
	local function handle_xml_csv(csv)
		if not csv then return {} end
		---@type string[]
		local mods = {}
		for mod in csv:gmatch("([^,]+)") do
			table.insert(mods, mod)
		end
		for k, mod in ipairs(mods) do
			local base = mod:match("/([^/]+)%.xml$")
			if base == "extra_entity" then
				local parent = mod:match("/([^/]+)/[^/]+%.xml$")
				if parent and parent ~= "" then
					mods[k] = parent
				else
					mods[k] = base
				end
			elseif base then
				mods[k] = base
			else
				mods[k] = mod
			end
		end
		local counted = {}
		for _, v in ipairs(mods) do
			counted[v] = (counted[v] or 0) + 1
		end
		local numeric = {}
		for k, v in pairs(counted) do
			table.insert(numeric, k .. (v == 1 and "" or (" ×" .. tostring(v))))
		end
		return numeric
	end

	diff.extra_entities = table.concat(handle_xml_csv(diff.extra_entities), ", ")
	if diff.extra_entities == "" then diff.extra_entities = nil end

	diff.game_effect_entities = table.concat(handle_xml_csv(diff.game_effect_entities), ", ")
	if diff.game_effect_entities == "" then diff.game_effect_entities = nil end

	local t = {}
	for k, v in pairs(diff) do
		table.insert(t, { k, v })
	end
	table.sort(t, function(a, b)
		return a[1] < b[1]
	end)
	return t
end

local function render_combined_json(calls, engine_data, text_formatter)
	local out = {}
	table.insert(out, "{\"tree\":")
	render_json(calls, engine_data, out)

	local shot_nums_to_refs = {}
	for shot, num in pairs(engine_data.shot_refs_to_nums) do
		shot_nums_to_refs[num.disp] = shot
	end

	table.insert(out, ",\"states\":[")
	for num, shot in ipairs(shot_nums_to_refs) do
		local shot_info = engine_data.shot_refs_to_nums[shot]
		local diff = gather_state_modifications(shot.state, shot_info.id_in_cast == 1)
		table.insert(out, "{\"id\":")
		table.insert(out, tostring(shot_info.id_in_cast))
		table.insert(out, ",\"cast\":")
		table.insert(out, tostring(shot_info.cast))
		table.insert(out, ",\"stats\":{")
		for i, v in ipairs(diff) do
			table.insert(out, "\"")
			table.insert(out, v[1])
			table.insert(out, "\":")
			table.insert(out, (tonumber(v[2]) and v[2] or ("\"" .. v[2] .. "\"")))
			if i ~= #diff then table.insert(out, ",") end
		end
		table.insert(out, "}}")
		if num ~= #shot_nums_to_refs then table.insert(out, ",") end
	end
	table.insert(out, "],\"counts\":{")

	local first = true
	local count_keys = {}
	for k, _ in pairs(engine_data.counts) do table.insert(count_keys, k) end
	table.sort(count_keys)
	for _, k in ipairs(count_keys) do
		local v = engine_data.counts[k]
		if not first then table.insert(out, ",") end
		table.insert(out, "\"")
		table.insert(out, k)
		table.insert(out, "\":")
		table.insert(out, tostring(v))
		first = false
	end
	table.insert(out, "},\"cast_counts\":{")

	local first_cast = true
	local cast_nums = {}
	for k, _ in pairs(engine_data.cast_counts) do table.insert(cast_nums, k) end
	table.sort(cast_nums)

	for _, cast_num in ipairs(cast_nums) do
		local counts = engine_data.cast_counts[cast_num]
		if not first_cast then table.insert(out, ",") end
		table.insert(out, "\"")
		table.insert(out, tostring(cast_num))
		table.insert(out, "\":{")
		local first_spell = true
		local spell_ids = {}
		for k, _ in pairs(counts) do table.insert(spell_ids, k) end
		table.sort(spell_ids)
		for _, spell_id in ipairs(spell_ids) do
			local count = counts[spell_id]
			if not first_spell then table.insert(out, ",") end
			table.insert(out, "\"")
			table.insert(out, spell_id)
			table.insert(out, "\":")
			table.insert(out, tostring(count))
			first_spell = false
		end
		table.insert(out, "}")
		first_cast = false
	end
	table.insert(out, "}}")

	return table.concat(out)
end

---@param calls node
---@param engine_data fake_engine
---@param text_formatter text_formatter
---@param options options
---@return string
function M.render(calls, engine_data, text_formatter, options)
	if options.fold then fold(calls, engine_data) end
	if options.json then return render_combined_json(calls, engine_data, text_formatter) end
	pre_multiply(calls, 1)
	local render = {
		tree_semi_rendered = "",
		bars = { { start = 1, finish = 0, right_shift = 0, value = 1 } },
	}
	if options.tree then
		handle(calls, "", false, 0, engine_data, text_formatter, render, options)
		render = post_multiply(render, engine_data, text_formatter)
	end
	render.tree_semi_rendered = render.tree_semi_rendered
		.. (
			options.counts
				and M.render_counts(engine_data, text_formatter, options.ansi and not options.tree)
			or ""
		)

	render.tree_semi_rendered = render.tree_semi_rendered
		.. (options.states and M.render_shot_states(engine_data, text_formatter) or "")

	render.tree_semi_rendered = (options.ansi and "```ansi\n" or "")
		.. render.tree_semi_rendered
		.. (options.ansi and (text_formatter.colour_codes.RESET .. "```") or "")
	return render.tree_semi_rendered
end

---@param engine_data fake_engine
---@param text_formatter text_formatter
---@param trailing_grey boolean
---@return string
function M.render_counts(engine_data, text_formatter, trailing_grey)
	local count_pairs = {}
	local big_length = 0
	local big_length2 = 0
	for k, v in pairs(engine_data.counts) do
		table.insert(count_pairs, { k, tostring(v), v })
		big_length = math.max(big_length, len(engine_data.translations[k] or k))
		big_length2 = math.max(big_length2, tostring(v):len())
	end
	table.sort(count_pairs, function(a, b)
		if a[3] ~= b[3] then return a[3] > b[3] end
		local res = text_formatter.colour_compare(a[1], b[1])
		if res ~= nil then return res end
		return a[1] > a[1]
	end)
	local count_message = (trailing_grey and text_formatter.colour_codes.GREY or "")
		.. "┌"
		.. ("─"):rep(big_length + 2)
		.. "┬"
		.. ("─"):rep(big_length2 + 2)
		.. "┐\n"
	for _, v in ipairs(count_pairs) do
		count_message = count_message
			.. "│ "
			.. text_formatter.id_text(v[1], engine_data.translations)
			.. (" "):rep(big_length - len(engine_data.translations[v[1]] or v[1]) + 1)
			.. text_formatter.colour_codes.GREY
			.. "│ "
			.. text_formatter.colour_codes.RESET
			.. v[2]
			.. text_formatter.colour_codes.GREY
			.. (" "):rep(big_length2 - v[2]:len() + 1)
			.. "│\n"
	end
	count_message = count_message
		.. "└"
		.. ("─"):rep(big_length + 2)
		.. "┴"
		.. ("─"):rep(big_length2 + 2)
		.. "┘\n"
	return count_message
end

---@param engine_data fake_engine
---@param text_formatter text_formatter
---@return string
function M.render_shot_states(engine_data, text_formatter)
	local shot_nums_to_refs = {}

	for shot, num in pairs(engine_data.shot_refs_to_nums) do
		shot_nums_to_refs[num.disp] = shot
	end
	local out = ""
	for num, shot in ipairs(shot_nums_to_refs) do
		local shot_table = text_formatter.colour_codes.RESET .. "Shot State " .. num .. ":\n"
		local diff = gather_state_modifications(shot.state, num == 1)
		local name_width = 0
		local value_width = 0
		for _, v in ipairs(diff) do
			local key = v[1]
			local value = v[2]
			name_width = math.max(name_width, key:len())
			value_width = math.max(value_width, tostring(value):len())
		end
		name_width = name_width + 2
		value_width = value_width + 2
		shot_table = shot_table
			.. text_formatter.colour_codes.GREY
			.. "┌"
			.. ("─"):rep(name_width)
			.. "┬"
			.. ("─"):rep(value_width)
			.. "┐\n"
		for _, v in ipairs(diff) do
			local key = v[1]
			local value = v[2]
			local v_str = tostring(value)
			shot_table = shot_table
				.. "│ "
				.. text_formatter.colour_codes.RESET
				.. key
				.. text_formatter.colour_codes.GREY
				.. (" "):rep(name_width - key:len() - 1)
				.. "│ "
				.. text_formatter.colour_codes.RESET
				.. v_str
				.. text_formatter.colour_codes.GREY
				.. (" "):rep(value_width - len(v_str) - 1)
				.. "│\n"
		end
		shot_table = shot_table
			.. "└"
			.. ("─"):rep(name_width)
			.. "┴"
			.. ("─"):rep(value_width)
			.. "┘\n"

		out = out .. shot_table .. "\n"
	end

	---@cast out string
	return out:sub(1, out:len() - 1)
end

return M
