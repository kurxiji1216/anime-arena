// ─── Player Account Leveling System ──────────────────────────────────────────
// Separate from card leveling. The player's account has its own level and
// Hunter Rank (Solo Leveling style: E → D → C → B → A → S → SS → SSS).

export type HunterRank = 'E' | 'D' | 'C' | 'B' | 'A' | 'S' | 'SS' | 'SSS'

export const RANK_THRESHOLDS: Array<{
  minLevel: number
  rank: HunterRank
  title: string
  color: string
  rankGems: number
}> = [
  { minLevel: 1,  rank: 'E',   title: 'E-Rank Hunter',  color: '#9ca3af', rankGems: 0   },
  { minLevel: 10, rank: 'D',   title: 'D-Rank Hunter',  color: '#34d399', rankGems: 150 },
  { minLevel: 20, rank: 'C',   title: 'C-Rank Hunter',  color: '#60a5fa', rankGems: 150 },
  { minLevel: 30, rank: 'B',   title: 'B-Rank Hunter',  color: '#a78bfa', rankGems: 150 },
  { minLevel: 40, rank: 'A',   title: 'A-Rank Hunter',  color: '#fbbf24', rankGems: 150 },
  { minLevel: 50, rank: 'S',   title: 'S-Rank Hunter',  color: '#f87171', rankGems: 150 },
  { minLevel: 60, rank: 'SS',  title: 'SS-Rank Hunter', color: '#fb923c', rankGems: 250 },
  { minLevel: 70, rank: 'SSS', title: 'Shadow Monarch', color: '#c084fc', rankGems: 500 },
]

// Player XP awarded per activity
export const PLAYER_XP_REWARDS = {
  campaignWin:  30,
  towerWin:     20,
  pvpWin:       25,
  dailyClaim:   15,
  questClaim:   20,
  pull:         5,
}

// XP required to go from `level` to `level + 1`
export function playerXpToLevel(level: number): number {
  return 200 + level * 100
}

// Returns the current Hunter Rank info for a given player level
export function getHunterRank(level: number) {
  return (
    [...RANK_THRESHOLDS].reverse().find(r => level >= r.minLevel) ??
    RANK_THRESHOLDS[0]
  )
}

// Passive stat multiplier applied to all character stats in PvE (NOT PvP)
// +0.5% per player level — e.g. level 50 = ×1.25 (+25%)
export function playerStatBonus(level: number): number {
  return 1 + level * 0.005
}

// Apply player XP — rolls over multiple levels, collects gem rewards.
// Returns new level, leftover xp, total gems to award, and any new rank reached.
export function applyPlayerXP(
  currentLevel: number,
  currentXp: number,
  xpGained: number,
): {
  newLevel: number
  newXp: number
  gemsToAward: number
  newRank: string | null
} {
  let level = currentLevel
  let xp = currentXp + xpGained
  let gemsToAward = 0
  let newRank: string | null = null

  while (xp >= playerXpToLevel(level)) {
    xp -= playerXpToLevel(level)
    level++
    gemsToAward += 30  // flat +30 gems per level-up
    const rankInfo = RANK_THRESHOLDS.find(r => r.minLevel === level)
    if (rankInfo) {
      gemsToAward += rankInfo.rankGems
      newRank = rankInfo.rank
    }
  }

  return { newLevel: level, newXp: xp, gemsToAward, newRank }
}
