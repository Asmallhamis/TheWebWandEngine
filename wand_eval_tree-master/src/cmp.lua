-- this script is run when completing and writes newline seperated values to stdout
local args = {}
for i = 2, #arg do
	table.insert(args, arg[i])
end
local cmps = require("src.arg_parser").complete(arg[1], args)

print(table.concat(cmps, "\n"))
