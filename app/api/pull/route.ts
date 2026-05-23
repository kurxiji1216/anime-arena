import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveQuests, markDone } from '@/lib/game/quests'
import { applyPlayerXP, PLAYER_XP_REWARDS } from '@/lib/game/player'

const PULL_COST   = 10
const HARD_PITY   = 90   // guaranteed legendary at this many pulls
const HISTORY_MAX = 20   // keep last N pulls in profile

function pickRarity(pityCounter: number): 'common' | 'rare' | 'epic' | 'legendary' {
  // Hard pity — override to legendary
  if (pityCounter >= HARD_PITY) return 'legendary'
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
    .select('gems, daily_quests, player_level, player_xp, pity_counter, total_pulls, pull_history')
    .eq('user_id', user.id)
    .single()

  if (!profile || profile.gems < PULL_COST) {
    return NextResponse.json({ error: 'Not enough gems' }, { status: 400 })
  }

  const pityCounter = profile.pity_counter ?? 0
  const rarity      = pickRarity(pityCounter)

  const { data: characters } = await supabase
    .from('characters')
    .select('*')
    .eq('rarity', rarity)

  if (!characters || characters.length === 0) {
    return NextResponse.json({ error: 'No characters available' }, { status: 500 })
  }

  const character = characters[Math.floor(Math.random() * characters.length)]

  // ── Upsert user_characters first so we know isNew ──
  const { data: existing } = await supabase
    .from('user_characters')
    .select('id, count')
    .eq('user_id', user.id)
    .eq('character_id', character.id)
    .single()

  let isNew      = false
  let totalCount = 1

  if (existing) {
    totalCount = existing.count + 1
    await supabase
      .from('user_characters')
      .update({ count: totalCount, last_pulled_at: new Date().toISOString() })
      .eq('id', existing.id)
  } else {
    isNew = true
    await supabase.from('user_characters').insert({ user_id: user.id, character_id: character.id })
  }

  // ── Build pull history entry ──
  const historyEntry = {
    name:      character.name,
    rarity:    character.rarity,
    imageUrl:  character.image_url ?? null,
    isNew,
    pulledAt:  new Date().toISOString(),
  }
  const currentHistory = Array.isArray(profile.pull_history) ? profile.pull_history : []
  const updatedHistory  = [historyEntry, ...currentHistory].slice(0, HISTORY_MAX)

  // ── Update pity counter ──
  const newPity = rarity === 'legendary' ? 0 : pityCounter + 1

  // ── Player XP + quests ──
  const updatedQuests  = markDone(resolveQuests(profile.daily_quests), 'do_pull')
  const playerXpResult = applyPlayerXP(profile.player_level ?? 1, profile.player_xp ?? 0, PLAYER_XP_REWARDS.pull)
  const gemsRemaining  = profile.gems - PULL_COST + playerXpResult.gemsToAward

  await supabase
    .from('profiles')
    .update({
      gems:         gemsRemaining,
      daily_quests: updatedQuests,
      player_level: playerXpResult.newLevel,
      player_xp:    playerXpResult.newXp,
      pity_counter: newPity,
      total_pulls:  (profile.total_pulls ?? 0) + 1,
      pull_history: updatedHistory,
    })
    .eq('user_id', user.id)

  return NextResponse.json({
    character,
    gemsRemaining,
    isNew,
    totalCount,
    playerXpGained: PLAYER_XP_REWARDS.pull,
    newPlayerRank:  playerXpResult.newRank,
    pityCounter:    newPity,
  })
}
