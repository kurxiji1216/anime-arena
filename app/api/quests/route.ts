import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveQuests, type QuestKey } from '@/lib/game/quests'

// GET /api/quests — fetch today's quests (initialises if new day)
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('daily_quests, gems')
    .eq('user_id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const quests = resolveQuests(profile.daily_quests)

  // Persist if quests were reset (new day)
  if (!profile.daily_quests || (profile.daily_quests as { date?: string }).date !== quests.date) {
    await supabase.from('profiles').update({ daily_quests: quests }).eq('user_id', user.id)
  }

  return NextResponse.json({ quests })
}

// POST /api/quests — claim reward for a completed quest.
//
// Plain English: the eligibility check (is the quest done? not already
// claimed?) AND the gem grant happen inside one row-locked DB function, so
// two fast clicks can't both award the reward.
type ClaimQuestRow = {
  success: boolean
  error_message: string | null
  gems_awarded: number
  gems_total: number
  player_xp_gained: number
  new_player_level: number
  new_player_xp: number
  milestone_gems: number
  player_leveled_up: boolean
}

const HUNTER_RANKS: { minLevel: number; rank: string }[] = [
  { minLevel: 10, rank: 'D' }, { minLevel: 20, rank: 'C' },
  { minLevel: 30, rank: 'B' }, { minLevel: 40, rank: 'A' },
  { minLevel: 50, rank: 'S' }, { minLevel: 60, rank: 'SS' },
  { minLevel: 70, rank: 'SSS' },
]

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  let body: { key?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (typeof body.key !== 'string') return NextResponse.json({ error: 'Missing quest key' }, { status: 400 })
  const key = body.key as QuestKey

  const { data: rows, error } = await supabase.rpc('claim_quest', { p_key: key })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const row = (rows as ClaimQuestRow[] | null)?.[0]
  if (!row)  return NextResponse.json({ error: 'Claim failed' }, { status: 500 })
  if (!row.success) {
    return NextResponse.json({ error: row.error_message ?? 'Claim failed' }, { status: 400 })
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
