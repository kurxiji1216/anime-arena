import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveQuests, markDone } from '@/lib/game/quests'

// POST /api/upgrade/level — spend gems to bump a character's level by 1.
//
// Plain English: gem check + level bump happen in one row-locked transaction
// inside the DB. Two fast clicks → only one charges and bumps.

type LevelUpRow = {
  success: boolean
  error_message: string | null
  new_level: number
  gems_spent: number
  milestone_gems: number
  gems_remaining: number
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

  const { data: rows, error } = await supabase.rpc('level_up_character', { p_character_id: characterId })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const row = (rows as LevelUpRow[] | null)?.[0]
  if (!row) return NextResponse.json({ error: 'Level-up failed' }, { status: 500 })
  if (!row.success) return NextResponse.json({ error: row.error_message ?? 'Level-up failed' }, { status: 400 })

  // Tick the level_up daily quest as a best-effort follow-up
  const { data: profile } = await supabase
    .from('profiles').select('daily_quests').eq('user_id', user.id).single()
  if (profile) {
    const updatedQuests = markDone(resolveQuests(profile.daily_quests), 'level_up')
    await supabase.from('profiles').update({ daily_quests: updatedQuests }).eq('user_id', user.id)
  }

  return NextResponse.json({
    newLevel:      row.new_level,
    gemsSpent:     row.gems_spent,
    milestoneGems: row.milestone_gems,
    gemsRemaining: row.gems_remaining,
    maxLevel:      row.max_level,
  })
}
