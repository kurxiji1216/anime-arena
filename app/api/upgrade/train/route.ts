import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { applyXP, maxLevelForStars, trainerXpYield } from '@/lib/game/stats'
import { markDone, resolveQuests } from '@/lib/game/quests'

type Rarity = 'common' | 'rare' | 'epic' | 'legendary'

// POST /api/upgrade/train
// Body: { targetCharacterId: string, trainerCharacterIds: string[] }
// Feeds duplicate copies of the trainer characters into the target, awarding XP.
// Each trainer must have count > 1 — the last copy is never consumed.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  const { targetCharacterId, trainerCharacterIds }: {
    targetCharacterId:    string
    trainerCharacterIds:  string[]
  } = await request.json()

  if (!targetCharacterId || !Array.isArray(trainerCharacterIds) || trainerCharacterIds.length === 0) {
    return NextResponse.json({ error: 'Missing target or trainer list' }, { status: 400 })
  }

  if (trainerCharacterIds.includes(targetCharacterId)) {
    return NextResponse.json({ error: "Can't train a character with itself" }, { status: 400 })
  }

  // Fetch the target's current state
  const { data: target } = await supabase
    .from('user_characters')
    .select('level, stars, xp, character:characters(rarity)')
    .eq('user_id', user.id)
    .eq('character_id', targetCharacterId)
    .single()

  if (!target) return NextResponse.json({ error: "You don't own the target character" }, { status: 403 })

  const level    = target.level ?? 1
  const stars    = target.stars ?? 1
  const xp       = target.xp ?? 0
  const maxLevel = maxLevelForStars(stars)

  if (level >= maxLevel) {
    return NextResponse.json(
      { error: `Target is at max level (${maxLevel}) for ${stars}★. Star up first.` },
      { status: 400 },
    )
  }

  // Fetch all trainers with their counts + rarities (and their CURRENT levels for the XP formula)
  const { data: trainerRows } = await supabase
    .from('user_characters')
    .select('character_id, level, count, character:characters(rarity, name)')
    .eq('user_id', user.id)
    .in('character_id', trainerCharacterIds)

  if (!trainerRows || trainerRows.length !== trainerCharacterIds.length) {
    return NextResponse.json({ error: "You don't own one or more of those trainer cards" }, { status: 403 })
  }

  // Compute XP gain. Trainers with count > 1 lose one copy; trainers with count == 1
  // are fully consumed (the user_characters row is deleted below).
  let totalXp = 0
  for (const row of trainerRows) {
    if ((row.count ?? 1) < 1) {
      const char = row.character as unknown as { name: string } | null
      return NextResponse.json(
        { error: `You don't have any copies of ${char?.name ?? 'a trainer'} left.` },
        { status: 400 },
      )
    }
    const rarity = (row.character as unknown as { rarity: Rarity })?.rarity ?? 'common'
    totalXp += trainerXpYield(rarity, row.level ?? 1)
  }

  // Apply XP roll-over
  const xpResult = applyXP(level, xp, totalXp, maxLevel)

  // For each trainer: if they have multiple copies, decrement by 1; if it's the last copy,
  // delete the row entirely (also unequips any gear since equipped_on_character_id cascades to null).
  await Promise.all(
    trainerRows.map(row => {
      const current = row.count ?? 1
      if (current > 1) {
        return supabase
          .from('user_characters')
          .update({ count: current - 1 })
          .eq('user_id', user.id)
          .eq('character_id', row.character_id)
      }
      // Last copy — unequip any gear they had first, then delete the ownership row
      return supabase
        .from('user_equipment')
        .update({ equipped_on_character_id: null })
        .eq('user_id', user.id)
        .eq('equipped_on_character_id', row.character_id)
        .then(() =>
          supabase
            .from('user_characters')
            .delete()
            .eq('user_id', user.id)
            .eq('character_id', row.character_id),
        )
    }),
  )

  // Update the target's XP + level + mark daily quest done (level-up counts)
  const { data: profile } = await supabase
    .from('profiles')
    .select('gems, daily_quests')
    .eq('user_id', user.id)
    .single()

  const updates: { level?: number; xp?: number } = {
    level: xpResult.newLevel,
    xp:    xpResult.newXp,
  }
  await supabase
    .from('user_characters')
    .update(updates)
    .eq('user_id', user.id)
    .eq('character_id', targetCharacterId)

  // Award milestone gems + tick the level_up quest if any levels were gained
  let gemsTotal = profile?.gems ?? 0
  if (xpResult.levelsGained > 0) {
    const updatedQuests = markDone(resolveQuests(profile?.daily_quests), 'level_up')
    gemsTotal += xpResult.gemsToAward
    await supabase
      .from('profiles')
      .update({ gems: gemsTotal, daily_quests: updatedQuests })
      .eq('user_id', user.id)
  }

  return NextResponse.json({
    xpGained:      totalXp,
    levelsGained:  xpResult.levelsGained,
    milestoneGems: xpResult.gemsToAward,
    gemsTotal,
    newLevel:      xpResult.newLevel,
    newXp:         xpResult.newXp,
    maxLevel,
    trainersConsumed: trainerRows.map(r => r.character_id),
  })
}
