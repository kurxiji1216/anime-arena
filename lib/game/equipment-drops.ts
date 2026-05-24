// ─── Equipment drop logic ─────────────────────────────────────────────────────
//
// Determines whether a battle victory drops equipment, and if so which item.
// Called from PvE battle API routes. PvP has no drops.

import { EQUIPMENT_CATALOG, type Equipment, type EquipmentRarity } from './equipment'

// Drop chance per battle, scaled by arc difficulty
export function campaignDropChance(arc: number): number {
  if (arc <= 8)  return 0.15
  if (arc <= 16) return 0.18
  return 0.22
}

// Tower drops scale linearly with floor, capping at 30%
export function towerDropChance(floor: number): number {
  return Math.min(0.15 + (floor - 1) * 0.004, 0.30)
}

// Rarity weight table — what rolls when something drops
type RarityWeights = Record<EquipmentRarity, number>

// Base weights (sum to 100)
const DEFAULT_WEIGHTS: RarityWeights = {
  common:    65,
  rare:      25,
  epic:      8,
  legendary: 2,
}

// Boss enemies (stage 5) get a boost to higher rarities
const BOSS_WEIGHTS: RarityWeights = {
  common:    40,
  rare:      35,
  epic:      20,
  legendary: 5,
}

// Tower late-game (floor 26+) shifts heavily to epic/legendary
const LATE_TOWER_WEIGHTS: RarityWeights = {
  common:    15,
  rare:      35,
  epic:      35,
  legendary: 15,
}

// Pre-arc-9 campaigns never drop legendary
const EARLY_WEIGHTS: RarityWeights = {
  common:    75,
  rare:      22,
  epic:      3,
  legendary: 0,
}

export type DropContext = {
  anime:      string         // must match Equipment.anime exactly
  source:     'campaign' | 'tower'
  arc?:       number         // for campaign
  stage?:     number         // for campaign (5 = boss)
  floor?:     number         // for tower
}

// Picks a random rarity according to the weights, or null if the roll misses
function pickRarity(weights: RarityWeights): EquipmentRarity {
  const total = weights.common + weights.rare + weights.epic + weights.legendary
  let roll = Math.random() * total

  if ((roll -= weights.legendary) < 0) return 'legendary'
  if ((roll -= weights.epic)      < 0) return 'epic'
  if ((roll -= weights.rare)      < 0) return 'rare'
  return 'common'
}

// Main entry: rolls for an equipment drop. Returns the chosen Equipment or null.
export function rollEquipmentDrop(ctx: DropContext): Equipment | null {
  // 1. Drop-chance gate
  let dropChance = 0
  if (ctx.source === 'campaign' && ctx.arc != null) {
    dropChance = campaignDropChance(ctx.arc)
  } else if (ctx.source === 'tower' && ctx.floor != null) {
    dropChance = towerDropChance(ctx.floor)
  }
  if (Math.random() >= dropChance) return null

  // 2. Pick rarity weights based on context
  let weights = DEFAULT_WEIGHTS
  if (ctx.source === 'campaign') {
    if (ctx.arc != null && ctx.arc <= 8) weights = EARLY_WEIGHTS
    if (ctx.stage === 5) weights = BOSS_WEIGHTS
  } else if (ctx.source === 'tower' && ctx.floor != null && ctx.floor >= 26) {
    weights = LATE_TOWER_WEIGHTS
  }

  const rarity = pickRarity(weights)

  // 3. Filter catalog to items matching anime + rarity
  const candidates = Object.values(EQUIPMENT_CATALOG).filter(
    eq => eq.anime === ctx.anime && eq.rarity === rarity,
  )

  // Fallback: if no items match (e.g. early arc rolled common but anime has no common), drop common
  if (candidates.length === 0) {
    const fallback = Object.values(EQUIPMENT_CATALOG).filter(
      eq => eq.anime === ctx.anime && eq.rarity === 'common',
    )
    if (fallback.length === 0) return null
    return fallback[Math.floor(Math.random() * fallback.length)]
  }

  return candidates[Math.floor(Math.random() * candidates.length)]
}
