import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveQuests, markDone } from '@/lib/game/quests'
import { applyPlayerXP, PLAYER_XP_REWARDS } from '@/lib/game/player'

const MULTI_COST  = 100
const MULTI_COUNT = 10

function pickRarity(): 'common' | 'rare' | 'epic' | 'legendary' {
  const roll = Math.random() * 100
  if (roll < 2)  return 'legendary'
  if (roll < 10) return 'epic'
  if (roll < 40) return 'rare'
  return 'common'
}

export async function POST() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('gems, daily_quests, player_level, player_xp')
    .eq('user_id', user.id)
    .single()

  if (!profile || profile.gems < MULTI_COST) {
    return NextResponse.json({ error: `Not enough gems. Need ${MULTI_COST} 💎` }, { status: 400 })
  }

  // Generate 10 rarities with soft pity: guarantee ≥1 rare+ across the batch
  const rarities: Array<'common' | 'rare' | 'epic' | 'legendary'> = Array.from(
    { length: MULTI_COUNT }, () => pickRarity()
  )
  const hasRarePlus = rarities.some(r => r !== 'common')
  if (!hasRarePlus) rarities[MULTI_COUNT - 1] = 'rare'   // last pull → at least rare

  // Fetch character pools for every rarity that appears
  const uniqueRarities = [...new Set(rarities)]
  const pools: Record<string, { id: string; name: string; source_anime: string; rarity: string; image_url: string | null; base_hp: number; base_atk: number; base_def: number; base_speed: number }[]> = {}

  await Promise.all(
    uniqueRarities.map(async rarity => {
      const { data } = await supabase.from('characters').select('*').eq('rarity', rarity)
      pools[rarity] = data ?? []
    })
  )

  // Pick one random character per slot
  const chosen = rarities.map(rarity => {
    const pool = pools[rarity]
    if (!pool || pool.length === 0) return null
    return pool[Math.floor(Math.random() * pool.length)]
  }).filter(Boolean)

  // Award player XP (5 per pull × 10)
  const totalPlayerXp  = PLAYER_XP_REWARDS.pull * MULTI_COUNT
  const playerXpResult = applyPlayerXP(profile.player_level ?? 1, profile.player_xp ?? 0, totalPlayerXp)

  // Update profile: deduct gems, mark quest, credit player XP
  const updatedQuests = markDone(resolveQuests(profile.daily_quests), 'do_pull')
  await supabase
    .from('profiles')
    .update({
      gems:         profile.gems - MULTI_COST + playerXpResult.gemsToAward,
      daily_quests: updatedQuests,
      player_level: playerXpResult.newLevel,
      player_xp:    playerXpResult.newXp,
    })
    .eq('user_id', user.id)

  // Upsert user_characters for each pull in parallel
  const pulls = await Promise.all(
    chosen.map(async character => {
      const { data: existing } = await supabase
        .from('user_characters')
        .select('id, count')
        .eq('user_id', user.id)
        .eq('character_id', character!.id)
        .single()

      let isNew = false
      let totalCount = 1

      if (existing) {
        totalCount = existing.count + 1
        await supabase
          .from('user_characters')
          .update({ count: totalCount, last_pulled_at: new Date().toISOString() })
          .eq('id', existing.id)
      } else {
        isNew = true
        await supabase.from('user_characters').insert({ user_id: user.id, character_id: character!.id })
      }

      return { character: character!, isNew, totalCount }
    })
  )

  return NextResponse.json({
    pulls,
    gemsRemaining: profile.gems - MULTI_COST + playerXpResult.gemsToAward,
    playerXpGained: totalPlayerXp,
    newPlayerRank:  playerXpResult.newRank,
  })
}
