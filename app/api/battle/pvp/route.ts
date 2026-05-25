import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runBattle } from '@/lib/game/battle'
import { fetchEquippedItems, buildEquippedFighterStats } from '@/lib/game/battle-equipment'
import { calcEffectiveStats, BATTLE_XP } from '@/lib/game/stats'
import { PLAYER_XP_REWARDS, getHunterRank } from '@/lib/game/player'
import { resolveQuests, markDone } from '@/lib/game/quests'

const WIN_REWARD = 15

// Plain English: in PvP we no longer pick the opponent's STRONGEST card — that
// made early players face veterans' legendaries. Now we pick a random opponent,
// then a random card of theirs. All reward + battle-count writes happen
// atomically in grant_pvp_rewards().

type OppCharacter = {
  id: string
  name: string
  rarity: string
  base_hp: number
  base_atk: number
  base_def: number
  base_speed: number
  image_url: string | null
  source_anime: string
}

type OppRow = {
  user_id: string
  character_id: string
  level: number | null
  stars: number | null
  character: OppCharacter | null
}

type PvpGrantRow = {
  success: boolean
  error_message: string | null
  gems_total: number
  char_levels_gained: number
  char_new_level: number
  char_new_xp: number
  milestone_gems: number
  player_new_level: number
  player_new_xp: number
  player_leveled_up: boolean
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  let body: { characterId?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (typeof body.characterId !== 'string') {
    return NextResponse.json({ error: 'Missing characterId' }, { status: 400 })
  }
  const characterId = body.characterId

  const { data: userChar } = await supabase
    .from('user_characters')
    .select('level, stars, xp')
    .eq('user_id', user.id)
    .eq('character_id', characterId)
    .single()
  if (!userChar) return NextResponse.json({ error: "You don't own that character" }, { status: 403 })

  const { data: playerBase } = await supabase
    .from('characters')
    .select('*')
    .eq('id', characterId)
    .single()
  if (!playerBase) return NextResponse.json({ error: 'Character not found' }, { status: 404 })

  // PvP intentionally has no rank stat bonus — fair matchmaking
  const eff = calcEffectiveStats(playerBase, userChar.level ?? 1, userChar.stars ?? 1)
  const equipped = await fetchEquippedItems(supabase, user.id, characterId)
  const { stats: finalStats, ability: finalAbility } = buildEquippedFighterStats(
    { hp: eff.hp, atk: eff.atk, def: eff.def, speed: eff.speed },
    playerBase.name,
    equipped,
  )
  const playerChar = {
    ...playerBase,
    base_hp:    finalStats.hp,
    base_atk:   finalStats.atk,
    base_def:   finalStats.def,
    base_speed: finalStats.speed,
    ability:    finalAbility,
  }

  // Find a random opponent. TODO: level-matched matchmaking via RPC.
  const { data: opponentRows, error: oppErr } = await supabase
    .from('user_characters')
    .select('user_id, character_id, level, stars, character:characters(id, name, rarity, image_url, source_anime, base_hp, base_atk, base_def, base_speed)')
    .neq('user_id', user.id)
    .limit(500)

  if (oppErr) return NextResponse.json({ error: 'Matchmaking error' }, { status: 500 })
  const oppRows = (opponentRows ?? []) as unknown as OppRow[]
  if (oppRows.length === 0) {
    return NextResponse.json({ error: 'No opponents found yet — check back once more players have joined!' }, { status: 404 })
  }

  const distinctUserIds = [...new Set(oppRows.map(r => r.user_id))]
  const oppUserId = shuffle(distinctUserIds)[0]
  const theirCards = oppRows.filter(r => r.user_id === oppUserId && r.character != null)
  if (theirCards.length === 0) {
    return NextResponse.json({ error: 'No opponents found yet' }, { status: 404 })
  }
  const best = shuffle(theirCards)[0]

  const oppBase = best.character!
  const oppEff = calcEffectiveStats(oppBase, best.level ?? 1, best.stars ?? 1)
  const oppEquipped = await fetchEquippedItems(supabase, best.user_id, best.character_id)
  const { stats: oppFinalStats, ability: oppFinalAbility } = buildEquippedFighterStats(
    { hp: oppEff.hp, atk: oppEff.atk, def: oppEff.def, speed: oppEff.speed },
    oppBase.name,
    oppEquipped,
  )
  const enemyChar = {
    ...oppBase,
    base_hp:    oppFinalStats.hp,
    base_atk:   oppFinalStats.atk,
    base_def:   oppFinalStats.def,
    base_speed: oppFinalStats.speed,
    ability:    oppFinalAbility,
  }

  const { data: oppProfile } = await supabase
    .from('profiles')
    .select('username')
    .eq('user_id', best.user_id)
    .single()
  const opponentName = oppProfile?.username ?? 'Unknown Player'

  const result = runBattle(playerChar, enemyChar)

  const xpGained       = result.winner === 'player' ? BATTLE_XP.pvpWin : 0
  const playerXpGained = result.winner === 'player' ? PLAYER_XP_REWARDS.pvpWin : 0

  const { data: rows, error } = await supabase.rpc('grant_pvp_rewards', {
    p_result:       result.winner,
    p_character_id: characterId,
    p_gem_reward:   result.winner === 'player' ? WIN_REWARD : 0,
    p_char_xp:      xpGained,
    p_player_xp:    playerXpGained,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const row = (rows as PvpGrantRow[] | null)?.[0]
  if (!row || !row.success) return NextResponse.json({ error: row?.error_message ?? 'PvP update failed' }, { status: 500 })

  const gemsAwarded   = result.winner === 'player' ? WIN_REWARD : 0
  const levelsGained  = row.char_levels_gained
  const milestoneGems = row.milestone_gems
  let newPlayerRank: string | null = null
  if (row.player_leveled_up) newPlayerRank = getHunterRank(row.player_new_level).rank

  // Best-effort quest tick
  if (levelsGained > 0) {
    const { data: prof } = await supabase.from('profiles').select('daily_quests').eq('user_id', user.id).single()
    if (prof) {
      const updatedQuests = markDone(resolveQuests(prof.daily_quests), 'level_up')
      await supabase.from('profiles').update({ daily_quests: updatedQuests }).eq('user_id', user.id)
    }
  }

  return NextResponse.json({
    ...result,
    gemsAwarded,
    opponentName,
    opponentCharacter: oppBase.name,
    xpGained,
    levelsGained,
    milestoneGems,
    playerXpGained,
    newPlayerRank,
    enemyImageUrl: oppBase.image_url ?? null,
  })
}
