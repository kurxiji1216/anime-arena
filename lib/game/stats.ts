// Effective stat calculation — used by battle APIs and collection UI

export function calcEffectiveStats(
  base: { base_hp: number; base_atk: number; base_def: number; base_speed: number },
  level: number,
  stars: number
) {
  const levelMult = 1 + 0.03 * (level - 1)   // +3% per level above 1
  const starMult  = 1 + 0.15 * (stars - 1)   // +15% per star above 1
  const total     = levelMult * starMult

  return {
    hp:    Math.round(base.base_hp    * total),
    atk:   Math.round(base.base_atk   * total),
    def:   Math.round(base.base_def   * total),
    speed: Math.round(base.base_speed * total),
  }
}

// Max level a character can reach at their current star rating
export function maxLevelForStars(stars: number): number {
  return 20 + (stars - 1) * 10  // 1★=20, 2★=30, 3★=40, 4★=50, 5★=60
}

// Gem cost to go from `currentLevel` → `currentLevel + 1`
export function levelUpCost(currentLevel: number): number {
  return 10 + (currentLevel - 1) * 5
}

// Extra copies needed to star up (on top of the 1 copy you keep)
export function starUpCopiesNeeded(currentStars: number): number {
  const table: Record<number, number> = { 1: 2, 2: 4, 3: 8, 4: 16 }
  return table[currentStars] ?? Infinity
}

// Minimum total count needed to star up
export function minCountForStarUp(currentStars: number): number {
  return starUpCopiesNeeded(currentStars) + 1
}

// ─── XP / Leveling System ─────────────────────────────────────────────────

// XP required to go from `level` to `level + 1`
export function xpToNextLevel(level: number): number {
  return 50 + level * 25
}

// XP awarded per battle type
export const BATTLE_XP = {
  campaignFirst:  150,
  campaignReplay: 75,
  tower: (floor: number) => 50 + floor * 10,
  pvpWin:         120,
}

// Gem bonuses awarded automatically when a character hits these milestone levels
export const MILESTONE_GEMS: Record<number, number> = {
  10: 25,
  20: 75,   // 1★ cap
  30: 25,
  40: 75,   // 3★ cap
  50: 25,
  60: 100,  // 5★ cap
}

// Apply XP gain — handles multi-level roll-over and collects milestone gems.
// Returns the new level, leftover xp, total milestone gems earned, and levels gained.
export function applyXP(
  currentLevel: number,
  currentXp: number,
  xpGained: number,
  maxLevel: number,
): { newLevel: number; newXp: number; gemsToAward: number; levelsGained: number } {
  let level = currentLevel
  let xp = currentXp + xpGained
  let gemsToAward = 0
  let levelsGained = 0

  while (level < maxLevel && xp >= xpToNextLevel(level)) {
    xp -= xpToNextLevel(level)
    level++
    levelsGained++
    gemsToAward += MILESTONE_GEMS[level] ?? 0
  }

  // At max level, excess XP is discarded
  if (level >= maxLevel) xp = 0

  return { newLevel: level, newXp: xp, gemsToAward, levelsGained }
}
