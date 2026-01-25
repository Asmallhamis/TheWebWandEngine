_TWWE_LOW_HP = true

function EntityGetWithTag(tag)
    if tag == "player_unit" and _TWWE_LOW_HP then return { 1 } end
    return {}
end
function EntityGetComponent(ent, type)
    if ent == 1 and type == "DamageModelComponent" then return { 2 } end
    return nil
end
function ComponentGetValue2(comp, field)
    if comp == 2 then
        if field == "hp" then return 1 end
        if field == "max_hp" then return 100 end
    end
    return 0
end
function EntityGetInRadiusWithTag(x, y, radius, tag)
    if tag == "homing_target" and _TWWE_MANY_ENEMIES then
        return {1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20}
    end
    return {}
end
function EntityGetInRadius(x, y, radius)
    if _TWWE_MANY_PROJECTILES then
        return {1,2,3,4,5,6,7,8,9,10}
    end
    return {}
end
            