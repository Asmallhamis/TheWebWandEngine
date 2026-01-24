local ffi = require("ffi")

---@class entropy
local M = {}

local pid
local windows = ffi.os == "Windows"

if windows then
	ffi.cdef([[
	typedef unsigned long DWORD;
	typedef long LONG;
	typedef struct {
		DWORD LowPart;
		LONG HighPart;
	} FILETIME;

	unsigned long GetCurrentProcessId(void);
	void GetSystemTimeAsFileTime(FILETIME* ft);
	]])
else
	ffi.cdef([[
	int getpid(void);
	typedef long time_t;
	typedef struct timeval {
		time_t tv_sec;
		int tv_usec;
	} timeval;

	int gettimeofday(struct timeval* t, void* tzp);
	int getpid(void);
	]])
	pid = ffi.C.getpid()
end

---@return integer
function M.get_entropy()
	local data
	if windows then
		local ft = ffi.new("FILETIME")
		ffi.C.GetSystemTimeAsFileTime(ft)
		pid = ffi.C.GetCurrentProcessId()
		---@diagnostic disable-next-line: undefined-field
		data = bit.bor(bit.lshift(ft.HighPart, 32), ft.LowPart)
	else
		local tv = ffi.new("timeval")
		ffi.C.gettimeofday(tv, nil)
		pid = ffi.C.getpid()
		---@diagnostic disable-next-line: undefined-field
		data = tv.tv_sec * 1000000 + tv.tv_usec
	end
	local entropy = tonumber(bit.bxor(data % 2 ^ 31, pid))
	if not entropy then error("entropy generation got a nil??") end
	return entropy
end

return M
