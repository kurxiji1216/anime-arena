import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runBattle } from '@/lib/game/battle'
import { getAbility } from '@/lib/game/abilities'
import { rollEquipmentDrop } from '@/lib/game/equipment-drops'
import { getStage, isStageUnlocked, stageEnemyMultiplier, stageGemReward, arcCompleteBonus } from '@/lib/game/campaign'
import { calcEffectiveStats, maxLevelForStars, applyXP, BATTLE_XP } from '@/lib/game/stats'
import { applyPlayerXP, playerStatBonus, PLAYER_XP_REWARDS } from '@/lib/game/player'

const REPLAY_REWARD = 5

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  const { characterId, arc, stage } = await request.json()

  // Validate arc and stage numbers
  const stageConfig = getStage(arc, stage)
  if (!stageConfig) return NextResponse.json({ error: 'Invalid arc or stage' }, { status: 400 })

  // Fetch player's campaign progress
  const { data: progressRows } = await supabase
    .from('campaign_progress')
    .select('arc, stage')
    .eq('user_id', user.id)

  const cleared = progressRows ?? []

  // Check stage is unlocked
  if (!isStageUnlocked(arc, stage, cleared)) {
    return NextResponse.json({ error: 'Complete the previous stage first' }, { status: 403 })
  }

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

  // Fetch profile early — needed for player rank bonus before battle
  const { data: profile } = await supabase
    .from('profiles')
    .select('gems, player_level, player_xp, total_wins')
    .eq('user_id', user.id)
    .single()

  // Apply level + star upgrades, then player rank stat bonus (PvE only)
  const eff = calcEffectiveStats(playerBase, userChar.level ?? 1, userChar.stars ?? 1)
  const pBonus = playerStatBonus(profile?.player_level ?? 1)
  const playerChar = {
    ...playerBase,
    base_hp:    Math.round(eff.hp    * pBonus),
    base_atk:   Math.round(eff.atk   * pBonus),
    base_def:   Math.round(eff.def   * pBonus),
    base_speed: Math.round(eff.speed * pBonus),
    ability:    getAbility(playerBase.name),
  }

  // Fetch enemy character by name from campaign config
  const { data: enemyChar } = await supabase
    .from('characters')
    .select('*')
    .eq('name', stageConfig.enemyName)
    .single()

  if (!enemyChar) return NextResponse.json({ error: `Enemy "${stageConfig.enemyName}" not found in database` }, { status: 500 })

  // Scale enemy stats by arc difficulty + stage position
  const enemyMult = stageEnemyMultiplier(arc, stage)
  const scaledEnemy = {
    ...enemyChar,
    base_hp:    Math.round(enemyChar.base_hp    * enemyMult),
    base_atk:   Math.round(enemyChar.base_atk   * enemyMult),
    base_def:   Math.round(enemyChar.base_def   * enemyMult),
    base_speed: Math.round(enemyChar.base_speed * enemyMult),
    ability:    getAbility(enemyChar.name),
  }

  // Run the battle
  const result = runBattle(playerChar, scaledEnemy)

  // Handle win
  const alreadyCleared = cleared.some(c => c.arc === arc && c.stage === stage)
  let gemsAwarded = 0
  let xpGained = 0
  let levelsGained = 0
  let milestoneGems = 0
  let playerXpGained = 0
  let newPlayerRank: string | null = null
  let completionBonus = 0
  let isArcComplete = false
  let equipmentDropped: { key: string; name: string; icon: string; rarity: string; slot: string; anime: string } | null = null

  if (result.winner === 'player') {
    gemsAwarded = alreadyCleared ? REPLAY_REWARD : stageGemReward(arc, stage)

    if (!alreadyCleared) {
      await supabase
        .from('campaign_progress')
        .insert({ user_id: user.id, arc, stage })

      // Check if this clears the last needed stage for the arc
      isArcComplete = [1, 2, 3, 4, 5].every(
        s => s === stage || cleared.some(c => c.arc === arc && c.stage === s)
      )
      if (isArcComplete) completionBonus = arcCompleteBonus(arc)
    }

    // Award card XP to the winning character
    xpGained = alreadyCleared ? BATTLE_XP.campaignReplay : BATTLE_XP.campaignFirst
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
    playerXpGained = PLAYER_XP_REWARDS.campaignWin
    const playerXpResult = applyPlayerXP(
      profile?.player_level ?? 1,
      profile?.player_xp ?? 0,
      playerXpGained,
    )
    newPlayerRank = playerXpResult.newRank

    await supabase
      .from('profiles')
      .update({
        gems:        (profile?.gems ?? 0) + gemsAwarded + milestoneGems + playerXpResult.gemsToAward + completionBonus,
        player_level: playerXpResult.newLevel,
        player_xp:    playerXpResult.newXp,
        total_wins:  (profile?.total_wins ?? 0) + 1,
      })
      .eq('user_id', user.id)

    // ─── Roll for equipment drop ─────────────────────────────────────────
    const drop = rollEquipmentDrop({
      anime:  enemyChar.source_anime,
      source: 'campaign',
      arc,
      stage,
    })
    if (drop) {
      await supabase
        .from('user_equipment')
        .insert({ user_id: user.id, equipment_key: drop.key })
      equipmentDropped = {
        key:    drop.key,
        name:   drop.name,
        icon:   drop.icon,
        rarity: drop.rarity,
        slot:   drop.slot,
        anime:  drop.anime,
      }
    }
  }

  return NextResponse.json({
    ...result,
    gemsAwarded,
    isNewClear:      !alreadyCleared && result.winner === 'player',
    isArcComplete,
    completionBonus,
    xpGained,
    levelsGained,
    milestoneGems,
    playerXpGained,
    newPlayerRank,
    enemyImageUrl:   enemyChar.image_url ?? null,
    equipmentDropped,
  })
}
