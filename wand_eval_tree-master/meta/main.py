# convert autoluaapi to form with better return types.

src = open("./AutoLuaAPI/out.lua", "r").read()
lines = src.split("\n")


def get_ty(line):
	ty = line.split(" ")[1]
	if "[]" in ty:
		return "{}"
	if "any" in ty:
		return "nil"
	if "nil" in ty:
		return "nil"
	if "number" in ty:
		return "0"
	if "int" in ty:
		return "0"
	if "boolean" in ty:
		return "false"
	if "string" in ty:
		return '""'
	if "id" in ty:
		return "0"
	return "nil"


last = "nil"
out = "---@meta\n---@diagnostic disable: unused-local, unused-vararg\n"
for line in lines:
	if line.startswith("---@return"):
		last = get_ty(line)
		print(last, line)
	if line.startswith("function"):
		parts = line.split("end")
		res = (
			"end".join(parts[:-1])
			+ " return "
			+ ",".join([last for _ in range(10)])
			+ parts[-1]
			+ " end\n"
		)
		out += res
open("./meta/out.lua", "w").write(out)
