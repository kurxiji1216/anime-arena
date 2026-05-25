import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveQuests, markDone } from '@/lib/game/quests'

// POST /api/upgrade/train
// Body: { targetCharacterId: string, trainerCharacterIds: string[] }
//
// Plain English: feeds duplicate copies of trainer cards into the target for
// XP. The whole thing — locking rows, summing yield, decrementing counts,
// deleting last copies, rolling up levels, awarding milestone gems — happens
// in ONE transaction inside the consume_trainers() DB function. Two concurrent
// trains can't double-spend a trainer card.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  let body: { targetCharacterId?: unknown; trainerCharacterIds?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (typeof body.targetCharacterId !== 'string'
      || !Array.isArray(body.trainerCharacterIds)
      || body.trainerCharacterIds.length === 0
      || !body.trainerCharacterIds.every(id => typeof id === 'string')) {
    return NextResponse.json({ error: 'Missing target or trainer list' }, { status: 400 })
  }
  const targetCharacterId = body.targetCharacterId
  const trainerCharacterIds = body.trainerCharacterIds as string[]

  if (trainerCharacterIds.includes(targetCharacterId)) {
    return NextResponse.json({ error: "Can't train a character with itself" }, { status: 400 })
  }

  const { data: rows, error } = await supabase.rpc('consume_trainers', {
    p_target_id:   targetCharacterId,
    p_trainer_ids: trainerCharacterIds,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  type TrainRow = {
    success: boolean
    error_message: string | null
    xp_gained: number
    levels_gained: number
    milestone_gems: number
    gems_total: number
    new_level: number
    new_xp: number
    max_level: number
  }
  const row = (rows as TrainRow[] | null)?.[0]
  if (!row) return NextResponse.json({ error: 'Train failed' }, { status: 500 })
  if (!row.success) return NextResponse.json({ error: row.error_message ?? 'Train failed' }, { status: 400 })

  // Tick level_up quest if any level happened (best effort)
  if (row.levels_gained > 0) {
    const { data: profile } = await supabase
      .from('profiles').select('daily_quests').eq('user_id', user.id).single()
    if (profile) {
      const updatedQuests = markDone(resolveQuests(profile.daily_quests), 'level_up')
      await supabase.from('profiles').update({ daily_quests: updatedQuests }).eq('user_id', user.id)
    }
  }

  return NextResponse.json({
    xpGained:         row.xp_gained,
    levelsGained:     row.levels_gained,
    milestoneGems:    row.milestone_gems,
    gemsTotal:        row.gems_total,
    newLevel:         row.new_level,
    newXp:            row.new_xp,
    maxLevel:         row.max_level,
    trainersConsumed: trainerCharacterIds,
  })
}
