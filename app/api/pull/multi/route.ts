import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveQuests, markDone } from '@/lib/game/quests'
import { PULL_HISTORY_MAX, type Rarity } from '@/lib/game/pulls'

type PullEntry = {
  character: {
    id: string
    name: string
    rarity: Rarity
    image_url: string | null
    source_anime: string
    base_hp: number
    base_atk: number
    base_def: number
    base_speed: number
  }
  isNew: boolean
  totalCount: number
}

type DoMultiPullRow = {
  success: boolean
  error_message: string | null
  gems_remaining: number | null
  pity_counter_new: number | null
  player_xp_gained: number | null
  new_player_level: number | null
  new_player_xp: number | null
  milestone_gems: number | null
  player_leveled_up: boolean | null
  pulls: PullEntry[] | null
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

  const { data: rows, error } = await supabase.rpc('do_multi_pull')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const row = (rows as DoMultiPullRow[] | null)?.[0]
  if (!row)  return NextResponse.json({ error: 'Multi-pull failed' }, { status: 500 })
  if (!row.success) {
    return NextResponse.json({ error: row.error_message ?? 'Multi-pull failed' }, { status: 400 })
  }

  const pulls = row.pulls ?? []

  // Best-effort cosmetic update — pull history + daily quest. See single-pull
  // route for why these don't need atomic guarantees.
  const { data: profile } = await supabase
    .from('profiles')
    .select('daily_quests, pull_history')
    .eq('user_id', user.id)
    .single()
  if (profile) {
    const newEntries = pulls.map(p => ({
      name:     p.character.name,
      rarity:   p.character.rarity,
      imageUrl: p.character.image_url ?? null,
      isNew:    p.isNew,
      pulledAt: new Date().toISOString(),
    }))
    const currentHistory = Array.isArray(profile.pull_history) ? profile.pull_history : []
    const updatedHistory = [...newEntries, ...currentHistory].slice(0, PULL_HISTORY_MAX)
    const updatedQuests  = markDone(resolveQuests(profile.daily_quests), 'do_pull')
    await supabase
      .from('profiles')
      .update({ pull_history: updatedHistory, daily_quests: updatedQuests })
      .eq('user_id', user.id)
  }

  // Hunter rank crossing
  let newPlayerRank: string | null = null
  if (row.player_leveled_up && row.new_player_level != null) {
    const crossed = HUNTER_RANKS.find(r => r.minLevel === row.new_player_level)
    newPlayerRank = crossed?.rank ?? null
  }

  return NextResponse.json({
    pulls,
    gemsRemaining:  row.gems_remaining,
    playerXpGained: row.player_xp_gained,
    newPlayerRank,
    pityCounter:    row.pity_counter_new,
  })
}
