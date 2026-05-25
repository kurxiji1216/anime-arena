import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runBattle, BattleFighter } from '@/lib/game/battle'
import { getAbilityCopy } from '@/lib/game/abilities'
import { rollEquipmentDrop } from '@/lib/game/equipment-drops'
import { fetchEquippedItems, buildEquippedFighterStats } from '@/lib/game/battle-equipment'
import { calcEffectiveStats, BATTLE_XP } from '@/lib/game/stats'
import { playerStatBonus, PLAYER_XP_REWARDS, getHunterRank } from '@/lib/game/player'
import { resolveQuests, markDone } from '@/lib/game/quests'

const GEMS_PER_FLOOR = 10

function rarityPoolForFloor(floor: number): string[] {
  if (floor <= 5)  return ['common']
  if (floor <= 15) return ['common', 'rare']
  if (floor <= 30) return ['rare']
  if (floor <= 50) return ['rare', 'epic']
  if (floor <= 75) return ['epic']
  if (floor <= 100) return ['epic', 'legendary']
  return ['legendary']
}

function scaleEnemy(char: BattleFighter, floor: number): BattleFighter {
  const multiplier = 1 + (floor - 1) * 0.04
  return {
    ...char,
    base_hp:    Math.round(char.base_hp    * multiplier),
    base_atk:   Math.round(char.base_atk   * multiplier),
    base_def:   Math.round(char.base_def   * multiplier),
    base_speed: Math.round(char.base_speed * multiplier),
    ability:    getAbilityCopy(char.name),
  }
}

// Plain English: tower battle. Like campaign, the rewards (gem grant, floor
// bump, XP roll-over) happen atomically in grant_tower_rewards(). Losses
// reset the floor to 1 in the same transaction.

type TowerGrantRow = {
  success: boolean
  error_message: string | null
  gems_total: number
  new_floor: number
  best_floor: number
  char_levels_gained: number
  char_new_level: number
  char_new_xp: number
  milestone_gems: number
  player_new_level: number
  player_new_xp: number
  player_leveled_up: boolean
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  let body: { characterId?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (typeof body.characterId !== 'string') return NextResponse.json({ error: 'Missing characterId' }, { status: 400 })
  const characterId = body.characterId

  const { data: profile } = await supabase
    .from('profiles')
    .select('tower_floor, player_level')
    .eq('user_id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const currentFloor = profile.tower_floor ?? 1

  const { data: userChar } = await supabase
    .from('user_characters')
    .select('character_id, level, stars, xp')
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

  const eff = calcEffectiveStats(playerBase, userChar.level ?? 1, userChar.stars ?? 1)
  const pBonus = playerStatBonus(profile.player_level ?? 1)
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

  const result = runBattle(playerChar, scaledEnemy)

  let gemsAwarded = 0
  let levelsGained = 0
  let milestoneGems = 0
  let playerXpGained = 0
  let newPlayerRank: string | null = null
  let newFloor = currentFloor
  let bestFloor = 0
  let equipmentDropped: { key: string; name: string; icon: string; rarity: string; slot: string; anime: string } | null = null
  let xpGained = 0

  // Atomic rewards (or floor-reset on loss)
  xpGained       = result.winner === 'player' ? BATTLE_XP.tower(currentFloor) : 0
  playerXpGained = result.winner === 'player' ? PLAYER_XP_REWARDS.towerWin : 0

  const { data: rows, error } = await supabase.rpc('grant_tower_rewards', {
    p_result:         result.winner,
    p_character_id:   characterId,
    p_floor_cleared:  currentFloor,
    p_gem_reward:     result.winner === 'player' ? GEMS_PER_FLOOR : 0,
    p_char_xp:        xpGained,
    p_player_xp:      playerXpGained,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const row = (rows as TowerGrantRow[] | null)?.[0]
  if (!row || !row.success) return NextResponse.json({ error: row?.error_message ?? 'Tower update failed' }, { status: 500 })

  if (result.winner === 'player') {
    gemsAwarded   = GEMS_PER_FLOOR
    levelsGained  = row.char_levels_gained
    milestoneGems = row.milestone_gems
    newFloor      = row.new_floor
    bestFloor     = row.best_floor
    if (row.player_leveled_up) newPlayerRank = getHunterRank(row.player_new_level).rank

    // Best-effort quest tick
    if (levelsGained > 0) {
      const { data: prof } = await supabase.from('profiles').select('daily_quests').eq('user_id', user.id).single()
      if (prof) {
        const updatedQuests = markDone(resolveQuests(prof.daily_quests), 'level_up')
        await supabase.from('profiles').update({ daily_quests: updatedQuests }).eq('user_id', user.id)
      }
    }

    // ── Equipment drop ──
    if (typeof baseEnemy.source_anime === 'string') {
      const drop = rollEquipmentDrop({
        anime:  baseEnemy.source_anime,
        source: 'tower',
        floor:  currentFloor,
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
  } else if (result.winner === 'enemy') {
    newFloor = 1
    bestFloor = row.best_floor
  } else {
    // Draw: floor unchanged
    newFloor = row.new_floor
    bestFloor = row.best_floor
  }

  return NextResponse.json({
    ...result,
    gemsAwarded,
    floorCleared: currentFloor,
    newFloor,
    bestFloor,
    enemyName: scaledEnemy.name,
    floorMultiplier: +(1 + (currentFloor - 1) * 0.04).toFixed(2),
    xpGained,
    levelsGained,
    milestoneGems,
    playerXpGained,
    newPlayerRank,
    enemyImageUrl: baseEnemy.image_url ?? null,
    equipmentDropped,
  })
}
