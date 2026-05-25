import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runBattle } from '@/lib/game/battle'
import { getAbilityCopy } from '@/lib/game/abilities'
import { rollEquipmentDrop } from '@/lib/game/equipment-drops'
import { fetchEquippedItems, buildEquippedFighterStats } from '@/lib/game/battle-equipment'
import {
  getStage,
  isStageUnlocked,
  isArcFullyCleared,
  stageEnemyMultiplier,
  stageGemReward,
  arcCompleteBonus,
} from '@/lib/game/campaign'
import { calcEffectiveStats, BATTLE_XP } from '@/lib/game/stats'
import { playerStatBonus, PLAYER_XP_REWARDS, getHunterRank } from '@/lib/game/player'
import { resolveQuests, markDone } from '@/lib/game/quests'

const REPLAY_REWARD = 5

// Plain English: handles a single campaign-stage battle. The battle itself
// runs in code (using the seeded engine). All the REWARDS — gems, XP, new
// clear flag, milestone bonuses, arc completion — happen atomically inside
// grant_campaign_rewards() so two simultaneous requests can't double-pay
// a first clear or lose-update gems.

type GrantRow = {
  success: boolean
  error_message: string | null
  is_new_clear: boolean
  gems_awarded: number
  gems_total: number
  char_levels_gained: number
  char_new_level: number
  char_new_xp: number
  milestone_gems: number
  player_xp_gained: number
  player_new_level: number
  player_new_xp: number
  player_leveled_up: boolean
}

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  let body: { characterId?: unknown; arc?: unknown; stage?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (typeof body.characterId !== 'string' || typeof body.arc !== 'number' || typeof body.stage !== 'number') {
    return NextResponse.json({ error: 'Missing characterId, arc, or stage' }, { status: 400 })
  }
  const characterId = body.characterId
  const arc         = body.arc
  const stage       = body.stage

  const stageConfig = getStage(arc, stage)
  if (!stageConfig) return NextResponse.json({ error: 'Invalid arc or stage' }, { status: 400 })

  // Verify the stage is unlocked for this user
  const { data: progressRows } = await supabase
    .from('campaign_progress')
    .select('arc, stage')
    .eq('user_id', user.id)

  const cleared = progressRows ?? []

  if (!isStageUnlocked(arc, stage, cleared)) {
    return NextResponse.json({ error: 'Complete the previous stage first' }, { status: 403 })
  }

  // Verify player owns the chosen character
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

  // Profile read — used for the in-memory rank stat bonus (PvE only)
  const { data: profile } = await supabase
    .from('profiles')
    .select('player_level')
    .eq('user_id', user.id)
    .single()

  const eff = calcEffectiveStats(playerBase, userChar.level ?? 1, userChar.stars ?? 1)
  const pBonus = playerStatBonus(profile?.player_level ?? 1)
  const rankBoosted = {
    hp:    Math.round(eff.hp    * pBonus),
    atk:   Math.round(eff.atk   * pBonus),
    def:   Math.round(eff.def   * pBonus),
    speed: Math.round(eff.speed * pBonus),
  }
  const equipped = await fetchEquippedItems(supabase, user.id, characterId)
  const { stats: finalStats, ability: finalAbility } = buildEquippedFighterStats(rankBoosted, playerBase.name, equipped)
  const playerChar = {
    ...playerBase,
    base_hp:    finalStats.hp,
    base_atk:   finalStats.atk,
    base_def:   finalStats.def,
    base_speed: finalStats.speed,
    ability:    finalAbility,
  }

  // Fetch enemy character by name from campaign config
  const { data: enemyChar } = await supabase
    .from('characters')
    .select('*')
    .eq('name', stageConfig.enemyName)
    .single()

  if (!enemyChar) return NextResponse.json({ error: `Enemy "${stageConfig.enemyName}" not found in database` }, { status: 500 })

  const enemyMult = stageEnemyMultiplier(arc, stage)
  const scaledEnemy = {
    ...enemyChar,
    base_hp:    Math.round(enemyChar.base_hp    * enemyMult),
    base_atk:   Math.round(enemyChar.base_atk   * enemyMult),
    base_def:   Math.round(enemyChar.base_def   * enemyMult),
    base_speed: Math.round(enemyChar.base_speed * enemyMult),
    ability:    getAbilityCopy(enemyChar.name),
  }

  const result = runBattle(playerChar, scaledEnemy)

  // ── Defaults for the response (loss/draw paths leave these zeroed) ──
  let gemsAwarded = 0
  let isNewClear = false
  let xpGained = 0
  let levelsGained = 0
  let milestoneGems = 0
  let playerXpGained = 0
  let newPlayerRank: string | null = null
  let completionBonus = 0
  let isArcComplete = false
  let equipmentDropped: { key: string; name: string; icon: string; rarity: string; slot: string; anime: string } | null = null

  if (result.winner === 'player') {
    // Compute "would this clear the arc?" so the RPC knows whether to apply
    // the completion bonus on top of the first-clear reward.
    const alreadyCleared = cleared.some(c => c.arc === arc && c.stage === stage)
    const wouldComplete  = !alreadyCleared && isArcFullyCleared(
      arc,
      [...cleared, { arc, stage }],
    )

    xpGained       = alreadyCleared ? BATTLE_XP.campaignReplay : BATTLE_XP.campaignFirst
    playerXpGained = PLAYER_XP_REWARDS.campaignWin

    const { data: rows, error } = await supabase.rpc('grant_campaign_rewards', {
      p_arc:              arc,
      p_stage:            stage,
      p_character_id:     characterId,
      p_first_clear_gems: stageGemReward(arc, stage),
      p_replay_gems:      REPLAY_REWARD,
      p_completion_bonus: arcCompleteBonus(arc),
      p_char_xp:          xpGained,
      p_player_xp:        playerXpGained,
      p_is_arc_complete:  wouldComplete,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const row = (rows as GrantRow[] | null)?.[0]
    if (!row || !row.success) return NextResponse.json({ error: row?.error_message ?? 'Reward grant failed' }, { status: 500 })

    isNewClear     = row.is_new_clear
    isArcComplete  = wouldComplete && isNewClear
    completionBonus = isArcComplete ? arcCompleteBonus(arc) : 0
    gemsAwarded    = row.gems_awarded
    levelsGained   = row.char_levels_gained
    milestoneGems  = row.milestone_gems

    if (row.player_leveled_up) {
      newPlayerRank = getHunterRank(row.player_new_level).rank
    }

    // Best-effort: tick level_up quest if any level happened (cosmetic — no exploit if it races)
    if (levelsGained > 0) {
      const { data: prof } = await supabase.from('profiles').select('daily_quests').eq('user_id', user.id).single()
      if (prof) {
        const updatedQuests = markDone(resolveQuests(prof.daily_quests), 'level_up')
        await supabase.from('profiles').update({ daily_quests: updatedQuests }).eq('user_id', user.id)
      }
    }

    // ── Equipment drop (only report if insert succeeded — C14) ──
    if (typeof enemyChar.source_anime === 'string') {
      const drop = rollEquipmentDrop({
        anime:  enemyChar.source_anime,
        source: 'campaign',
        arc,
        stage,
      })
      if (drop) {
        const { error: dropErr } = await supabase
          .from('user_equipment')
          .insert({ user_id: user.id, equipment_key: drop.key, slot: drop.slot })
        if (!dropErr) {
          equipmentDropped = {
            key:    drop.key,
            name:   drop.name,
            icon:   drop.icon,
            rarity: drop.rarity,
            slot:   drop.slot,
            anime:  drop.anime,
          }
        } else {
          console.error('Equipment drop insert failed:', dropErr)
        }
      }
    }
  }
  // Loss / draw paths: no rewards. Battle log + winner returned for UI.

  return NextResponse.json({
    ...result,
    gemsAwarded,
    isNewClear,
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
