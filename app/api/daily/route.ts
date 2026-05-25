import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveQuests, markDone } from '@/lib/game/quests'

// Plain English: claims today's daily bonus. The 24h check + the gem grant
// happen atomically in the claim_daily() DB function, so two fast clicks
// can't both succeed.
type ClaimDailyRow = {
  success: boolean
  error_message: string | null
  gems_awarded: number | null
  gems_total: number | null
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

  const { data: rows, error } = await supabase.rpc('claim_daily')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const row = (rows as ClaimDailyRow[] | null)?.[0]
  if (!row)  return NextResponse.json({ error: 'Claim failed' }, { status: 500 })
  if (!row.success) {
    return NextResponse.json({ error: row.error_message ?? 'Claim failed' }, { status: 400 })
  }

  // Tick the claim_daily quest as a best-effort follow-up
  const { data: profile } = await supabase
    .from('profiles').select('daily_quests').eq('user_id', user.id).single()
  if (profile) {
    const updatedQuests = markDone(resolveQuests(profile.daily_quests), 'claim_daily')
    await supabase.from('profiles').update({ daily_quests: updatedQuests }).eq('user_id', user.id)
  }

  let newPlayerRank: string | null = null
  if (row.player_leveled_up && row.new_player_level != null) {
    newPlayerRank = HUNTER_RANKS.find(r => r.minLevel === row.new_player_level)?.rank ?? null
  }

  return NextResponse.json({
    gemsAwarded:    row.gems_awarded,
    gemsTotal:      row.gems_total,
    playerXpGained: row.player_xp_gained,
    newPlayerRank,
  })
}
