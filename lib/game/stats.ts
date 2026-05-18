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
