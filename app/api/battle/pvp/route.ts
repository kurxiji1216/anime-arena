import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runBattle } from '@/lib/game/battle'
import { getAbility } from '@/lib/game/abilities'
import { fetchEquippedItems, buildEquippedFighterStats } from '@/lib/game/battle-equipment'
import { calcEffectiveStats, maxLevelForStars, applyXP, BATTLE_XP } from '@/lib/game/stats'
import { applyPlayerXP, PLAYER_XP_REWARDS } from '@/lib/game/player'

const RARITY_ORDER: Record<string, number> = { legendary: 4, epic: 3, rare: 2, common: 1 }
const WIN_REWARD = 15

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  const { characterId } = await request.json()

  // Verify the player owns this character and get their upgrade info
  const { data: userChar } = await supabase
    .from('user_characters')
    .select('level, stars, xp')
    .eq('user_id', user.id)
    .eq('character_id', characterId)
    .single()

  if (!userChar) return NextResponse.json({ error: "You don't own that character" }, { status: 403 })

  // Fetch player character base stats
  const { data: playerBase } = await supabase
    .from('characters')
    .select('*')
    .eq('id', characterId)
    .single()

  if (!playerBase) return NextResponse.json({ error: 'Character not found' }, { status: 404 })

  // Apply level + star upgrades (PvP intentionally has no rank stat bonus — fair matchmaking)
  const eff = calcEffectiveStats(playerBase, userChar.level ?? 1, userChar.stars ?? 1)
  const equipped = await fetchEquippedItems(supabase, user.id, characterId)
  const { stats: finalStats, ability: finalAbility } = buildEquippedFighterStats(
    { hp: eff.hp, atk: eff.atk, def: eff.def, speed: eff.speed },
    playerBase.name,
    equipped,
  )
  const playerChar = { ...playerBase, base_hp: finalStats.hp, base_atk: finalStats.atk, base_def: finalStats.def, base_speed: finalStats.speed, ability: finalAbility }

  // Find a random opponent — any other user who owns at least one character
  const { data: opponentRows } = await supabase
    .from('user_characters')
    .select('user_id, character_id, level, stars, character:characters(id, name, rarity, base_hp, base_atk, base_def, base_speed)')
    .neq('user_id', user.id)

  if (!opponentRows || opponentRows.length === 0) {
    return NextResponse.json({ error: 'No opponents found yet — check back once more players have joined!' }, { status: 404 })
  }

  // Pick the strongest character (highest rarity, then highest level) from a random opponent
  const shuffled = [...opponentRows].sort(() => Math.random() - 0.5)
  const best = shuffled.reduce((a, b) => {
    const aRarity = RARITY_ORDER[(a.character as any).rarity] ?? 0
    const bRarity = RARITY_ORDER[(b.character as any).rarity] ?? 0
    if (bRarity !== aRarity) return bRarity > aRarity ? b : a
    return (b.level ?? 1) > (a.level ?? 1) ? b : a
  })

  const oppBase = best.character as any
  const oppEff = calcEffectiveStats(oppBase, best.level ?? 1, best.stars ?? 1)
  const oppEquipped = await fetchEquippedItems(supabase, best.user_id, best.character_id)
  const { stats: oppFinalStats, ability: oppFinalAbility } = buildEquippedFighterStats(
    { hp: oppEff.hp, atk: oppEff.atk, def: oppEff.def, speed: oppEff.speed },
    oppBase.name,
    oppEquipped,
  )
  const enemyChar = { ...oppBase, base_hp: oppFinalStats.hp, base_atk: oppFinalStats.atk, base_def: oppFinalStats.def, base_speed: oppFinalStats.speed, ability: oppFinalAbility }

  // Get the opponent's username for display
  const { data: oppProfile } = await supabase
    .from('profiles')
    .select('username')
    .eq('user_id', best.user_id)
    .single()

  const opponentName = oppProfile?.username ?? 'Unknown Player'

  // Run the battle
  const result = runBattle(playerChar, enemyChar)

  // Update player's PvP record
  const { data: profile } = await supabase
    .from('profiles')
    .select('gems, pvp_wins, pvp_battles, player_level, player_xp, total_wins')
    .eq('user_id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 500 })

  const gemsAwarded = result.winner === 'player' ? WIN_REWARD : 0
  let xpGained = 0
  let levelsGained = 0
  let milestoneGems = 0
  let playerXpGained = 0
  let newPlayerRank: string | null = null

  if (result.winner === 'player') {
    // Award card XP to winning character
    xpGained = BATTLE_XP.pvpWin
    const maxLevel = maxLevelForStars(userChar.stars ?? 1)
    const xpResult = applyXP(userChar.level ?? 1, userChar.xp ?? 0, xpGained, maxLevel)
    levelsGained = xpResult.levelsGained
    milestoneGems = xpResult.gemsToAward

    await supabase
      .from('user_characters')
      .update({ level: xpResult.newLevel, xp: xpResult.newXp })
      .eq('user_id', user.id)
      .eq('character_id', characterId)

    // Award player account XP (no stat bonus in PvP — fair matchmaking)
    playerXpGained = PLAYER_XP_REWARDS.pvpWin
    const playerXpResult = applyPlayerXP(
      profile.player_level ?? 1,
      profile.player_xp ?? 0,
      playerXpGained,
    )
    newPlayerRank = playerXpResult.newRank

    await supabase
      .from('profiles')
      .update({
        pvp_wins:     profile.pvp_wins + 1,
        pvp_battles:  profile.pvp_battles + 1,
        gems:         profile.gems + gemsAwarded + milestoneGems + playerXpResult.gemsToAward,
        player_level: playerXpResult.newLevel,
        player_xp:    playerXpResult.newXp,
        total_wins:   (profile.total_wins ?? 0) + 1,
      })
      .eq('user_id', user.id)
  } else {
    // Loss — still count battle, no gems or XP
    await supabase
      .from('profiles')
      .update({
        pvp_battles: profile.pvp_battles + 1,
      })
      .eq('user_id', user.id)
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
