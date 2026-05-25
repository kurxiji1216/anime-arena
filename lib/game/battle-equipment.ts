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
//
// On DB error we throw instead of silently returning an empty list — the
// caller (a battle route) should fail the request rather than fight without
// the player's equipment.
export async function fetchEquippedItems(
  supabase: SupabaseClient,
  userId:   string,
  characterId: string,
): Promise<Equipment[]> {
  const { data: rows, error } = await supabase
    .from('user_equipment')
    .select('equipment_key')
    .eq('user_id', userId)
    .eq('equipped_on_character_id', characterId)

  if (error) throw new Error(`Equipment fetch failed: ${error.message}`)

  // Drop any orphans (item key no longer in catalog) silently — that's recoverable.
  return (rows ?? [])
    .map(r => getEquipment(r.equipment_key))
    .filter((e): e is Equipment => e !== null)
}

// Given base effective stats (post level/star/rank), apply equipment stat bonuses
// AND merge equipment's ability-style effects into the character's ability.
//
// Plain English: equipment percent boosts (atkPct, hpPct, etc.) get folded INTO
// the base stats here. We also strip `statBuffPct` from the resulting ability so
// the battle engine doesn't apply the SAME percent a second time inside
// initFighter — that was the M15 double-stack bug.
export function buildEquippedFighterStats(
  baseStats:     { hp: number; atk: number; def: number; speed: number },
  characterName: string,
  equipped:      Equipment[],
): {
  stats:    { hp: number; atk: number; def: number; speed: number }
  ability:  Ability | null
} {
  const stats = applyEquipmentStats(baseStats, equipped)
  const ability = mergeAbilityWithEquipment(characterName, equipped)

  if (ability && ability.effect.statBuffPct) {
    // Fold the ability's statBuffPct into stats ourselves, then null it out so
    // the engine doesn't apply it again. Multiplicative on top of equipment.
    const sb = ability.effect.statBuffPct
    if (sb.hp)    stats.hp    = Math.round(stats.hp    * (1 + sb.hp))
    if (sb.atk)   stats.atk   = Math.round(stats.atk   * (1 + sb.atk))
    if (sb.def)   stats.def   = Math.round(stats.def   * (1 + sb.def))
    if (sb.speed) stats.speed = Math.round(stats.speed * (1 + sb.speed))
    ability.effect = { ...ability.effect, statBuffPct: undefined }
  }

  return { stats, ability }
}
