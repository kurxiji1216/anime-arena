// ─── Battle-time equipment helpers ────────────────────────────────────────────
//
// Server-side helper that fetches a character's equipped items and produces
// the final stat + ability values to pass into runBattle().

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  type Equipment,
  getEquipment,
  applyEquipmentStats,
  mergeAbilityWithEquipment,
} from './equipment'
import type { Ability } from './abilities'

// Fetch the items currently equipped on a given character (server-side).
// Pass the already-resolved Supabase server client to avoid recreating it.
export async function fetchEquippedItems(
  supabase: SupabaseClient,
  userId:   string,
  characterId: string,
): Promise<Equipment[]> {
  const { data: rows } = await supabase
    .from('user_equipment')
    .select('equipment_key')
    .eq('user_id', userId)
    .eq('equipped_on_character_id', characterId)

  return (rows ?? [])
    .map(r => getEquipment(r.equipment_key))
    .filter((e): e is Equipment => e !== null)
}

// Given base effective stats (post level/star/rank), apply equipment stat bonuses
// AND merge equipment's ability-style effects into the character's ability.
export function buildEquippedFighterStats(
  baseStats:     { hp: number; atk: number; def: number; speed: number },
  characterName: string,
  equipped:      Equipment[],
): {
  stats:    { hp: number; atk: number; def: number; speed: number }
  ability:  Ability | null
} {
  return {
    stats:   applyEquipmentStats(baseStats, equipped),
    ability: mergeAbilityWithEquipment(characterName, equipped),
  }
}
