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

local function append_node_timeline_ids(list, node)
	if type(node.timeline_ids) == "table" and #node.timeline_ids > 0 then
		for _, id in ipairs(node.timeline_ids) do
			table.insert(list, id)
		end
	elseif node.timeline_id then
		table.insert(list, node.timeline_id)
	end
end

local function assign_node_timeline_ids(node, ids)
	if #ids == 0 then return end
	node.timeline_id = ids[1]
	node.timeline_ids = #ids > 1 and ids or nil
end

local function append_node_indexes(set, node)
	local index = node.index
	if type(index) == "table" then
		for _, value in ipairs(index) do set[value] = true end
	elseif index ~= nil then
		set[index] = true
	end
end

local function sorted_set_values(set)
	local values = {}
	for value, _ in pairs(set) do table.insert(values, value) end
	table.sort(values)
	return values
end

-- 为已完成的子树分配结构 ID。比较语义与 make_text 一致，
-- 但只引用子节点 ID，避免反复拼接整棵子树。
local function intern_fold_signature(node, engine_data)
	if engine_data.nodes_to_shot_ref[node] then return nil end

	local parts = { node.name, "[" }
	for _, child in ipairs(node.children) do
		local child_id = child.__twwe_fold_signature_id
		if not child_id then return nil end
		parts[#parts + 1] = tostring(child.count or 1)
		parts[#parts + 1] = ":"
		parts[#parts + 1] = tostring(child_id)
		parts[#parts + 1] = ","
	end
	parts[#parts + 1] = "]"

	local key = table.concat(parts)
	local existing = engine_data.fold_signature_ids[key]
	if existing then return existing end

	engine_data.fold_signature_seq = engine_data.fold_signature_seq + 1
	local id = engine_data.fold_signature_seq
	engine_data.fold_signature_ids[key] = id
	return id
end

---在动作执行完成时折叠 parent_children 的最后一个节点。
---只合并相邻、同构且不含 shot state 的子树，与最终 fold 保持一致。
---@param parent_children node[]
---@param node node
---@param engine_data fake_engine
function M.fold_completed_child(parent_children, node, engine_data)
	node.count = 1
	node.__twwe_fold_signature_id = intern_fold_signature(node, engine_data)

	local node_index = #parent_children
	local previous = parent_children[node_index - 1]
	if
		previous
		and node.__twwe_fold_signature_id
		and previous.__twwe_fold_signature_id == node.__twwe_fold_signature_id
	then
		previous.count = (previous.count or 1) + 1

		local indexes = {}
		append_node_indexes(indexes, previous)
		append_node_indexes(indexes, node)
		previous.index = sorted_set_values(indexes)

		local timeline_ids = {}
		append_node_timeline_ids(timeline_ids, previous)
		append_node_timeline_ids(timeline_ids, node)
		assign_node_timeline_ids(previous, timeline_ids)

		parent_children[node_index] = nil
		return previous
	end

	return node
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

	end

	node.count = 1
	local i = 1
	---@type string | false
	local last = ""
	local cur_c = 1
	local index_set = {}
	local timeline_ids = {}
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
			append_node_timeline_ids(timeline_ids, node.children[i])
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
				assign_node_timeline_ids(prev_node, timeline_ids)
				cur_c = 1
			end
			timeline_ids = {}
			append_node_timeline_ids(timeline_ids, node.children[i])
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
		assign_node_timeline_ids(prev_node, timeline_ids)
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
---@field timeline_id integer?
---@field timeline_ids integer[]?

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

	if src.source then
		table.insert(out, ",\"source\":\"")
		table.insert(out, src.source)
		table.insert(out, "\"")
	end

	if src.timeline_id then
		table.insert(out, ",\"timeline_id\":")
		table.insert(out, tostring(src.timeline_id))
	end

	if type(src.timeline_ids) == "table" and #src.timeline_ids > 0 then
		table.insert(out, ",\"timeline_ids\":")
		table.insert(out, "[")
		for k, id in ipairs(src.timeline_ids) do
			table.insert(out, tostring(id))
			if k ~= #src.timeline_ids then table.insert(out, ",") end
		end
		table.insert(out, "]")
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

local function json_escape(value)
	value = tostring(value or "")
	value = value:gsub("\\", "\\\\")
	value = value:gsub("\"", "\\\"")
	value = value:gsub("\n", "\\n")
	value = value:gsub("\r", "\\r")
	value = value:gsub("\t", "\\t")
	return value
end

local function json_value(value, out)
	local value_type = type(value)
	if value_type == "number" then
		table.insert(out, tostring(value))
	elseif value_type == "boolean" then
		table.insert(out, value and "true" or "false")
	elseif value == nil then
		table.insert(out, "null")
	else
		table.insert(out, "\"")
		table.insert(out, json_escape(value))
		table.insert(out, "\"")
	end
end

local function render_number_array(values, out)
	table.insert(out, "[")
	for i, value in ipairs(values or {}) do
		if i > 1 then table.insert(out, ",") end
		table.insert(out, tostring(value))
	end
	table.insert(out, "]")
end

local TIMELINE_EVENT_CODES = {
	initial_deck = 0,
	cast_start = 1,
	cast_ready = 2,
	cast_end = 3,
	shot_created = 4,
	shot_start = 5,
	shot_end = 6,
	deck_ordered = 7,
	draw_start = 8,
	draw_end = 9,
	draw_many_start = 10,
	draw_many_end = 11,
	discarded_to_deck = 12,
	hand_to_discarded = 13,
	reload_start = 14,
	reload_end = 15,
	action_start = 16,
	action_end = 17,
}

local function render_info_object(info, out)
	table.insert(out, "{")
	local first = true
	for key, value in pairs(info or {}) do
		if value ~= nil then
			if not first then table.insert(out, ",") end
			table.insert(out, "\"")
			table.insert(out, json_escape(key))
			table.insert(out, "\":")
			json_value(value, out)
			first = false
		end
	end
	table.insert(out, "}")
end

local function render_compact_piles(piles, out)
	if not piles then return end
	table.insert(out, ",[")
	render_number_array(piles.deck or {}, out)
	table.insert(out, ",")
	render_number_array(piles.hand or {}, out)
	table.insert(out, ",")
	render_number_array(piles.discarded or {}, out)
	table.insert(out, "]")
end

---将 timeline 分块编码为紧凑、可独立落盘的无损 JSON。
---事件序号、cast/shot/action 上下文由解码器从顺序恢复，避免重复字段名和字符串。
---@param events table[]
---@return string
function M.render_timeline_chunk(events)
	local out = { "[" }
	for index, event in ipairs(events or {}) do
		if index > 1 then table.insert(out, ",") end
		local info = event.info or {}
		local code = TIMELINE_EVENT_CODES[event.type]
		table.insert(out, "[")
		if code == 0 or code == 8 or code == 12 or code == 13 or code == 14 or code == 17 then
			table.insert(out, tostring(code))
		elseif code == 1 then
			table.insert(out, "1,")
			json_value(info.mana, out)
			table.insert(out, ",")
			json_value(event.cast, out)
		elseif code == 2 then
			table.insert(out, "2,")
			json_value(info.mana, out)
		elseif code == 3 then
			table.insert(out, "3,")
			json_value(info.cast_delay, out)
			table.insert(out, ",")
			json_value(info.recharge_time, out)
			table.insert(out, ",")
			json_value(info.delay, out)
			table.insert(out, ",")
			json_value(info.mana_delta, out)
			table.insert(out, ",")
			json_value(info.recoil, out)
		elseif code == 4 or code == 5 or code == 6 then
			table.insert(out, tostring(code))
			table.insert(out, ",")
			json_value(info.id, out)
		elseif code == 7 then
			table.insert(out, "7,")
			table.insert(out, info.shuffled and "1" or "0")
		elseif code == 9 then
			table.insert(out, "9,")
			if info.ok == nil then table.insert(out, "null") else table.insert(out, info.ok and "1" or "0") end
		elseif code == 10 then
			table.insert(out, "10,")
			json_value(info.how_many, out)
			table.insert(out, ",")
			table.insert(out, info.instant_reload_if_empty and "1" or "0")
		elseif code == 11 then
			table.insert(out, "11,")
			json_value(info.how_many, out)
		elseif code == 15 then
			table.insert(out, "15,")
			json_value(info.reload_time, out)
		elseif code == 16 then
			table.insert(out, "16,")
			json_value(info.uid or info.id, out)
			table.insert(out, info.source == "draw" and ",1," or ",0,")
			json_value(info.slot, out)
			table.insert(out, ",")
			json_value(info.iteration, out)
			table.insert(out, ",")
			json_value(info.recursion, out)
			table.insert(out, ",")
			json_value(info.draw_step, out)
			table.insert(out, ",")
			json_value(info.draw_total, out)
		else
			-- 未知扩展事件保留完整上下文，保证格式向前兼容且不丢信息。
			table.insert(out, "99,\"")
			table.insert(out, json_escape(event.type))
			table.insert(out, "\",")
			json_value(event.cast, out)
			table.insert(out, ",")
			json_value(event.shot, out)
			table.insert(out, ",")
			json_value(event.action, out)
			table.insert(out, ",")
			render_info_object(info, out)
		end
		render_compact_piles(event.piles, out)
		table.insert(out, "]")
	end
	table.insert(out, "]")
	return table.concat(out)
end

local function render_timeline(engine_data, out)
	table.insert(out, ",\"timeline\":{\"cards\":[")
	for uid = 1, engine_data.timeline_card_seq or 0 do
		local card = engine_data.timeline_cards and engine_data.timeline_cards[uid]
		if card then
			if uid > 1 then table.insert(out, ",") end
			table.insert(out, "{\"uid\":")
			table.insert(out, tostring(card.uid))
			table.insert(out, ",\"id\":\"")
			table.insert(out, json_escape(card.id))
			table.insert(out, "\"")
			if card.slot ~= nil then
				table.insert(out, ",\"slot\":")
				table.insert(out, tostring(card.slot))
			end
			if card.permanent then
				table.insert(out, ",\"permanent\":true")
			end
			table.insert(out, "}")
		end
	end
	table.insert(out, "],\"events\":[")
	for i, event in ipairs(engine_data.timeline_events or {}) do
		if i > 1 then table.insert(out, ",") end
		table.insert(out, "{\"i\":")
		table.insert(out, tostring(event.i))
		table.insert(out, ",\"type\":\"")
		table.insert(out, json_escape(event.type))
		table.insert(out, "\"")
		if event.cast ~= nil then
			table.insert(out, ",\"cast\":")
			table.insert(out, tostring(event.cast))
		end
		if event.shot ~= nil then
			table.insert(out, ",\"shot\":")
			table.insert(out, tostring(event.shot))
		end
		if event.action ~= nil then
			table.insert(out, ",\"action\":\"")
			table.insert(out, json_escape(event.action))
			table.insert(out, "\"")
		end
		table.insert(out, ",\"info\":{")
		local first_info = true
		for key, value in pairs(event.info or {}) do
			if value ~= nil then
				if not first_info then table.insert(out, ",") end
				table.insert(out, "\"")
				table.insert(out, json_escape(key))
				table.insert(out, "\":")
				json_value(value, out)
				first_info = false
			end
		end
		table.insert(out, "}")
		-- piles 为增量：仅在牌堆相对上一条事件发生变化时才存在。
		-- 缺省即表示「与上一条相同」，消费方需沿用上一次的状态。
		-- 注意不能在这里补空数组，否则会被误解为「牌堆已清空」。
		if event.piles then
			table.insert(out, ",\"piles\":{")
			local first_pile = true
			for _, pile_name in ipairs({ "deck", "hand", "discarded" }) do
				if not first_pile then table.insert(out, ",") end
				table.insert(out, "\"")
				table.insert(out, pile_name)
				table.insert(out, "\":")
				render_number_array(event.piles[pile_name] or {}, out)
				first_pile = false
			end
			table.insert(out, "}")
		end
		table.insert(out, "}")
	end
	table.insert(out, "]")
	if (engine_data.timeline_seq or 0) > #(engine_data.timeline_events or {}) then
		table.insert(out, ",\"total_events\":")
		table.insert(out, tostring(engine_data.timeline_seq or #(engine_data.timeline_events or {})))
	end
	if engine_data.timeline_stream_complete then
		table.insert(out, ",\"streamed\":true")
	elseif engine_data.timeline_truncated then
		table.insert(out, ",\"truncated\":true")
	end
	table.insert(out, "}")
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
	table.insert(out, "{\"seed\":")
	table.insert(out, tostring(engine_data.used_seed or 0))
	table.insert(out, ",\"tree\":")
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
		table.insert(out, "}")
		-- Append source_spell and trigger_type if available
		local source_spell = engine_data.shot_source_spells and engine_data.shot_source_spells[shot]
		if source_spell then
			table.insert(out, ",\"source_spell\":\"")
			table.insert(out, source_spell)
			table.insert(out, "\"")
		end
		local trigger_type = engine_data.shot_trigger_types and engine_data.shot_trigger_types[shot]
		if trigger_type then
			table.insert(out, ",\"trigger_type\":\"")
			table.insert(out, trigger_type)
			table.insert(out, "\"")
		end
		-- Append projectiles list (actual projectile entities spawned in this shot)
		local proj_list = engine_data.shot_projectiles and engine_data.shot_projectiles[shot]
		if proj_list and #proj_list > 0 then
			table.insert(out, ",\"projectiles\":[")
			for pi, spell_id in ipairs(proj_list) do
				table.insert(out, "\"")
				table.insert(out, spell_id)
				table.insert(out, "\"")
				if pi ~= #proj_list then table.insert(out, ",") end
			end
			table.insert(out, "]")
		end
		table.insert(out, "}")
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
	table.insert(out, "}")
	if engine_data.timeline_enabled ~= false then render_timeline(engine_data, out) end
	table.insert(out, "}")

	return table.concat(out)
end

---@param calls node
---@param engine_data fake_engine
---@param text_formatter text_formatter
---@param options options
---@return string
function M.render(calls, engine_data, text_formatter, options)
	if options.fold and not engine_data.incremental_folded then fold(calls, engine_data) end
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
