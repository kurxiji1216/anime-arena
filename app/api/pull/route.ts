import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveQuests, markDone } from '@/lib/game/quests'
import { PULL_HISTORY_MAX } from '@/lib/game/pulls'

// Plain English: ALL the critical state changes (deduct gems, increment pity,
// grant character, level player up, award milestone gems) happen inside the
// do_pull() Postgres function, which runs in a single transaction with a row
// lock on the player's profile. A player can't double-pull anymore.
//
// We update pull_history and daily_quests here in a separate write. Those are
// cosmetic — if a rare race momentarily loses one, no exploit is possible.

type DoPullRow = {
  success: boolean
  error_message: string | null
  character_id: string | null
  character_name: string | null
  character_rarity: 'common' | 'rare' | 'epic' | 'legendary' | null
  character_image_url: string | null
  character_source_anime: string | null
  character_base_hp: number | null
  character_base_atk: number | null
  character_base_def: number | null
  character_base_speed: number | null
  gems_remaining: number | null
  pity_counter_new: number | null
  is_new: boolean | null
  total_count: number | null
  player_xp_gained: number | null
  new_player_level: number | null
  new_player_xp: number | null
  milestone_gems: number | null
  player_leveled_up: boolean | null
}

const HUNTER_RANKS: { minLevel: number; rank: string }[] = [
  { minLevel: 10, rank: 'D' }, { minLevel: 20, rank: 'C' },
  { minLevel: 30, rank: 'B' }, { minLevel: 40, rank: 'A' },
  { minLevel: 50, rank: 'S' }, { minLevel: 60, rank: 'SS' },
  { minLevel: 70, rank: 'SSS' },
]

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  const { data: rows, error } = await supabase.rpc('do_pull')
  if (error)  return NextResponse.json({ error: error.message }, { status: 500 })
  const row = (rows as DoPullRow[] | null)?.[0]
  if (!row)   return NextResponse.json({ error: 'Pull failed' }, { status: 500 })
  if (!row.success) {
    return NextResponse.json({ error: row.error_message ?? 'Pull failed' }, { status: 400 })
  }

  // Reshape into the existing client response contract
  const character = {
    id:           row.character_id,
    name:         row.character_name,
    rarity:       row.character_rarity,
    image_url:    row.character_image_url,
    source_anime: row.character_source_anime,
    base_hp:      row.character_base_hp,
    base_atk:     row.character_base_atk,
    base_def:     row.character_base_def,
    base_speed:   row.character_base_speed,
  }

  // ── Best-effort cosmetic update: pull history + daily quest ──
  // Race-losing this only means the user sees a slightly-stale history;
  // it can't grant gems or duplicate a pull.
  const { data: profile } = await supabase
    .from('profiles')
    .select('daily_quests, pull_history')
    .eq('user_id', user.id)
    .single()
  if (profile) {
    const historyEntry = {
      name:     character.name,
      rarity:   character.rarity,
      imageUrl: character.image_url ?? null,
      isNew:    row.is_new,
      pulledAt: new Date().toISOString(),
    }
    const currentHistory = Array.isArray(profile.pull_history) ? profile.pull_history : []
    const updatedHistory = [historyEntry, ...currentHistory].slice(0, PULL_HISTORY_MAX)
    const updatedQuests  = markDone(resolveQuests(profile.daily_quests), 'do_pull')
    await supabase
      .from('profiles')
      .update({ pull_history: updatedHistory, daily_quests: updatedQuests })
      .eq('user_id', user.id)
  }

  // Surface a rank-up if the player crossed a Hunter Rank threshold
  let newPlayerRank: string | null = null
  if (row.player_leveled_up && row.new_player_level != null) {
    const crossed = HUNTER_RANKS.find(r => r.minLevel === row.new_player_level)
    newPlayerRank = crossed?.rank ?? null
  }

  return NextResponse.json({
    character,
    gemsRemaining: row.gems_remaining,
    isNew:         row.is_new,
    totalCount:    row.total_count,
    playerXpGained: row.player_xp_gained,
    newPlayerRank,
    pityCounter:   row.pity_counter_new,
  })
}
