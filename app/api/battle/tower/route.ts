import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runBattle, BattleFighter } from '@/lib/game/battle'
import { calcEffectiveStats, maxLevelForStars, applyXP, BATTLE_XP } from '@/lib/game/stats'
import { applyPlayerXP, playerStatBonus, PLAYER_XP_REWARDS } from '@/lib/game/player'

const GEMS_PER_FLOOR = 10

// Which rarities to pull from based on current floor
function rarityPoolForFloor(floor: number): string[] {
  if (floor <= 5)  return ['common']
  if (floor <= 15) return ['common', 'rare']
  if (floor <= 30) return ['rare']
  if (floor <= 50) return ['rare', 'epic']
  if (floor <= 75) return ['epic']
  if (floor <= 100) return ['epic', 'legendary']
  return ['legendary']
}

// Enemies get stronger each floor (+4% stats per floor above 1)
function scaleEnemy(char: BattleFighter, floor: number): BattleFighter {
  const multiplier = 1 + (floor - 1) * 0.04
  return {
    ...char,
    base_hp:    Math.round(char.base_hp    * multiplier),
    base_atk:   Math.round(char.base_atk   * multiplier),
    base_def:   Math.round(char.base_def   * multiplier),
    base_speed: Math.round(char.base_speed * multiplier),
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  const { characterId } = await request.json()

  // Get player profile (floor + gems)
  const { data: profile } = await supabase
    .from('profiles')
    .select('gems, tower_floor, tower_best_floor, player_level, player_xp, total_wins')
    .eq('user_id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const currentFloor = profile.tower_floor ?? 1

  // Verify player owns the chosen character + get upgrade info
  const { data: userChar } = await supabase
    .from('user_characters')
    .select('character_id, level, stars, xp')
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

  // Apply level + star upgrades, then player rank stat bonus (PvE only)
  const eff = calcEffectiveStats(playerBase, userChar.level ?? 1, userChar.stars ?? 1)
  const pBonus = playerStatBonus(profile?.player_level ?? 1)
  const playerChar = {
    ...playerBase,
    base_hp:    Math.round(eff.hp    * pBonus),
    base_atk:   Math.round(eff.atk   * pBonus),
    base_def:   Math.round(eff.def   * pBonus),
    base_speed: Math.round(eff.speed * pBonus),
  }

  // Pick a random enemy from the appropriate rarity pool
  const rarities = rarityPoolForFloor(currentFloor)
  const { data: enemyPool } = await supabase
    .from('characters')
    .select('*')
    .in('rarity', rarities)

  if (!enemyPool || enemyPool.length === 0) {
    return NextResponse.json({ error: 'No enemies available' }, { status: 500 })
  }

  const baseEnemy = enemyPool[Math.floor(Math.random() * enemyPool.length)]
  const scaledEnemy = scaleEnemy(baseEnemy, currentFloor)

  // Run battle
  const result = runBattle(playerChar, scaledEnemy)

  let gemsAwarded = 0
  let newFloor = currentFloor
  let newBest = profile.tower_best_floor ?? 0
  let xpGained = 0
  let levelsGained = 0
  let milestoneGems = 0
  let playerXpGained = 0
  let newPlayerRank: string | null = null

  if (result.winner === 'player') {
    gemsAwarded = GEMS_PER_FLOOR
    newFloor = currentFloor + 1
    newBest = Math.max(newBest, currentFloor)

    // Award card XP to the winning character (scales with floor difficulty)
    xpGained = BATTLE_XP.tower(currentFloor)
    const maxLevel = maxLevelForStars(userChar.stars ?? 1)
    const xpResult = applyXP(userChar.level ?? 1, userChar.xp ?? 0, xpGained, maxLevel)
    levelsGained = xpResult.levelsGained
    milestoneGems = xpResult.gemsToAward

    await supabase
      .from('user_characters')
      .update({ level: xpResult.newLevel, xp: xpResult.newXp })
      .eq('user_id', user.id)
      .eq('character_id', characterId)

    // Award player account XP
    playerXpGained = PLAYER_XP_REWARDS.towerWin
    const playerXpResult = applyPlayerXP(
      profile.player_level ?? 1,
      profile.player_xp ?? 0,
      playerXpGained,
    )
    newPlayerRank = playerXpResult.newRank

    await supabase
      .from('profiles')
      .update({
        gems:             profile.gems + gemsAwarded + milestoneGems + playerXpResult.gemsToAward,
        tower_floor:      newFloor,
        tower_best_floor: newBest,
        player_level:     playerXpResult.newLevel,
        player_xp:        playerXpResult.newXp,
        total_wins:       (profile.total_wins ?? 0) + 1,
      })
      .eq('user_id', user.id)
  } else {
    // Loss — reset floor to 1
    newFloor = 1
    await supabase
      .from('profiles')
      .update({ tower_floor: 1 })
      .eq('user_id', user.id)
  }

  return NextResponse.json({
    ...result,
    gemsAwarded,
    floorCleared: currentFloor,
    newFloor,
    bestFloor: newBest,
    enemyName: scaledEnemy.name,
    floorMultiplier: +(1 + (currentFloor - 1) * 0.04).toFixed(2),
    xpGained,
    levelsGained,
    milestoneGems,
    playerXpGained,
    newPlayerRank,
    enemyImageUrl: baseEnemy.image_url ?? null,
  })
}
