---@class prng
local M = {}

-- from: https://gist.github.com/Egor-Skriptunoff/375ffe05075063c9a2ce61bb30b1ce50

-- all parameters in PRNG formula are derived from these 57 secret bits:
local secret_key_6 = 58 -- 6-bit  arbitrary integer (0..63)
local secret_key_7 = 110 -- 7-bit  arbitrary integer (0..127)
local secret_key_44 = 3580861008710 -- 44-bit arbitrary integer (0..17592186044415)

local floor = math.floor

local function primitive_root_257(idx)
	-- returns primitive root modulo 257 (one of 128 existing roots, idx = 0..127)
	local g, m, d = 1, 128, 2 * idx + 1
	repeat
		g, m, d = g * g * (d >= m and 3 or 1) % 257, m / 2, d % m
	until m < 1
	return g
end

local param_mul_8 = primitive_root_257(secret_key_7)
local param_mul_45 = secret_key_6 * 4 + 1
local param_add_45 = secret_key_44 * 2 + 1

-- state of PRNG (53 bits in total)
local state_45 = 0 -- from 0 to (2^45-1)
local state_8 = 2 -- from 2 to 256

---@param seed_53 integer
function M.set_seed(seed_53)
	-- set 53-bit integer as current seed (seed is initially set to 0 when program starts)
	state_45 = seed_53 % 35184372088832
	state_8 = floor(seed_53 / 35184372088832) % 255 + 2
end

---@return integer
function M.get_seed()
	-- returns current seed as single 53-bit integer
	return (state_8 - 2) * 35184372088832 + state_45
end

---@return integer
function M.get_random_32()
	-- returns pseudorandom 32-bit integer (0..4294967295)

	-- A linear congruential generator having full period of 2^45
	state_45 = (state_45 * param_mul_45 + param_add_45) % 35184372088832

	-- Lehmer RNG having period of 256
	repeat
		state_8 = state_8 * param_mul_8 % 257
	until state_8 ~= 1 -- skip one value to reduce period from 256 to 255 (we need it to be coprime with 2^45)

	-- Idea taken from PCG: shift and rotate "state_45" by varying number of bits to get 32-bit result
	local r = state_8 % 32
	local n = floor(state_45 / 2 ^ (13 - (state_8 - r) / 32)) % 2 ^ 32 / 2 ^ r
	return floor(n % 1 * 2 ^ 32) + floor(n)
end

return M
