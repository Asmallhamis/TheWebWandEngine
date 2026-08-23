-- Set up the api we are using

---@type entropy
local entropy = require("src.entropy")

---@type prng
local prng = require("src.prng")

---@class (exact) shot_ref
---@field state state
---@field num_of_cards_to_draw integer

---@diagnostic disable-next-line: unused-function
local function dbg_cards(pile)
	for _, v in ipairs(pile) do
		print(v.id)
	end
end
---@diagnostic disable-next-line: unused-function, unused-local
local function dbg_wand()
	print("discard")
	dbg_cards(discarded)
	print("hand")
	dbg_cards(hand)
	print("deck")
	dbg_cards(deck)
end

---@param text_formatter text_formatter
---@param id string
local function bad_spell(text_formatter, id)
	error(
		text_formatter.colour_codes.RED
			.. "Unknown spell "
			.. text_formatter.colour_codes.RESET
			.. '"'
			.. text_formatter.colour_codes.GREEN
			.. id
			.. text_formatter.colour_codes.RESET
			.. '"'
	)
end

---@param text_formatter text_formatter
---@param id string
local function is_bad(text_formatter, id)
	for _, v in ipairs(actions) do
		if v.id == id then return end
	end
	bad_spell(text_formatter, id)
end

---@param id string
---@param charges integer?
---@param options options
---@param text_formatter text_formatter
local function easy_add(id, charges, options, text_formatter)
	local forced_index = nil
	local colon_pos = id:find(":")
	if colon_pos then
		forced_index = tonumber(id:sub(1, colon_pos - 1))
		id = id:sub(colon_pos + 1)
	end

	id = id:upper()
	for _, v in ipairs(actions) do
		if v.id:upper() == id then
			if v.max_uses == nil then
				charges = -1
			elseif options.unlimited_spells and not v.never_unlimited then
				charges = -1
			elseif charges ~= nil then -- at this point we use the arg
			elseif options.drained then
				charges = 0
			else
				charges = v.max_uses
			end
			---@cast charges integer
			_add_card_to_deck(id, 0, charges, true)
			local card = deck[#deck]
			if forced_index then
				card.deck_index = forced_index
			end
			---@diagnostic disable-next-line: missing-parameter, assign-type-mismatch, param-type-mismatch
			card.action = card.action(card)
			return
		end
	end
	bad_spell(text_formatter, id)
end

---@class fake_engine
local M = {}

local TIMELINE_PILE_NAMES = { "deck", "hand", "discarded" }

local function timeline_get_pile(name)
	if name == "deck" then return deck end
	if name == "hand" then return hand end
	if name == "discarded" then return discarded end
	return {}
end

local function timeline_ensure_card(action)
	if not M.timeline_enabled or not action then return nil end
	if
		not M.timeline_stream_enabled
		and M.timeline_event_limit
		and #M.timeline_events >= M.timeline_event_limit
		and not action.__twwe_timeline_uid
	then
		return nil
	end
	if not action.__twwe_timeline_uid then
		M.timeline_card_seq = (M.timeline_card_seq or 0) + 1
		action.__twwe_timeline_uid = M.timeline_card_seq
		M.timeline_cards[action.__twwe_timeline_uid] = {
			uid = action.__twwe_timeline_uid,
			id = action.id,
			slot = action.deck_index,
			permanent = action.permanently_attached and true or nil,
		}
		if type(_TWWE_TIMELINE_CARD) == "function" then
			pcall(
				_TWWE_TIMELINE_CARD,
				action.__twwe_timeline_uid,
				action.id,
				action.deck_index,
				action.permanently_attached and true or false
			)
		end
	end
	return action.__twwe_timeline_uid
end

local function timeline_snapshot_pile(name)
	local out = {}
	for _, action in ipairs(timeline_get_pile(name) or {}) do
		local uid = timeline_ensure_card(action)
		if uid then table.insert(out, uid) end
	end
	return out
end

local function timeline_snapshot_piles()
	local out = {}
	for _, name in ipairs(TIMELINE_PILE_NAMES) do
		out[name] = timeline_snapshot_pile(name)
	end
	return out
end

-- 牌堆快照的紧凑指纹，用于判断本次事件的牌堆是否与上一次相同。
local function timeline_piles_key(piles)
	local parts = {}
	for _, name in ipairs(TIMELINE_PILE_NAMES) do
		parts[#parts + 1] = name .. ":" .. table.concat(piles[name] or {}, ".")
	end
	return table.concat(parts, "|")
end

local function timeline_flush_stream()
	if not M.timeline_stream_enabled or #M.timeline_stream_events == 0 then return true end
	local rendered, payload = pcall(M.render_timeline_chunk, M.timeline_stream_events)
	if not rendered then
		M.timeline_stream_failed = true
		M.timeline_stream_enabled = false
		M.timeline_stream_events = {}
		return false
	end
	local first_event = M.timeline_stream_events[1].i
	local sent, accepted = pcall(
		_TWWE_TIMELINE_FLUSH,
		payload,
		first_event,
		#M.timeline_stream_events
	)
	M.timeline_stream_events = {}
	if not sent or accepted == false then
		M.timeline_stream_failed = true
		M.timeline_stream_enabled = false
		return false
	end
	return true
end

function M.finish_timeline()
	if not M.timeline_enabled then return end
	if M.timeline_stream_enabled then timeline_flush_stream() end
	M.timeline_stream_complete = not M.timeline_stream_failed and M.timeline_stream_started
	if M.timeline_seq > #M.timeline_events and not M.timeline_stream_complete then
		M.timeline_truncated = true
	end
end

local function timeline_record(event_type, info)
	if not M.timeline_enabled or not M.timeline_events then return false end
	info = info or {}
	M.timeline_seq = (M.timeline_seq or 0) + 1
	local preview_captured = not M.timeline_event_limit or #M.timeline_events < M.timeline_event_limit
	if not preview_captured and not M.timeline_stream_enabled then
		M.timeline_truncated = true
		return false
	end
	local active_shot = M.active_shots and M.active_shots[#M.active_shots] or nil
	local active_shot_info = active_shot and M.shot_refs_to_nums and M.shot_refs_to_nums[active_shot] or nil
	local action_stack = M.timeline_action_stack or {}
	-- piles 增量化：实测 99.4% 的事件牌堆与上一条完全相同，
	-- 却各自复制一份完整数组，是 timeline 体积的主要来源。
	-- 这里仅在牌堆真正变化时保留快照，其余事件省略 piles 字段，
	-- 由消费方沿用上一次的状态（renderer 与前端均已配套处理）。
	local piles_changed = false
	local piles = nil
	if M.timeline_piles_dirty or not M.timeline_last_piles then
		local next_piles = timeline_snapshot_piles()
		local piles_key = timeline_piles_key(next_piles)
		piles_changed = piles_key ~= M.timeline_last_piles_key
		if piles_changed then
			M.timeline_last_piles_key = piles_key
			M.timeline_last_piles = next_piles
			piles = next_piles
		end
		M.timeline_piles_dirty = false
	end

	local event = {
		i = M.timeline_seq,
		type = event_type,
		cast = M.cur_cast_num,
		action = action_stack[#action_stack],
		shot = active_shot_info and active_shot_info.id_in_cast or nil,
		info = info,
		piles = piles_changed and piles or nil,
	}
	if preview_captured then table.insert(M.timeline_events, event) end
	if M.timeline_stream_enabled then
		table.insert(M.timeline_stream_events, event)
		M.timeline_stream_started = true
		local chunk_target = M.timeline_stream_chunk_size
		if M.timeline_event_limit > 0 and M.timeline_seq <= M.timeline_event_limit then
			-- 第一块与内联预览严格对齐，后续页面才能从 preview + page 2 连续读取。
			chunk_target = M.timeline_event_limit
		end
		if #M.timeline_stream_events >= chunk_target then timeline_flush_stream() end
	end
	return preview_captured
end

function M.reset_timeline(enabled)
	M.timeline_enabled = enabled ~= false
	M.timeline_seq = 0
	M.timeline_card_seq = 0
	M.timeline_execution_seq = 0
	if not M.timeline_enabled then
		M.timeline_cards = nil
		M.timeline_events = nil
		M.timeline_stream_events = nil
		M.timeline_action_stack = nil
		M.timeline_draw_stack = nil
		M.timeline_stream_enabled = false
		M.timeline_stream_started = false
		M.timeline_stream_failed = false
		M.timeline_stream_complete = false
		M.timeline_truncated = false
		return
	end
	M.timeline_cards = {}
	M.timeline_events = {}
	M.timeline_stream_events = {}
	M.timeline_action_stack = {}
	M.timeline_draw_stack = {}
	M.timeline_last_piles_key = nil
	M.timeline_last_piles = nil
	M.timeline_piles_dirty = true
	M.timeline_event_limit = math.max(0, math.floor(tonumber(_TWWE_TIMELINE_EVENT_LIMIT) or 10000))
	M.timeline_stream_chunk_size = math.max(1, math.floor(tonumber(_TWWE_TIMELINE_CHUNK_SIZE) or 10000))
	M.timeline_stream_enabled =
		type(_TWWE_TIMELINE_FLUSH) == "function"
		and type(M.render_timeline_chunk) == "function"
	M.timeline_stream_started = false
	M.timeline_stream_failed = false
	M.timeline_stream_complete = false
	M.timeline_truncated = false
end

---@param options options
local function regenerate_translations(options)
	-- print(ModTextFileGetContent("data/translations/common.csv"))
	local actual_translations = {}
	local tcsv = require("extra.tcsv")
	local csv =
		---@diagnostic disable-next-line: param-type-mismatch
		tcsv.parse(ModTextFileGetContent("data/translations/common.csv"), "common.csv", false)
	local csv_lang_row = nil
	for k, v in ipairs(csv.langs) do
		if v == options.language then csv_lang_row = k + 1 end
	end
	for _, v in ipairs(csv.rows) do
		actual_translations[v[1]] = v[csv_lang_row]
	end
	function GameTextGetTranslatedOrNot(text_or_key)
		if text_or_key:sub(1, 1) == "$" then
			return actual_translations[text_or_key:sub(2)] or text_or_key
		end
		return text_or_key
	end

	for _, v in ipairs(actions or {}) do
		if options.language then
			M.translations[v.id] = GameTextGetTranslatedOrNot(v.name)
			--print(v.id, v.name, GameTextGetTranslatedOrNot(v.name))
			--print(v.name:len())
		end
	end
end

M.noita_path = ""
M.data_path = ""

---@param options options
function M.make_fake_api(options)
	package.path = package.path .. ";" .. M.data_path .. "?.lua;" .. M.noita_path .. "?.lua"
	M.vfs = {
		["data/translations/common.csv"] = assert(
			assert(io.open(M.noita_path .. "data/translations/common.csv", "r")):read("*a")
		),
	}
	---@type table<string, any>
	M.mod_settings = {}
	local _print = print
	require("meta.out")
	print = _print

	regenerate_translations(options)

	local frame = (options.seed ~= nil) and options.seed or entropy.get_entropy()
	M.used_seed = frame

	-- Deterministic PRNG implementation to ensure same results across LuaJIT (Desktop) and Lua 5.4 (WASM)
	-- This overrides the built-in math.random to use a custom pure-Lua PRNG.
	math.randomseed = function(seed)
		local n = tonumber(seed) or 0
		-- Ensure we pass a 53-bit integer to our prng
		prng.set_seed(math.floor(math.abs(n)))
	end

	math.random = function(m, n)
		local res = prng.get_random_32() / 4294967296
		if not m then return res end
		if not n then
			n = m
			m = 1
		end
		return math.floor(res * (n - m + 1)) + m
	end

	math.randomseed(frame)

	function Random(a, b)
		if not a and not b then return math.random() end
		if not b then
			b = a
			a = 0
		end
		return math.floor(math.random() * (b - a + 1)) + a
	end

	local globals = {}
	local append_map = {}

	function GlobalsSetValue(key, value)
		globals[key] = tostring(value)
	end

	function ModTextFileGetContent(filename)
		local success, res = pcall(function()
			if M.vfs[filename] then return M.vfs[filename] end
			if filename:sub(1, 4) == "mods" then
				if _TWWE_VFS_ONLY then return nil end
				local f = io.open(M.noita_path .. filename)
				if not f then f = io.open(filename) end -- 如果游戏目录没有，尝试从本地加载补丁
				return assert(assert(f):read("*a"))
			end
			if not _TWWE_VFS_ONLY then
				for _, mod in ipairs(options.mods) do
					local full_path = M.noita_path .. "mods/" .. mod .. "/" .. filename
					local data_filed = io.open(full_path)
					if not data_filed then 
						-- 尝试从本地加载
						data_filed = io.open("mods/" .. mod .. "/" .. filename)
					end
					if data_filed then 
						M.vfs[filename] = data_filed:read("*a")
						data_filed:close()
						return M.vfs[filename]
					end
				end
			end
			-- recheck for mod /data/
			if M.vfs[filename] then return M.vfs[filename] end
			return assert(assert(io.open(M.data_path .. filename)):read("*a"))
		end)
		if not success then return nil end
		return res
	end

	function ModTextFileSetContent(filename, new_content)
		M.vfs[filename] = new_content
		if filename == "data/translations/common.csv" then regenerate_translations(options) end
	end

	function GlobalsGetValue(key, value)
		return tostring(globals[key] or value)
	end

	function SetRandomSeed(x, y)
		-- Robust mixing to ensure cross-platform consistency.
		-- We avoid float math during mixing to ensure Desktop and WASM results are 100% identical.
		-- The constants are multiplied by 1000 compared to the original approximation.
		local s = math.floor(x * 591) + math.floor(y * 8541) + math.floor(frame) + 124545
		math.randomseed(s)
	end

	function GameGetFrameNum()
		return frame
	end

	function ModLuaFileAppend(to, from)
		append_map[to] = append_map[to] or {}
		table.insert(append_map[to], from)
	end

	function ModSettingSet(id, value)
		M.mod_settings[id] = value
	end

	function ModSettingGet(id)
		return M.mod_settings[id]
	end

	ModSettingGetNextValue = ModSettingGet
	ModSettingSetNextValue = ModSettingSet

	function dofile(file)
		local content = ModTextFileGetContent(file)
		if not content then
			error(
				"Could not dofile `"
					.. file
					.. "` because it does not exist in the VFS! perhaps your paths are wrong?"
			)
		end
		local fn, err = loadstring(content, file)
		if not fn then
			error("Error loading file `" .. file .. "`: " .. tostring(err))
		end
		local res = { fn() }
		for _, v in ipairs(append_map[file] or {}) do
			dofile(v)
		end
		return unpack(res)
	end
	dofile_once = dofile

	dofile("data/scripts/gun/gun_enums.lua")

	--[[function BeginProjectile(p)
		print(p)
	end]]
end

---@param text_formatter text_formatter
---@param options options
function M.initialise_engine(text_formatter, options)
	dofile("data/scripts/gun/gun.lua")
	local _play_action = play_action
	function play_action(action)
		M.pending_source = "draw"
		if M.timeline_enabled then M.timeline_piles_dirty = true end
		return _play_action(action)
	end
	local _order_deck = order_deck
	function order_deck(...)
		if not M.timeline_enabled then return _order_deck(...) end
		local res = { _order_deck(...) }
		M.timeline_piles_dirty = true
		timeline_record("deck_ordered", { shuffled = state_shuffled and true or false })
		return unpack(res)
	end
	local _draw_action = draw_action
	function draw_action(...)
		if not M.timeline_enabled then return _draw_action(...) end
		local draw_context = M.timeline_draw_stack and M.timeline_draw_stack[#M.timeline_draw_stack] or nil
		if draw_context then
			draw_context.step = draw_context.step + 1
		end
		timeline_record("draw_start")
		M.timeline_piles_dirty = true
		local res = { _draw_action(...) }
		if draw_context and not res[1] then
			draw_context.step = draw_context.step - 1
		end
		M.timeline_piles_dirty = true
		timeline_record("draw_end", { ok = res[1] })
		return unpack(res)
	end
	local _draw_actions = draw_actions
	function draw_actions(how_many, instant_reload_if_empty)
		if not M.timeline_enabled then return _draw_actions(how_many, instant_reload_if_empty) end
		local draw_context = { total = how_many, step = 0 }
		M.timeline_draw_stack = M.timeline_draw_stack or {}
		table.insert(M.timeline_draw_stack, draw_context)
		timeline_record("draw_many_start", {
			how_many = how_many,
			instant_reload_if_empty = instant_reload_if_empty and true or false,
		})
		local res = { _draw_actions(how_many, instant_reload_if_empty) }
		timeline_record("draw_many_end", { how_many = how_many })
		table.remove(M.timeline_draw_stack)
		return unpack(res)
	end
	local _move_discarded_to_deck = move_discarded_to_deck
	function move_discarded_to_deck(...)
		if not M.timeline_enabled then return _move_discarded_to_deck(...) end
		local res = { _move_discarded_to_deck(...) }
		M.timeline_piles_dirty = true
		timeline_record("discarded_to_deck")
		return unpack(res)
	end
	local _move_hand_to_discarded = move_hand_to_discarded
	function move_hand_to_discarded(...)
		if not M.timeline_enabled then return _move_hand_to_discarded(...) end
		local res = { _move_hand_to_discarded(...) }
		M.timeline_piles_dirty = true
		timeline_record("hand_to_discarded")
		return unpack(res)
	end
	local original_handle_reload = _handle_reload
	function _handle_reload(...)
		if not M.timeline_enabled then return original_handle_reload(...) end
		timeline_record("reload_start")
		local res = { original_handle_reload(...) }
		M.timeline_piles_dirty = true
		timeline_record("reload_end", { reload_time = M.reload_time })
		return unpack(res)
	end
	local _create_shot = create_shot
	function create_shot(...)
		local uv = { _create_shot(...) }
		local v = uv[1]
		M.nodes_to_shot_ref[M.cur_parent] = v
		M.cur_shot_ref = v
		M.shot_refs_to_nums[v] = { 
			disp = M.cur_shot_num, 
			real = M.cur_shot_num,
			cast = M.cur_cast_num,
			id_in_cast = M.cur_shot_in_cast_num
		}
		-- Track source spell and trigger type for this shot
		if M.cur_parent and M.cur_parent.name then
			M.shot_source_spells[v] = M.cur_parent.name
		end
		if M.pending_trigger_type then
			M.shot_trigger_types[v] = M.pending_trigger_type
			M.pending_trigger_type = nil
		end
		M.shot_projectiles[v] = {}
		M.cur_shot_num = M.cur_shot_num + 1
		M.cur_shot_in_cast_num = M.cur_shot_in_cast_num + 1
		if M.timeline_enabled then
			timeline_record("shot_created", { id = M.shot_refs_to_nums[v].id_in_cast })
		end
		-- v.state.wand_tree_initial_mana = mana
		-- TODO: find a way to do this in a garunteed safe way
		return unpack(uv)
	end

	-- Hook trigger functions to track trigger type
	local _add_projectile_trigger_timer = add_projectile_trigger_timer
	function add_projectile_trigger_timer(...)
		M.pending_trigger_type = "timer"
		return _add_projectile_trigger_timer(...)
	end

	local _add_projectile_trigger_hit_world = add_projectile_trigger_hit_world
	function add_projectile_trigger_hit_world(...)
		M.pending_trigger_type = "trigger"
		return _add_projectile_trigger_hit_world(...)
	end

	local _add_projectile_trigger_death = add_projectile_trigger_death
	function add_projectile_trigger_death(...)
		M.pending_trigger_type = "death"
		return _add_projectile_trigger_death(...)
	end

	-- Hook BeginProjectile to track actual projectile entities per shot
	-- This is the engine-level callback called when a real projectile entity is spawned.
	-- Only projectile spells (not copy/modifier/utility) trigger this.
	local _BeginProjectile = BeginProjectile
	function BeginProjectile(entity_filename, ...)
		local target_shot = (M.active_shots and #M.active_shots > 0) and M.active_shots[#M.active_shots] or root_shot
		if target_shot and M.cur_parent then
			local proj_list = M.shot_projectiles[target_shot]
			if proj_list then
				local spell_id = M.cur_parent.name
				-- Avoid duplicates
				local found = false
				for _, v in ipairs(proj_list) do
					if v == spell_id then found = true; break end
				end
				if not found then
					table.insert(proj_list, spell_id)
				end
			end
		end
		if _BeginProjectile then
			return _BeginProjectile(entity_filename, ...)
		end
	end

	function StartReload(reload_time)
		M.reload_time = reload_time
	end

	local _draw_shot = draw_shot
		function draw_shot(...)
			local args = { ... }
			local shot = args[1]
			if not M.active_shots then M.active_shots = {} end
			table.insert(M.active_shots, shot)
			if M.timeline_enabled then
				local shot_info = M.shot_refs_to_nums[shot]
				timeline_record("shot_start", { id = shot_info and shot_info.id_in_cast or nil })
			end
			local res = { _draw_shot(...) }
			if M.timeline_enabled then
				local shot_info = M.shot_refs_to_nums[shot]
				timeline_record("shot_end", { id = shot_info and shot_info.id_in_cast or nil })
			end
		table.remove(M.active_shots)
		return unpack(res)
	end

	M.translations = {}
	for _, v in ipairs(actions) do
		text_formatter.ty_map[v.id] = v.type
		local _a = v.action
		v.action = function(clone, ...)
			local new = function(...)
				---@cast clone action
				local old_node = M.cur_node
				local source = M.pending_source or "action"
					M.pending_source = nil
					local recursion_val = select(1, ...)
					local iteration_val = select(2, ...)
					local timeline_id = nil
					if M.timeline_enabled then
						M.timeline_execution_seq = (M.timeline_execution_seq or 0) + 1
						timeline_id = M.timeline_execution_seq
					end
				local new_node = {
					name = v.id,
					children = {},
					index = clone.deck_index,
					source = source,
					iteration = iteration_val,
					recursion = (type(recursion_val) == "number" and recursion_val > 0) and recursion_val or nil,
				}
				M.counts[v.id] = (M.counts[v.id] or 0) + 1
				M.cast_counts[M.cur_cast_num] = M.cast_counts[M.cur_cast_num] or {}
				M.cast_counts[M.cur_cast_num][v.id] = (M.cast_counts[M.cur_cast_num][v.id] or 0) + 1
					M.cur_node = new_node.children
					M.cur_parent = new_node
					table.insert(old_node, new_node)
					local timeline_uid = nil
					if M.timeline_enabled then
						timeline_uid = timeline_ensure_card(clone)
						local timeline_draw = source == "draw" and M.timeline_draw_stack and M.timeline_draw_stack[#M.timeline_draw_stack] or nil
						table.insert(M.timeline_action_stack, v.id)
						local timeline_captured = timeline_record("action_start", {
							id = v.id,
							timeline_id = timeline_id,
							uid = timeline_uid,
							source = source,
							slot = clone.deck_index,
							iteration = iteration_val,
							recursion = recursion_val,
							draw_step = timeline_draw and timeline_draw.step or nil,
							draw_total = timeline_draw and timeline_draw.total or nil,
						})
						if timeline_captured then new_node.timeline_id = timeline_id end
					end
					local res = { _a(...) }
					if M.timeline_enabled then
						timeline_record("action_end", {
							id = v.id,
							timeline_id = timeline_id,
							uid = timeline_uid,
							source = source,
							slot = clone.deck_index,
							iteration = iteration_val,
							recursion = recursion_val,
						})
						table.remove(M.timeline_action_stack)
					end
				if options.fold and _TWWE_INCREMENTAL_FOLD ~= false and M.incremental_fold_node then
					M.incremental_fold_node(old_node, new_node, M)
					M.incremental_folded = true
				end
				M.cur_node = old_node
				return unpack(res)
			end
			if type(clone) == "table" then -- this is awful
				---@diagnostic disable-next-line: return-type-mismatch
				return new
			end
			-- Always Cast support: fallback to a unique negative index if not provided
			clone = { deck_index = -999 } 
			---@diagnostic disable-next-line: redundant-return-value
			return unpack({ new(...) })
		end
	end
	regenerate_translations(options)
end

---@param options options
---@param text_formatter text_formatter
---@param read_to_lua_info table
---@param cast integer
local function eval_wand(options, text_formatter, read_to_lua_info, cast)
	M.cur_cast_num = cast
	M.cur_shot_in_cast_num = 1
	mana = math.min(mana, options.mana_max)
	table.insert(M.calls.children, { name = "Cast #" .. cast, children = {} })
	ConfigGunActionInfo_ReadToLua(unpack(read_to_lua_info))
	_set_gun2()
	M.cur_parent = M.calls.children[#M.calls.children]
	local cur_root = M.cur_parent
	M.cur_node = M.cur_parent.children

	local old_mana = mana
	if M.timeline_enabled then timeline_record("cast_start", { mana = mana }) end
	_start_shot(mana)
	if M.timeline_enabled then timeline_record("cast_ready", { mana = mana }) end
	for _, perk in ipairs(options.perks) do
		_add_extra_modifier_to_shot(perk)
	end
	for k, v in ipairs(options.always_casts) do
		if type(v) == "table" then v = v.name end
		---@cast v string
		is_bad(text_formatter, v)
		---@cast v string
		--[[local s = "set_current_action"
			local _c = _G[s]
			_G[s] = function(...)
				for _, v2 in ipairs({ ... }) do
					print_table(v2)
				end
				_c(...)
			end]]
		local _clone_action = clone_action
		clone_action = function(...)
			local res = { _clone_action(...) }
			local dest = ({ ... })[2]
			dest.deck_index = -k
			local old_action = dest.action
			dest.action = function(...)
				local action_res = { old_action({ deck_index = -k })(...) }
				return unpack(action_res)
			end
			clone_action = _clone_action
			return unpack(res)
		end
		_play_permanent_card(v)
		--_G[s] = _c
	end
	_draw_actions_for_shot(true)
	--dbg_wand()
	local cast_delay = root_shot.state.fire_rate_wait
	local recharge_time = 0
	local delay = cast_delay

	-- cursed nolla design.
	_handle_reload()
	local did_recharge = false
	if M.reload_time ~= nil then
		did_recharge = true
		recharge_time = M.reload_time
		delay = math.max(delay, M.reload_time)
		M.reload_time = nil
	end
	delay = math.max(delay, 1)
	local recoil = shot_effects and shot_effects.recoil_knockback or 0
	cur_root.extra = "CastDelay: " .. cast_delay .. "f, Recharge: " .. recharge_time .. "f, Delay: " .. delay .. "f, ΔMana: " .. (old_mana - mana) .. ", Recoil: " .. recoil
	if M.timeline_enabled then
		timeline_record("cast_end", {
			cast_delay = cast_delay,
			recharge_time = recharge_time,
			delay = delay,
			mana_delta = old_mana - mana,
			recoil = recoil,
		})
	end
	mana = mana + delay * options.mana_charge / 60
	return did_recharge
end

---@param options options
---@param text_formatter text_formatter
---@param spells spell[]
---@return table read_to_lua_info the info describing what to pass to the fake lua side from engine
local function reset_wand(options, text_formatter, spells)
	---@type node
	M.calls = { name = "Wand", children = {} }
	M.reset_timeline(options.timeline)
	M.nodes_to_shot_ref = {}
	M.shot_refs_to_nums = {}
	M.lines_to_shot_nums = {}
	M.cur_shot_num = 1
	M.cur_cast_num = 1
	M.cur_shot_in_cast_num = 1
	---@type table<string, integer>
	M.counts = {}
	---@type table<integer, table<string, integer>>
	M.cast_counts = {}
	M.shot_source_spells = {}
	M.shot_trigger_types = {}
	M.shot_projectiles = {}
	M.cur_shot_ref = nil
	M.active_shots = {}
	M.pending_trigger_type = nil
	M.pending_source = nil
	M.fold_signature_seq = 0
	M.fold_signature_ids = {}
	M.incremental_folded = false

	_clear_deck(false)
	for _, v in ipairs(spells) do
		if type(v) == "string" then
			easy_add(v, nil, options, text_formatter)
		else
			easy_add(v.name, v.count, options, text_formatter)
		end
	end

	ConfigGun_ReadToLua(options.spells_per_cast, false, options.reload_time, 66)
	_set_gun()
	if M.timeline_enabled then timeline_record("initial_deck") end
	local data_module = require("src.data")
	local data = {}
	for k, v in pairs(data_module) do data[k] = v end
	local arg_list = require("src.arg_list")
	data.fire_rate_wait = options.cast_delay
	data.speed_multiplier = options.speed_multiplier
	data.spread_degrees = options.spread_degrees
	local read_to_lua_info = {}
	for _, v in ipairs(arg_list) do
		table.insert(read_to_lua_info, data[v])
	end

	mana = options.mana
	GlobalsSetValue("GUN_ACTION_IF_HALF_STATUS", options.every_other and 1 or 0)

	return read_to_lua_info
end

---@param options options
---@param text_formatter text_formatter
---@param run integer
local function fuzz_run(options, text_formatter, run)
	---@type spell[]
	local spells = {}

	for _, spell in ipairs(options.fuzz_begin) do
		table.insert(spells, spell)
	end
	for _ = 1, options.fuzz_size do
		local spell_choice = 1 + (prng.get_random_32() % #options.fuzz_pool)
		table.insert(spells, options.fuzz_pool[spell_choice])
	end
	for _, spell in ipairs(options.fuzz_end) do
		table.insert(spells, spell)
	end

	local read_to_lua_info = reset_wand(options, text_formatter, spells)
	for i = 1, options.number_of_casts do -- you can fuzz multiple casts i suppose
		eval_wand(options, text_formatter, read_to_lua_info, i)
	end

	local failed = false
	for _, requirement in ipairs(options.fuzz_target) do
		local count = M.counts[requirement.spell]
		if not (count and count >= requirement.low and count <= requirement.high) then
			failed = true
			break
		end
	end

	if failed then return end

	-- mutate the constraints to be stricter
	for _, constraint in ipairs(options.fuzz_target) do
		-- we dont need to do min/max because our constraint is neccesarily as strict as the old one
		for _, maximise in ipairs(options.fuzz_maximise) do
			if constraint.spell == maximise then constraint.low = M.counts[constraint.spell] end
		end

		for _, minimise in ipairs(options.fuzz_minimise) do
			if constraint.spell == minimise then constraint.high = M.counts[constraint.spell] end
		end
	end

	local str = ""
	for _, out in ipairs(options.fuzz_out) do
		local count = M.counts[out]
		str = str
			.. " "
			.. text_formatter.id_text(out, M.translations)
			.. text_formatter.colour_codes.RESET
			.. "="
			.. count
	end
	for _, spell in ipairs(spells) do
		---@type string
		---@diagnostic disable-next-line: assign-type-mismatch
		local spell_name = spell
		if type(spell) == "table" then spell_name = spell.name end
		str = str .. " " .. text_formatter.id_text(spell_name, M.translations)
	end
	str = str:sub(2) .. text_formatter.colour_codes.RESET
	print(run .. ": " .. str)
end

---@param options options
---@param text_formatter text_formatter
local function fuzz(options, text_formatter)
	options.fuzz_out = options.fuzz_out or {}
	options.fuzz_minimise = options.fuzz_minimise or {}
	options.fuzz_maximise = options.fuzz_maximise or {}
	options.fuzz_begin = options.fuzz_begin or {}
	options.fuzz_end = options.fuzz_end or {}

	if not (options.fuzz_pool and options.fuzz_target and options.fuzz_size) then
		error(
			"Some fuzzing options are set but not mandatory ones, you must specify at least (pool, target, size) or none"
		)
	end

	for _, constraint in ipairs(options.fuzz_target) do
		for _, v in ipairs(actions) do
			if v.id == constraint.spell then goto success end
		end
		bad_spell(text_formatter, constraint.spell)
		::success::
	end

	local run = 1
	local notable_run = 1000
	while true do
		fuzz_run(options, text_formatter, run)
		if run == notable_run then
			print(run)
			notable_run = notable_run * 5
		end
		run = run + 1
	end
end

---@param options options
---@param text_formatter text_formatter
function M.evaluate(options, text_formatter)
	if
		options.fuzz_pool
		or options.fuzz_target
		or options.fuzz_size
		or options.fuzz_out
		or options.fuzz_minimise
		or options.fuzz_maximise
		or options.fuzz_begin
		or options.fuzz_end
	then
		fuzz(options, text_formatter)
	end

	local read_to_lua_info = reset_wand(options, text_formatter, options.spells)
	local stopped = false
	for i = 1, options.number_of_casts do
		local did_recharge = eval_wand(options, text_formatter, read_to_lua_info, i)
		if options.stop_on_recharge and did_recharge then break end
	end
end

return M
