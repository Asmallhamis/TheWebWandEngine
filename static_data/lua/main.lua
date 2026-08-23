if type(jit) ~= "table" then
    -- error("Must be run with luajit!")
    print("Warning: Not running with LuaJIT. Some features might be limited.")
end

local arg_parser = require("src.arg_parser")
local options = arg_parser.parse(arg)

local fake_engine = require("src.fake_engine")
fake_engine.data_path = options.data_path
fake_engine.noita_path = options.noita_path
fake_engine.make_fake_api(options)

local renderer = require("src.renderer")
fake_engine.incremental_fold_node = renderer.fold_completed_child
fake_engine.render_timeline_chunk = renderer.render_timeline_chunk
local text_formatter = require("src.text_formatter")
---@diagnostic disable-next-line: lowercase-global
print_table = require("src.print")
local mod_interface = require("src.mod_interface")
-- ---@type image
--local image = require("src.image")
mod_interface.load_mods(options.mods)
fake_engine.initialise_engine(text_formatter, options)

text_formatter.init_cols(options.colour_scheme, options.ansi)

fake_engine.evaluate(options, text_formatter)
fake_engine.finish_timeline()
--image.render(fake_engine.calls, options.spells)
print(renderer.render(fake_engine.calls, fake_engine, text_formatter, options))
