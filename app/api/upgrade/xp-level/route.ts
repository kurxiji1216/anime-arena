import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveQuests, markDone } from '@/lib/game/quests'

// POST /api/upgrade/xp-level — spend BANKED battle XP to level up.
//
// Plain English: drains all the XP that fits into as many levels as possible
// in one click. Both the XP roll-over and the milestone gem grant happen
// atomically inside xp_level_up_character().

type XpLevelRow = {
  success: boolean
  error_message: string | null
  new_level: number
  new_xp: number
  levels_gained: number
  milestone_gems: number
  gems_total: number
  max_level: number
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  let body: { characterId?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (typeof body.characterId !== 'string') return NextResponse.json({ error: 'Missing characterId' }, { status: 400 })
  const characterId = body.characterId

  const { data: rows, error } = await supabase.rpc('xp_level_up_character', { p_character_id: characterId })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const row = (rows as XpLevelRow[] | null)?.[0]
  if (!row) return NextResponse.json({ error: 'Level-up failed' }, { status: 500 })
  if (!row.success) return NextResponse.json({ error: row.error_message ?? 'Level-up failed' }, { status: 400 })

  // Best-effort: tick the level_up daily quest
  const { data: profile } = await supabase
    .from('profiles').select('daily_quests').eq('user_id', user.id).single()
  if (profile) {
    const updatedQuests = markDone(resolveQuests(profile.daily_quests), 'level_up')
    await supabase.from('profiles').update({ daily_quests: updatedQuests }).eq('user_id', user.id)
  }

  return NextResponse.json({
    newLevel:      row.new_level,
    newXp:         row.new_xp,
    levelsGained:  row.levels_gained,
    milestoneGems: row.milestone_gems,
    gemsTotal:     row.gems_total,
    maxLevel:      row.max_level,
  })
}
