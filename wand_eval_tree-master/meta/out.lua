---@meta
---@diagnostic disable: unused-local, unused-vararg
function print_error(...)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function print(...)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function Reflection_RegisterProjectile(path)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function RegisterPerk(id, ui_name, ui_description, ui_icon, perk_icon)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function GameRegisterStatusEffect(ui_name, ui_description, ui_icon, protects_from_fire, remove_cells_that_cause_when_activated, effect_entity, min_threshold_normalized, extra_status_00, effect_permanent, is_harmful, ui_timer_offset_normalized)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function RegisterStreamingEvent(id, ui_name, ui_description, ui_icon_path, kind, weight)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function DEBUG_GameReset()  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function do_mod_appends(filename)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function _ConfigGunActionInfo_ReadToGame(action_id, action_name, action_description, action_sprite_filename, action_unidentified_sprite_filename, action_type, action_spawn_level, action_spawn_probability, action_spawn_requires_flag, action_spawn_manual_unlock, action_max_uses, custom_xml_file, action_mana_drain, action_is_dangerous_blast, action_draw_many_count, action_ai_never_uses, action_never_unlimited, state_shuffled, state_cards_drawn, state_discarded_action, state_destroyed_action, fire_rate_wait, speed_multiplier, child_speed_multiplier, dampening, explosion_radius, spread_degrees, pattern_degrees, screenshake, recoil, damage_melee_add, damage_projectile_add, damage_electricity_add, damage_fire_add, damage_explosion_add, damage_ice_add, damage_slice_add, damage_healing_add, damage_curse_add, damage_drill_add, damage_null_all, damage_critical_chance, damage_critical_multiplier, explosion_damage_to_materials, knockback_force, reload_time, lightning_count, material, material_amount, trail_material, trail_material_amount, bounces, gravity, light, blood_count_multiplier, gore_particles, ragdoll_fx, friendly_fire, physics_impulse_coeff, lifetime_add, sprite, extra_entities, game_effect_entities, sound_loop_tag, projectile_file)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function EntityLoad(filename, pos_x, pos_y)  return 0,0,0,0,0,0,0,0,0,0 end
function EntityLoadEndGameItem(filename, pos_x, pos_y)  return 0,0,0,0,0,0,0,0,0,0 end
function EntityLoadCameraBound(filename, pos_x, pos_y)  return 0,0,0,0,0,0,0,0,0,0 end
function EntityLoadToEntity(filename, entity)  return 0,0,0,0,0,0,0,0,0,0 end
function EntitySave(entity_id, filename)  return 0,0,0,0,0,0,0,0,0,0 end
function EntityCreateNew(name)  return 0,0,0,0,0,0,0,0,0,0 end
function EntityKill(entity_id)  return 0,0,0,0,0,0,0,0,0,0 end
function EntityGetIsAlive(entity_id)  return false,false,false,false,false,false,false,false,false,false end
function EntityAddComponent(entity_id, component_type_name, table_of_component_values)  return 0,0,0,0,0,0,0,0,0,0 end
function EntityRemoveComponent(entity_id, component_id)  return 0,0,0,0,0,0,0,0,0,0 end
function EntityGetAllComponents(entity_id)  return {},{},{},{},{},{},{},{},{},{} end
function EntityGetComponent(entity_id, component_type_name, tag)  return {},{},{},{},{},{},{},{},{},{} end
function EntityGetFirstComponent(entity_id, component_type_name, tag)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function EntityGetComponentIncludingDisabled(entity_id, component_type_name, tag)  return {},{},{},{},{},{},{},{},{},{} end
function EntityGetFirstComponentIncludingDisabled(entity_id, component_type_name, tag)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function EntitySetTransform(entity_id, x, y, rotation, scale_x, scale_y)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function EntityApplyTransform(entity_id, x, y, rotation, scale_x, scale_y)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function EntityGetTransform(entity_id)  return 0,0,0,0,0,0,0,0,0,0 end
function EntityAddChild(parent_id, child_id)  return 0,0,0,0,0,0,0,0,0,0 end
function EntityGetAllChildren(entity_id, tag)  return {},{},{},{},{},{},{},{},{},{} end
function EntityGetParent(entity_id)  return 0,0,0,0,0,0,0,0,0,0 end
function EntityGetRootEntity(entity_id)  return 0,0,0,0,0,0,0,0,0,0 end
function EntityRemoveFromParent(entity_id)  return 0,0,0,0,0,0,0,0,0,0 end
function EntitySetComponentsWithTagEnabled(entity_id, tag, enabled)  return 0,0,0,0,0,0,0,0,0,0 end
function EntitySetComponentIsEnabled(entity_id, component_id, is_enabled)  return 0,0,0,0,0,0,0,0,0,0 end
function EntityGetName(entity_id)  return "","","","","","","","","","" end
function EntitySetName(entity_id, name)  return "","","","","","","","","","" end
function EntityGetTags(entity_id)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function EntityGetWithTag(tag)  return {},{},{},{},{},{},{},{},{},{} end
function EntityGetInRadius(pos_x, pos_y, radius)  return {},{},{},{},{},{},{},{},{},{} end
function EntityGetInRadiusWithTag(pos_x, pos_y, radius, entity_tag)  return {},{},{},{},{},{},{},{},{},{} end
function EntityGetClosest(pos_x, pos_y)  return 0,0,0,0,0,0,0,0,0,0 end
function EntityGetClosestWithTag(pos_x, pos_y, tag)  return 0,0,0,0,0,0,0,0,0,0 end
function EntityGetWithName(name)  return 0,0,0,0,0,0,0,0,0,0 end
function EntityAddTag(entity_id, tag)  return 0,0,0,0,0,0,0,0,0,0 end
function EntityRemoveTag(entity_id, tag)  return 0,0,0,0,0,0,0,0,0,0 end
function EntityHasTag(entity_id, tag)  return false,false,false,false,false,false,false,false,false,false end
function EntityGetFilename(entity_id)  return "","","","","","","","","","" end
function EntitiesGetMaxID()  return 0,0,0,0,0,0,0,0,0,0 end
function ComponentGetValue(component_id, variable_name)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function ComponentGetValueBool(component_id, variable_name)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function ComponentGetValueInt(component_id, variable_name)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function ComponentGetValueFloat(component_id, variable_name)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function ComponentGetValueVector2(component_id, variable_name)  return 0,0,0,0,0,0,0,0,0,0 end
function ComponentSetValue(component_id, variable_name, value)  return 0,0,0,0,0,0,0,0,0,0 end
function ComponentSetValueVector2(component_id, variable_name, x, y)  return 0,0,0,0,0,0,0,0,0,0 end
function ComponentSetValueValueRange(component_id, variable_name, min, max)  return 0,0,0,0,0,0,0,0,0,0 end
function ComponentSetValueValueRangeInt(component_id, variable_name, min, max)  return 0,0,0,0,0,0,0,0,0,0 end
function ComponentSetMetaCustom(component_id, variable_name, value)  return 0,0,0,0,0,0,0,0,0,0 end
function ComponentGetMetaCustom(component_id, variable_name)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function ComponentObjectGetValue(component_id, object_name, variable_name)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function ComponentObjectSetValue(component_id, object_name, variable_name, value)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function ComponentAddTag(component_id, tag)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function ComponentRemoveTag(component_id, tag)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function ComponentGetTags(component_id)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function ComponentHasTag(component_id, tag)  return false,false,false,false,false,false,false,false,false,false end
function ComponentGetValue2(component_id, field_name)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function ComponentSetValue2(component_id, field_name, ...)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function ComponentObjectGetValue2(component_id, object_name, field_name)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function ComponentObjectSetValue2(component_id, object_name, field_name, ...)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function EntityAddComponent2(entity_id, component_type_name, table_of_component_values)  return 0,0,0,0,0,0,0,0,0,0 end
function ComponentGetVectorSize(component_id, array_member_name, type_stored_in_vector)  return 0,0,0,0,0,0,0,0,0,0 end
function ComponentGetVectorValue(component_id, array_name, type_stored_in_vector, index)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function ComponentGetVector(component_id, array_name, type_stored_in_vector)  return {},{},{},{},{},{},{},{},{},{} end
function ComponentGetIsEnabled(component_id)  return false,false,false,false,false,false,false,false,false,false end
function ComponentGetEntity(component_id)  return 0,0,0,0,0,0,0,0,0,0 end
function ComponentGetMembers(component_id)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function ComponentObjectGetMembers(component_id, object_name)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function ComponentGetTypeName(component_id)  return "","","","","","","","","","" end
function GetUpdatedEntityID()  return 0,0,0,0,0,0,0,0,0,0 end
function GetUpdatedComponentID()  return 0,0,0,0,0,0,0,0,0,0 end
function SetTimeOut(time_to_execute, file_to_execute, function_to_call)  return 0,0,0,0,0,0,0,0,0,0 end
function RegisterSpawnFunction(color, function_name)  return 0,0,0,0,0,0,0,0,0,0 end
function SpawnActionItem(x, y, level)  return 0,0,0,0,0,0,0,0,0,0 end
function SpawnStash(x, y, level, action_count)  return 0,0,0,0,0,0,0,0,0,0 end
function SpawnApparition(x, y, level, spawn_now)  return 0,0,0,0,0,0,0,0,0,0 end
function LoadEntityToStash(entity_file, stash_entity_id)  return 0,0,0,0,0,0,0,0,0,0 end
function AddMaterialInventoryMaterial(entity_id, material_name, count)  return 0,0,0,0,0,0,0,0,0,0 end
function RemoveMaterialInventoryMaterial(entity_id, material_name)  return 0,0,0,0,0,0,0,0,0,0 end
function GetMaterialInventoryMainMaterial(entity_id, ignore_box2d_materials)  return 0,0,0,0,0,0,0,0,0,0 end
function GameScreenshake(strength, x, y)  return 0,0,0,0,0,0,0,0,0,0 end
function GameOnCompleted()  return 0,0,0,0,0,0,0,0,0,0 end
function GameGiveAchievement(id)  return 0,0,0,0,0,0,0,0,0,0 end
function GameDoEnding2()  return 0,0,0,0,0,0,0,0,0,0 end
function GetParallelWorldPosition(world_pos_x, world_pos_y)  return 0,0,0,0,0,0,0,0,0,0 end
function BiomeMapLoad_KeepPlayer(filename, pixel_scenes)  return 0,0,0,0,0,0,0,0,0,0 end
function BiomeMapLoad(filename)  return 0,0,0,0,0,0,0,0,0,0 end
function BiomeSetValue(filename, field_name, value)  return 0,0,0,0,0,0,0,0,0,0 end
function BiomeGetValue(filename, field_name)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function BiomeObjectSetValue(filename, meta_object_name, field_name, value)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function BiomeVegetationSetValue(filename, material_name, field_name, value)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function BiomeMaterialSetValue(filename, material_name, field_name, value)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function BiomeMaterialGetValue(filename, material_name, field_name)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function GameIsIntroPlaying()  return false,false,false,false,false,false,false,false,false,false end
function GameGetIsGamepadConnected()  return false,false,false,false,false,false,false,false,false,false end
function GameGetWorldStateEntity()  return 0,0,0,0,0,0,0,0,0,0 end
function GameGetPlayerStatsEntity()  return 0,0,0,0,0,0,0,0,0,0 end
function GameGetOrbCountAllTime()  return 0,0,0,0,0,0,0,0,0,0 end
function GameGetOrbCountThisRun()  return 0,0,0,0,0,0,0,0,0,0 end
function GameGetOrbCollectedThisRun(orb_id_zero_based)  return false,false,false,false,false,false,false,false,false,false end
function GameGetOrbCollectedAllTime(orb_id_zero_based)  return false,false,false,false,false,false,false,false,false,false end
function GameClearOrbsFoundThisRun()  return false,false,false,false,false,false,false,false,false,false end
function GameGetOrbCountTotal()  return 0,0,0,0,0,0,0,0,0,0 end
function CellFactory_GetName(material_id)  return "","","","","","","","","","" end
function CellFactory_GetType(material_name)  return 0,0,0,0,0,0,0,0,0,0 end
function CellFactory_GetUIName(material_id)  return "","","","","","","","","","" end
function CellFactory_GetAllLiquids(include_statics, include_particle_fx_materials)  return {},{},{},{},{},{},{},{},{},{} end
function CellFactory_GetAllSands(include_statics, include_particle_fx_materials)  return {},{},{},{},{},{},{},{},{},{} end
function CellFactory_GetAllGases(include_statics, include_particle_fx_materials)  return {},{},{},{},{},{},{},{},{},{} end
function CellFactory_GetAllFires(include_statics, include_particle_fx_materials)  return {},{},{},{},{},{},{},{},{},{} end
function CellFactory_GetAllSolids(include_statics, include_particle_fx_materials)  return {},{},{},{},{},{},{},{},{},{} end
function CellFactory_GetTags(material_id)  return {},{},{},{},{},{},{},{},{},{} end
function CellFactory_HasTag(material_id, tag)  return {},{},{},{},{},{},{},{},{},{} end
function GameGetCameraPos()  return 0,0,0,0,0,0,0,0,0,0 end
function GameSetCameraPos(x, y)  return 0,0,0,0,0,0,0,0,0,0 end
function GameSetCameraFree(is_free)  return 0,0,0,0,0,0,0,0,0,0 end
function GameGetCameraBounds()  return 0,0,0,0,0,0,0,0,0,0 end
function GameRegenItemAction(entity_id)  return 0,0,0,0,0,0,0,0,0,0 end
function GameRegenItemActionsInContainer(entity_id)  return 0,0,0,0,0,0,0,0,0,0 end
function GameRegenItemActionsInPlayer(entity_id)  return 0,0,0,0,0,0,0,0,0,0 end
function GameKillInventoryItem(inventory_owner_entity_id, item_entity_id)  return 0,0,0,0,0,0,0,0,0,0 end
function GamePickUpInventoryItem(who_picks_up_entity_id, item_entity_id, do_pick_up_effects)  return 0,0,0,0,0,0,0,0,0,0 end
function GameGetAllInventoryItems(entity_id)  return {},{},{},{},{},{},{},{},{},{} end
function GameDropAllItems(entity_id)  return {},{},{},{},{},{},{},{},{},{} end
function GameDropPlayerInventoryItems(entity_id)  return {},{},{},{},{},{},{},{},{},{} end
function GameDestroyInventoryItems(entity_id)  return {},{},{},{},{},{},{},{},{},{} end
function GameIsInventoryOpen()  return false,false,false,false,false,false,false,false,false,false end
function GameTriggerGameOver()  return false,false,false,false,false,false,false,false,false,false end
function LoadPixelScene(materials_filename, colors_filename, x, y, background_file, skip_biome_checks, skip_edge_textures, color_to_material_table, background_z_index, load_even_if_duplicate)  return false,false,false,false,false,false,false,false,false,false end
function LoadBackgroundSprite(background_file, x, y, background_z_index, check_biome_corners)  return false,false,false,false,false,false,false,false,false,false end
function RemovePixelSceneBackgroundSprite(background_file, x, y)  return false,false,false,false,false,false,false,false,false,false end
function RemovePixelSceneBackgroundSprites(x_min, y_min, x_max, y_max)  return false,false,false,false,false,false,false,false,false,false end
function GameCreateCosmeticParticle(material_name, x, y, how_many, xvel, yvel, color, lifetime_min, lifetime_max, force_create, draw_front, collide_with_grid, randomize_velocity, gravity_x, gravity_y)  return false,false,false,false,false,false,false,false,false,false end
function GameCreateParticle(material_name, x, y, how_many, xvel, yvel, just_visual, draw_as_long, randomize_velocity)  return false,false,false,false,false,false,false,false,false,false end
function GameCreateSpriteForXFrames(filename, x, y, centered, sprite_offset_x, sprite_offset_y, frames, emissive)  return false,false,false,false,false,false,false,false,false,false end
function GameShootProjectile(shooter_entity, x, y, target_x, target_y, projectile_entity, send_message, verlet_parent_entity)  return false,false,false,false,false,false,false,false,false,false end
function EntityInflictDamage(entity, amount, damage_type, description, ragdoll_fx, impulse_x, impulse_y, entity_who_is_responsible, world_pos_x, world_pos_y, knockback_force)  return false,false,false,false,false,false,false,false,false,false end
function EntityIngestMaterial(entity, material_type, amount)  return false,false,false,false,false,false,false,false,false,false end
function EntityRemoveIngestionStatusEffect(entity, status_type_id)  return false,false,false,false,false,false,false,false,false,false end
function EntityRemoveStainStatusEffect(entity, status_type_id, status_cooldown)  return false,false,false,false,false,false,false,false,false,false end
function EntityAddRandomStains(entity, material_type, amount)  return false,false,false,false,false,false,false,false,false,false end
function EntitySetDamageFromMaterial(entity, material_name, damage)  return false,false,false,false,false,false,false,false,false,false end
function EntityRefreshSprite(entity, sprite_component)  return false,false,false,false,false,false,false,false,false,false end
function EntityGetWandCapacity(entity)  return 0,0,0,0,0,0,0,0,0,0 end
function EntityGetHotspot(entity, hotspot_tag, transformed, include_disabled_components)  return 0,0,0,0,0,0,0,0,0,0 end
function GamePlayAnimation(entity_id, name, priority, followup_name, followup_priority)  return 0,0,0,0,0,0,0,0,0,0 end
function GameGetVelocityCompVelocity(entity_id)  return 0,0,0,0,0,0,0,0,0,0 end
function GameGetGameEffect(entity_id, game_effect_name)  return 0,0,0,0,0,0,0,0,0,0 end
function GameGetGameEffectCount(entity_id, game_effect_name)  return 0,0,0,0,0,0,0,0,0,0 end
function LoadGameEffectEntityTo(entity_id, game_effect_entity_file)  return 0,0,0,0,0,0,0,0,0,0 end
function GetGameEffectLoadTo(entity_id, game_effect_name, always_load_new)  return 0,0,0,0,0,0,0,0,0,0 end
function PolymorphTableAddEntity(entity_xml, is_rare, add_only_one_copy)  return 0,0,0,0,0,0,0,0,0,0 end
function PolymorphTableRemoveEntity(entity_xml, from_common_table, from_rare_table)  return 0,0,0,0,0,0,0,0,0,0 end
function PolymorphTableGet(rare_table)  return {},{},{},{},{},{},{},{},{},{} end
function PolymorphTableSet()  return {},{},{},{},{},{},{},{},{},{} end
function SetPlayerSpawnLocation(x, y)  return {},{},{},{},{},{},{},{},{},{} end
function UnlockItem(action_id)  return {},{},{},{},{},{},{},{},{},{} end
function GameGetPotionColorUint(entity_id)  return 0,0,0,0,0,0,0,0,0,0 end
function EntityGetFirstHitboxCenter(entity_id)  return 0,0,0,0,0,0,0,0,0,0 end
function Raytrace(x1, y1, x2, y2)  return 0,0,0,0,0,0,0,0,0,0 end
function RaytraceSurfaces(x1, y1, x2, y2)  return 0,0,0,0,0,0,0,0,0,0 end
function RaytraceSurfacesAndLiquiform(x1, y1, x2, y2)  return 0,0,0,0,0,0,0,0,0,0 end
function RaytracePlatforms(x1, y1, x2, y2)  return 0,0,0,0,0,0,0,0,0,0 end
function FindFreePositionForBody(ideal_pos_x, idea_pos_y, velocity_x, velocity_y, body_radius)  return 0,0,0,0,0,0,0,0,0,0 end
function GetSurfaceNormal(pos_x, pos_y, ray_length, ray_count)  return 0,0,0,0,0,0,0,0,0,0 end
function GameGetSkyVisibility(pos_x, pos_y)  return 0,0,0,0,0,0,0,0,0,0 end
function GameGetFogOfWar(pos_x, pos_y)  return 0,0,0,0,0,0,0,0,0,0 end
function GameGetFogOfWarBilinear(pos_x, pos_y)  return 0,0,0,0,0,0,0,0,0,0 end
function GameSetFogOfWar(pos_x, pos_y, fog_of_war)  return false,false,false,false,false,false,false,false,false,false end
function DoesWorldExistAt(min_x, min_y, max_x, max_y)  return false,false,false,false,false,false,false,false,false,false end
function StringToHerdId(herd_name)  return 0,0,0,0,0,0,0,0,0,0 end
function HerdIdToString(herd_id)  return "","","","","","","","","","" end
function GetHerdRelation(herd_id_a, herd_id_b)  return 0,0,0,0,0,0,0,0,0,0 end
function EntityGetHerdRelation(entity_a, entity_b)  return 0,0,0,0,0,0,0,0,0,0 end
function EntityGetHerdRelationSafe(entity_a, entity_b)  return 0,0,0,0,0,0,0,0,0,0 end
function GenomeSetHerdId(entity_id, new_herd_id)  return 0,0,0,0,0,0,0,0,0,0 end
function EntityGetClosestWormAttractor(pos_x, pos_y)  return 0,0,0,0,0,0,0,0,0,0 end
function EntityGetClosestWormDetractor(pos_x, pos_y)  return 0,0,0,0,0,0,0,0,0,0 end
function GamePrint(log_line)  return 0,0,0,0,0,0,0,0,0,0 end
function GamePrintImportant(title, description, ui_custom_decoration_file)  return 0,0,0,0,0,0,0,0,0,0 end
function DEBUG_GetMouseWorld()  return 0,0,0,0,0,0,0,0,0,0 end
function DEBUG_MARK(x, y, message, color_r, color_g, color_b)  return 0,0,0,0,0,0,0,0,0,0 end
function GameGetFrameNum()  return 0,0,0,0,0,0,0,0,0,0 end
function GameGetRealWorldTimeSinceStarted()  return 0,0,0,0,0,0,0,0,0,0 end
function InputIsKeyDown(key_code)  return false,false,false,false,false,false,false,false,false,false end
function InputIsKeyJustDown(key_code)  return false,false,false,false,false,false,false,false,false,false end
function InputIsKeyJustUp(key_code)  return false,false,false,false,false,false,false,false,false,false end
function InputGetMousePosOnScreen()  return 0,0,0,0,0,0,0,0,0,0 end
function InputIsMouseButtonDown(mouse_button)  return false,false,false,false,false,false,false,false,false,false end
function InputIsMouseButtonJustDown(mouse_button)  return false,false,false,false,false,false,false,false,false,false end
function InputIsMouseButtonJustUp(mouse_button)  return false,false,false,false,false,false,false,false,false,false end
function InputIsJoystickButtonDown(joystick_index, joystick_button)  return false,false,false,false,false,false,false,false,false,false end
function InputIsJoystickButtonJustDown(joystick_index, joystick_button)  return false,false,false,false,false,false,false,false,false,false end
function InputGetJoystickAnalogButton(joystick_index, analog_button_index)  return 0,0,0,0,0,0,0,0,0,0 end
function InputIsJoystickConnected(joystick_index)  return false,false,false,false,false,false,false,false,false,false end
function InputGetJoystickAnalogStick(joystick_index, stick_id)  return 0,0,0,0,0,0,0,0,0,0 end
function IsPlayer(entity_id)  return false,false,false,false,false,false,false,false,false,false end
function IsInvisible(entity_id)  return false,false,false,false,false,false,false,false,false,false end
function GameIsDailyRun()  return false,false,false,false,false,false,false,false,false,false end
function GameIsDailyRunOrDailyPracticeRun()  return false,false,false,false,false,false,false,false,false,false end
function GameIsModeFullyDeterministic()  return false,false,false,false,false,false,false,false,false,false end
function GlobalsSetValue(key, value)  return false,false,false,false,false,false,false,false,false,false end
function GlobalsGetValue(key, default_value)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function MagicNumbersGetValue(key)  return "","","","","","","","","","" end
function SetWorldSeed(new_seed)  return "","","","","","","","","","" end
function SessionNumbersGetValue(key)  return "","","","","","","","","","" end
function SessionNumbersSetValue(key, value)  return "","","","","","","","","","" end
function SessionNumbersSave()  return "","","","","","","","","","" end
function AutosaveDisable()  return "","","","","","","","","","" end
function StatsGetValue(key)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function StatsGlobalGetValue(key)  return "","","","","","","","","","" end
function StatsBiomeGetValue(key)  return "","","","","","","","","","" end
function StatsBiomeReset()  return "","","","","","","","","","" end
function StatsLogPlayerKill(killed_entity_id)  return "","","","","","","","","","" end
function CreateItemActionEntity(action_id, x, y)  return 0,0,0,0,0,0,0,0,0,0 end
function GetRandomActionWithType(x, y, max_level, type, i)  return "","","","","","","","","","" end
function GetRandomAction(x, y, max_level, i)  return "","","","","","","","","","" end
function GameGetDateAndTimeUTC()  return 0,0,0,0,0,0,0,0,0,0 end
function GameGetDateAndTimeLocal()  return 0,0,0,0,0,0,0,0,0,0 end
function GameEmitRainParticles(num_particles, width_outside_camera, material_name, velocity_min, velocity_max, gravity, droplets_bounce, draw_as_long)  return 0,0,0,0,0,0,0,0,0,0 end
function GameCutThroughWorldVertical(x, y_min, y_max, radius, edge_darkening_width)  return 0,0,0,0,0,0,0,0,0,0 end
function BiomeMapSetSize(width, height)  return 0,0,0,0,0,0,0,0,0,0 end
function BiomeMapGetSize()  return 0,0,0,0,0,0,0,0,0,0 end
function BiomeMapSetPixel(x, y, color_int)  return 0,0,0,0,0,0,0,0,0,0 end
function BiomeMapGetPixel(x, y)  return 0,0,0,0,0,0,0,0,0,0 end
function BiomeMapConvertPixelFromUintToInt(color)  return 0,0,0,0,0,0,0,0,0,0 end
function BiomeMapLoadImage(x, y, image_filename)  return 0,0,0,0,0,0,0,0,0,0 end
function BiomeMapLoadImageCropped(x, y, image_filename, image_x, image_y, image_w, image_h)  return 0,0,0,0,0,0,0,0,0,0 end
function BiomeMapGetVerticalPositionInsideBiome(x, y)  return 0,0,0,0,0,0,0,0,0,0 end
function BiomeMapGetName(x, y)  return "","","","","","","","","","" end
function SetRandomSeed(x, y)  return "","","","","","","","","","" end
function Random(a, b)  return 0,0,0,0,0,0,0,0,0,0 end
function Randomf(min, max)  return 0,0,0,0,0,0,0,0,0,0 end
function RandomDistribution(min, max, mean, sharpness, baseline)  return 0,0,0,0,0,0,0,0,0,0 end
function RandomDistributionf(min, max, mean, sharpness, baseline)  return 0,0,0,0,0,0,0,0,0,0 end
function ProceduralRandom(x, y, a, b)  return 0,0,0,0,0,0,0,0,0,0 end
function ProceduralRandomf(x, y, a, b)  return 0,0,0,0,0,0,0,0,0,0 end
function ProceduralRandomi(x, y, a, b)  return 0,0,0,0,0,0,0,0,0,0 end
function PhysicsAddBodyImage(entity_id, image_file, material, offset_x, offset_y, centered, is_circle, material_image_file, use_image_as_colors)  return 0,0,0,0,0,0,0,0,0,0 end
function PhysicsAddBodyCreateBox(entity_id, material, offset_x, offset_y, width, height, centered)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function PhysicsAddJoint(entity_id, body_id0, body_id1, offset_x, offset_y, joint_type)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function PhysicsApplyForce(entity_id, force_x, force_y)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function PhysicsApplyTorque(entity_id, torque)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function PhysicsApplyTorqueToComponent(entity_id, component_id, torque)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function PhysicsApplyForceOnArea(calculate_force_for_body_fn, ignore_this_entity, area_min_x, area_min_y, area_max_x, area_max_y)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function PhysicsRemoveJoints(world_pos_min_x, world_pos_min_y, world_pos_max_x, world_pos_max_y)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function PhysicsSetStatic(entity_id, is_static)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function PhysicsGetComponentVelocity(entity_id, component_id)  return 0,0,0,0,0,0,0,0,0,0 end
function PhysicsGetComponentAngularVelocity(entity_id, component_id)  return 0,0,0,0,0,0,0,0,0,0 end
function PhysicsComponentGetTransform(component_id)  return 0,0,0,0,0,0,0,0,0,0 end
function PhysicsComponentSetTransform(component_id, x, y, angle, vel_x, vel_y, angular_vel)  return 0,0,0,0,0,0,0,0,0,0 end
function PhysicsBodyIDGetFromEntity(entity_id, component_id)  return {},{},{},{},{},{},{},{},{},{} end
function PhysicsBodyIDQueryBodies(world_pos_min_x, world_pos_min_y, world_pos_max_x, world_pos_max_y, include_static_bodies, are_these_box2d_units)  return {},{},{},{},{},{},{},{},{},{} end
function PhysicsBodyIDGetTransform(physics_body_id)  return 0,0,0,0,0,0,0,0,0,0 end
function PhysicsBodyIDSetTransform(physics_body_id, x, y, angle, vel_x, vel_y, angular_vel)  return 0,0,0,0,0,0,0,0,0,0 end
function PhysicsBodyIDApplyForce(physics_body_id, force_x, force_y, world_pos_x, world_pos_y)  return 0,0,0,0,0,0,0,0,0,0 end
function PhysicsBodyIDApplyLinearImpulse(physics_body_id, force_x, force_y, world_pos_x, world_pos_y)  return 0,0,0,0,0,0,0,0,0,0 end
function PhysicsBodyIDApplyTorque(physics_body_id, torque)  return 0,0,0,0,0,0,0,0,0,0 end
function PhysicsBodyIDGetWorldCenter(physics_body_id)  return 0,0,0,0,0,0,0,0,0,0 end
function PhysicsBodyIDGetDamping(physics_body_id)  return 0,0,0,0,0,0,0,0,0,0 end
function PhysicsBodyIDSetDamping(physics_body_id, linear_damping, angular_damping)  return 0,0,0,0,0,0,0,0,0,0 end
function PhysicsBodyIDGetGravityScale(physics_body_id)  return 0,0,0,0,0,0,0,0,0,0 end
function PhysicsBodyIDSetGravityScale(physics_body_id, gravity_scale)  return 0,0,0,0,0,0,0,0,0,0 end
function PhysicsBodyIDGetBodyAABB(physics_body_id)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function PhysicsBody2InitFromComponents(entity_id)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function PhysicsPosToGamePos(x, y)  return 0,0,0,0,0,0,0,0,0,0 end
function GamePosToPhysicsPos(x, y)  return 0,0,0,0,0,0,0,0,0,0 end
function PhysicsVecToGameVec(x, y)  return 0,0,0,0,0,0,0,0,0,0 end
function GameVecToPhysicsVec(x, y)  return 0,0,0,0,0,0,0,0,0,0 end
function LooseChunk(world_pos_x, world_pos_y, image_filename, max_durability)  return 0,0,0,0,0,0,0,0,0,0 end
function VerletApplyCircularForce(world_pos_x, world_pos_y, radius, force)  return 0,0,0,0,0,0,0,0,0,0 end
function VerletApplyDirectionalForce(world_pos_x, world_pos_y, radius, force_x, force_y)  return 0,0,0,0,0,0,0,0,0,0 end
function AddFlagPersistent(key)  return false,false,false,false,false,false,false,false,false,false end
function RemoveFlagPersistent(key)  return false,false,false,false,false,false,false,false,false,false end
function HasFlagPersistent(key)  return false,false,false,false,false,false,false,false,false,false end
function GameAddFlagRun(flag)  return false,false,false,false,false,false,false,false,false,false end
function GameRemoveFlagRun(flag)  return false,false,false,false,false,false,false,false,false,false end
function GameHasFlagRun(flag)  return false,false,false,false,false,false,false,false,false,false end
function GameTriggerMusicEvent(event_path, can_be_faded, x, y)  return false,false,false,false,false,false,false,false,false,false end
function GameTriggerMusicCue(name)  return false,false,false,false,false,false,false,false,false,false end
function GameTriggerMusicFadeOutAndDequeueAll(relative_fade_speed)  return false,false,false,false,false,false,false,false,false,false end
function GamePlaySound(bank_filename, event_path, x, y)  return false,false,false,false,false,false,false,false,false,false end
function GameEntityPlaySound(entity_id, event_name)  return false,false,false,false,false,false,false,false,false,false end
function GameEntityPlaySoundLoop(entity, component_tag, intensity, intensity2)  return false,false,false,false,false,false,false,false,false,false end
function GameSetPostFxParameter(parameter_name, x, y, z, w)  return false,false,false,false,false,false,false,false,false,false end
function GameUnsetPostFxParameter(parameter_name)  return false,false,false,false,false,false,false,false,false,false end
function GameSetPostFxTextureParameter(parameter_name, texture_filename, filtering_mode, wrapping_mode, update_texture)  return false,false,false,false,false,false,false,false,false,false end
function GameUnsetPostFxTextureParameter(name)  return false,false,false,false,false,false,false,false,false,false end
function GameTextGetTranslatedOrNot(text_or_key)  return "","","","","","","","","","" end
function GameTextGet(key, param0, param1, param2)  return "","","","","","","","","","" end
function GuiCreate()  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function GuiDestroy(gui)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function GuiStartFrame(gui)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function GuiOptionsAdd(gui, option)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function GuiOptionsRemove(gui, option)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function GuiOptionsClear(gui)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function GuiOptionsAddForNextWidget(gui, option)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function GuiColorSetForNextWidget(gui, red, green, blue, alpha)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function GuiZSet(gui, z)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function GuiZSetForNextWidget(gui, z)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function GuiIdPush(gui, id)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function GuiIdPushString(gui, str)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function GuiIdPop(gui)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function GuiAnimateBegin(gui)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function GuiAnimateEnd(gui)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function GuiAnimateAlphaFadeIn(gui, id, speed, step, reset)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function GuiAnimateScaleIn(gui, id, acceleration, reset)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function GuiText(gui, x, y, text, scale, font, font_is_pixel_font)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function GuiTextCentered(gui, x, y, text)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function GuiImage(gui, id, x, y, sprite_filename, alpha, scale, scale_y, rotation, rect_animation_playback_type, rect_animation_name)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function GuiImageNinePiece(gui, id, x, y, width, height, alpha, sprite_filename, sprite_highlight_filename)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function GuiButton(gui, id, x, y, text, scale, font, font_is_pixel_font)  return false,false,false,false,false,false,false,false,false,false end
function GuiImageButton(gui, id, x, y, text, sprite_filename)  return false,false,false,false,false,false,false,false,false,false end
function GuiSlider(gui, id, x, y, text, value, value_min, value_max, value_default, value_display_multiplier, value_formatting, width)  return 0,0,0,0,0,0,0,0,0,0 end
function GuiTextInput(gui, id, x, y, text, width, max_length, allowed_characters)  return "","","","","","","","","","" end
function GuiBeginAutoBox(gui)  return "","","","","","","","","","" end
function GuiEndAutoBoxNinePiece(gui, margin, size_min_x, size_min_y, mirrorize_over_x_axis, x_axis, sprite_filename, sprite_highlight_filename)  return "","","","","","","","","","" end
function GuiTooltip(gui, text, description)  return "","","","","","","","","","" end
function GuiBeginScrollContainer(gui, id, x, y, width, height, scrollbar_gamepad_focusable, margin_x, margin_y)  return "","","","","","","","","","" end
function GuiEndScrollContainer(gui)  return "","","","","","","","","","" end
function GuiLayoutBeginHorizontal(gui, x, y, position_in_ui_scale, margin_x, margin_y)  return "","","","","","","","","","" end
function GuiLayoutBeginVertical(gui, x, y, position_in_ui_scale, margin_x, margin_y)  return "","","","","","","","","","" end
function GuiLayoutAddHorizontalSpacing(gui, amount)  return "","","","","","","","","","" end
function GuiLayoutAddVerticalSpacing(gui, amount)  return "","","","","","","","","","" end
function GuiLayoutEnd(gui)  return "","","","","","","","","","" end
function GuiLayoutBeginLayer(gui)  return "","","","","","","","","","" end
function GuiLayoutEndLayer(gui)  return "","","","","","","","","","" end
function GuiGetScreenDimensions(gui)  return 0,0,0,0,0,0,0,0,0,0 end
function GuiGetTextDimensions(gui, text, scale, line_spacing, font, font_is_pixel_font)  return 0,0,0,0,0,0,0,0,0,0 end
function GuiGetImageDimensions(gui, image_filename, scale)  return 0,0,0,0,0,0,0,0,0,0 end
function GuiGetPreviousWidgetInfo(gui)  return 0,0,0,0,0,0,0,0,0,0 end
function GameIsBetaBuild()  return false,false,false,false,false,false,false,false,false,false end
function DebugGetIsDevBuild()  return false,false,false,false,false,false,false,false,false,false end
function DebugEnableTrailerMode()  return false,false,false,false,false,false,false,false,false,false end
function GameGetIsTrailerModeEnabled()  return false,false,false,false,false,false,false,false,false,false end
function Debug_SaveTestPlayer()  return false,false,false,false,false,false,false,false,false,false end
function DebugBiomeMapGetFilename(x, y)  return "","","","","","","","","","" end
function EntityConvertToMaterial(entity_id, material, use_material_colors)  return "","","","","","","","","","" end
function ConvertEverythingToGold(material_dynamic, material_static)  return "","","","","","","","","","" end
function ConvertMaterialEverywhere(material_from_type, material_to_type)  return "","","","","","","","","","" end
function ConvertMaterialOnAreaInstantly(area_x, area_y, area_w, area_h, material_from_type, material_to_type, trim_box2d, update_edge_graphics_dummy)  return "","","","","","","","","","" end
function LoadRagdoll(filename, pos_x, pos_y, material, scale_x, impulse_x, impulse_y)  return "","","","","","","","","","" end
function GetDailyPracticeRunSeed()  return 0,0,0,0,0,0,0,0,0,0 end
function ModIsEnabled(mod_id)  return false,false,false,false,false,false,false,false,false,false end
function ModGetActiveModIDs()  return {},{},{},{},{},{},{},{},{},{} end
function ModGetAPIVersion()  return 0,0,0,0,0,0,0,0,0,0 end
function ModDoesFileExist(filename)  return false,false,false,false,false,false,false,false,false,false end
function ModMaterialFilesGet()  return {},{},{},{},{},{},{},{},{},{} end
function ModSettingGet(id)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function ModSettingSet(id, value)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function ModSettingGetNextValue(id)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function ModSettingSetNextValue(id, value, is_default)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function ModSettingRemove(id)  return false,false,false,false,false,false,false,false,false,false end
function ModSettingGetCount()  return 0,0,0,0,0,0,0,0,0,0 end
function ModSettingGetAtIndex(index)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function StreamingGetIsConnected()  return false,false,false,false,false,false,false,false,false,false end
function StreamingGetConnectedChannelName()  return "","","","","","","","","","" end
function StreamingGetVotingCycleDurationFrames()  return 0,0,0,0,0,0,0,0,0,0 end
function StreamingGetRandomViewerName()  return "","","","","","","","","","" end
function StreamingGetSettingsGhostsNamedAfterViewers()  return false,false,false,false,false,false,false,false,false,false end
function StreamingSetCustomPhaseDurations(time_between_votes_seconds, time_voting_seconds)  return false,false,false,false,false,false,false,false,false,false end
function StreamingForceNewVoting()  return false,false,false,false,false,false,false,false,false,false end
function StreamingSetVotingEnabled(enabled)  return false,false,false,false,false,false,false,false,false,false end
function ModLuaFileAppend(to_filename, from_filename)  return false,false,false,false,false,false,false,false,false,false end
function ModLuaFileGetAppends(filename)  return {},{},{},{},{},{},{},{},{},{} end
function ModLuaFileSetAppends(filename, appends)  return {},{},{},{},{},{},{},{},{},{} end
function ModTextFileGetContent(filename)  return "","","","","","","","","","" end
function ModTextFileSetContent(filename, new_content)  return "","","","","","","","","","" end
function ModTextFileWhoSetContent(filename)  return "","","","","","","","","","" end
function ModImageMakeEditable(filename, width, height)  return 0,0,0,0,0,0,0,0,0,0 end
function ModImageIdFromFilename(filename)  return 0,0,0,0,0,0,0,0,0,0 end
function ModImageGetPixel(id, x, y)  return 0,0,0,0,0,0,0,0,0,0 end
function ModImageSetPixel(id, x, y, color)  return 0,0,0,0,0,0,0,0,0,0 end
function ModImageWhoSetContent(filename)  return "","","","","","","","","","" end
function ModImageDoesExist(filename)  return false,false,false,false,false,false,false,false,false,false end
function ModMagicNumbersFileAdd(filename)  return false,false,false,false,false,false,false,false,false,false end
function ModMaterialsFileAdd(filename)  return false,false,false,false,false,false,false,false,false,false end
function ModRegisterAudioEventMappings(filename)  return false,false,false,false,false,false,false,false,false,false end
function ModRegisterMusicBank(filename)  return false,false,false,false,false,false,false,false,false,false end
function ModDevGenerateSpriteUVsForDirectory(directory_path, override_existing)  return false,false,false,false,false,false,false,false,false,false end
function RegisterProjectile(entity_filename)  return false,false,false,false,false,false,false,false,false,false end
function RegisterGunAction(action_id, action_name, action_description, action_sprite_filename, action_unidentified_sprite_filename, action_type, action_spawn_level, action_spawn_probability, action_spawn_requires_flag, action_spawn_manual_unlock, action_max_uses, custom_xml_file, action_mana_drain, action_is_dangerous_blast, action_draw_many_count, action_ai_never_uses, action_never_unlimited, state_shuffled, state_cards_drawn, state_discarded_action, state_destroyed_action, fire_rate_wait, speed_multiplier, child_speed_multiplier, dampening, explosion_radius, spread_degrees, pattern_degrees, screenshake, recoil, damage_melee_add, damage_projectile_add, damage_electricity_add, damage_fire_add, damage_explosion_add, damage_ice_add, damage_slice_add, damage_healing_add, damage_curse_add, damage_drill_add, damage_null_all, damage_critical_chance, damage_critical_multiplier, explosion_damage_to_materials, knockback_force, reload_time, lightning_count, material, material_amount, trail_material, trail_material_amount, bounces, gravity, light, blood_count_multiplier, gore_particles, ragdoll_fx, friendly_fire, physics_impulse_coeff, lifetime_add, sprite, extra_entities, game_effect_entities, sound_loop_tag, projectile_file)  return false,false,false,false,false,false,false,false,false,false end
function RegisterGunShotEffects()  return false,false,false,false,false,false,false,false,false,false end
function BeginProjectile(entity_filename)  return false,false,false,false,false,false,false,false,false,false end
function EndProjectile()  return false,false,false,false,false,false,false,false,false,false end
function BeginTriggerTimer(timeout_frames)  return false,false,false,false,false,false,false,false,false,false end
function BeginTriggerHitWorld()  return false,false,false,false,false,false,false,false,false,false end
function BeginTriggerDeath()  return false,false,false,false,false,false,false,false,false,false end
function EndTrigger()  return false,false,false,false,false,false,false,false,false,false end
function SetProjectileConfigs()  return false,false,false,false,false,false,false,false,false,false end
function StartReload(reload_time)  return false,false,false,false,false,false,false,false,false,false end
function ActionUsesRemainingChanged(inventoryitem_id, uses_remaining)  return false,false,false,false,false,false,false,false,false,false end
function ActionUsed(inventoryitem_id)  return false,false,false,false,false,false,false,false,false,false end
function LogAction(action_name)  return false,false,false,false,false,false,false,false,false,false end
function OnActionPlayed(action_id)  return false,false,false,false,false,false,false,false,false,false end
function OnNotEnoughManaForAction()  return false,false,false,false,false,false,false,false,false,false end
function BaabInstruction(name)  return false,false,false,false,false,false,false,false,false,false end
function SetValueNumber(key, value)  return false,false,false,false,false,false,false,false,false,false end
function GetValueNumber(key, default_value)  return 0,0,0,0,0,0,0,0,0,0 end
function SetValueInteger(key, value)  return 0,0,0,0,0,0,0,0,0,0 end
function GetValueInteger(key, default_value)  return 0,0,0,0,0,0,0,0,0,0 end
function SetValueBool(key, value)  return 0,0,0,0,0,0,0,0,0,0 end
function GetValueBool(key, default_value)  return false,false,false,false,false,false,false,false,false,false end
function dofile(filename)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
function dofile_once(filename)  return nil,nil,nil,nil,nil,nil,nil,nil,nil,nil end
