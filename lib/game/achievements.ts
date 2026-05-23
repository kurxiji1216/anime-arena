// ─── Achievement System ───────────────────────────────────────────────────────
// One-time milestones that award gems. Conditions are checked server-side.

export type AchievementCategory = 'gacha' | 'battle' | 'progress'

export type AchievementKey =
  // Gacha
  | 'first_pull' | 'pulls_10' | 'pulls_50' | 'pulls_100'
  | 'got_legendary' | 'collector_10' | 'collector_50'
  // Battle
  | 'first_win' | 'wins_10' | 'wins_50'
  | 'clear_arc1' | 'clear_arc5' | 'clear_arc10' | 'clear_all_arcs'
  | 'tower_floor_10' | 'tower_floor_25'
  | 'pvp_first_win' | 'pvp_wins_10'
  // Progress
  | 'reach_d_rank' | 'reach_s_rank'
  | 'level_up_char' | 'star_up_char'

export type Achievement = {
  key: AchievementKey
  title: string
  description: string
  reward: number        // gems
  icon: string
  category: AchievementCategory
  // Optional progress target — lets the UI show X/Y bars
  progressTarget?: number
}

export const ACHIEVEMENTS: Achievement[] = [
  // ── Gacha ────────────────────────────────────────────────────────────────
  { key: 'first_pull',    icon: '🎴', category: 'gacha',    reward: 25,  title: 'First Steps',          description: 'Do your first character pull' },
  { key: 'pulls_10',      icon: '✨', category: 'gacha',    reward: 30,  title: 'Getting Hooked',       description: 'Do 10 pulls total',                   progressTarget: 10  },
  { key: 'pulls_50',      icon: '🎰', category: 'gacha',    reward: 60,  title: 'Dedicated Summoner',   description: 'Do 50 pulls total',                   progressTarget: 50  },
  { key: 'pulls_100',     icon: '💫', category: 'gacha',    reward: 100, title: 'Gacha Addict',         description: 'Do 100 pulls total',                  progressTarget: 100 },
  { key: 'got_legendary', icon: '⭐', category: 'gacha',    reward: 100, title: 'Legend Awaits',        description: 'Pull a Legendary rarity character' },
  { key: 'collector_10',  icon: '📚', category: 'gacha',    reward: 40,  title: 'Starter Collection',   description: 'Own 10 unique characters',             progressTarget: 10  },
  { key: 'collector_50',  icon: '🏛️', category: 'gacha',    reward: 150, title: 'Card Master',          description: 'Own 50 unique characters',             progressTarget: 50  },

  // ── Battle ───────────────────────────────────────────────────────────────
  { key: 'first_win',     icon: '⚔️', category: 'battle',   reward: 20,  title: 'First Blood',          description: 'Win your first battle' },
  { key: 'wins_10',       icon: '🗡️', category: 'battle',   reward: 40,  title: 'Warrior',              description: 'Win 10 battles',                      progressTarget: 10  },
  { key: 'wins_50',       icon: '🏆', category: 'battle',   reward: 100, title: 'Veteran',              description: 'Win 50 battles',                      progressTarget: 50  },
  { key: 'clear_arc1',    icon: '🍃', category: 'battle',   reward: 50,  title: 'The Journey Begins',   description: 'Complete Campaign Arc 1' },
  { key: 'clear_arc5',    icon: '🏴‍☠️', category: 'battle',   reward: 80,  title: 'Into the New World',   description: 'Complete Campaign Arc 5' },
  { key: 'clear_arc10',   icon: '🔥', category: 'battle',   reward: 150, title: 'Beyond the Festival',  description: 'Complete Campaign Arc 10' },
  { key: 'clear_all_arcs',icon: '👑', category: 'battle',   reward: 500, title: 'Campaign Master',      description: 'Complete all 20 campaign arcs' },
  { key: 'tower_floor_10',icon: '🗼', category: 'battle',   reward: 50,  title: 'Tower Climber',        description: 'Reach Floor 10 in the Infinite Tower', progressTarget: 10  },
  { key: 'tower_floor_25',icon: '🌩️', category: 'battle',   reward: 100, title: 'Floor Conqueror',      description: 'Reach Floor 25 in the Infinite Tower', progressTarget: 25  },
  { key: 'pvp_first_win', icon: '🥊', category: 'battle',   reward: 40,  title: 'PvP Debut',            description: 'Win your first PvP battle' },
  { key: 'pvp_wins_10',   icon: '🏅', category: 'battle',   reward: 80,  title: 'PvP Veteran',          description: 'Win 10 PvP battles',                  progressTarget: 10  },

  // ── Progress ─────────────────────────────────────────────────────────────
  { key: 'reach_d_rank',  icon: '🎖️', category: 'progress', reward: 50,  title: 'D-Rank Hunter',        description: 'Reach Player Level 10 (D-Rank)',       progressTarget: 10  },
  { key: 'reach_s_rank',  icon: '🌟', category: 'progress', reward: 200, title: 'S-Rank Hunter',        description: 'Reach Player Level 50 (S-Rank)',       progressTarget: 50  },
  { key: 'level_up_char', icon: '⬆️', category: 'progress', reward: 30,  title: 'Power Up',             description: 'Level up any character' },
  { key: 'star_up_char',  icon: '✦',  category: 'progress', reward: 40,  title: 'Ascension',            description: 'Star up any character to 2★ or higher' },
]

// Total gems available from all achievements
export const TOTAL_ACHIEVEMENT_GEMS = ACHIEVEMENTS.reduce((s, a) => s + a.reward, 0)

// ─── Condition checker (server-side) ─────────────────────────────────────────
// Returns the set of achievement keys whose conditions are met for this user.

type ClearedStage = { arc: number; stage: number }
type UserChar     = { level: number; stars: number; character: { rarity: string } | null }

export function checkConditions(params: {
  totalPulls:       number
  uniqueChars:      number
  hasLegendary:     boolean
  totalWins:        number
  cleared:          ClearedStage[]
  towerBestFloor:   number
  pvpWins:          number
  playerLevel:      number
  chars:            UserChar[]
}): Set<AchievementKey> {
  const { totalPulls, uniqueChars, hasLegendary, totalWins, cleared, towerBestFloor, pvpWins, playerLevel, chars } = params
  const met = new Set<AchievementKey>()

  const arcDone = (n: number) => [1,2,3,4,5].every(s => cleared.some(c => c.arc === n && c.stage === s))

  // Gacha
  if (totalPulls >= 1)   met.add('first_pull')
  if (totalPulls >= 10)  met.add('pulls_10')
  if (totalPulls >= 50)  met.add('pulls_50')
  if (totalPulls >= 100) met.add('pulls_100')
  if (hasLegendary)      met.add('got_legendary')
  if (uniqueChars >= 10) met.add('collector_10')
  if (uniqueChars >= 50) met.add('collector_50')

  // Battle
  if (totalWins >= 1)  met.add('first_win')
  if (totalWins >= 10) met.add('wins_10')
  if (totalWins >= 50) met.add('wins_50')
  if (arcDone(1))  met.add('clear_arc1')
  if (arcDone(5))  met.add('clear_arc5')
  if (arcDone(10)) met.add('clear_arc10')
  if (Array.from({ length: 20 }, (_, i) => i + 1).every(arcDone)) met.add('clear_all_arcs')
  if (towerBestFloor >= 10) met.add('tower_floor_10')
  if (towerBestFloor >= 25) met.add('tower_floor_25')
  if (pvpWins >= 1)  met.add('pvp_first_win')
  if (pvpWins >= 10) met.add('pvp_wins_10')

  // Progress
  if (playerLevel >= 10) met.add('reach_d_rank')
  if (playerLevel >= 50) met.add('reach_s_rank')
  if (chars.some(c => (c.level ?? 1) > 1)) met.add('level_up_char')
  if (chars.some(c => (c.stars ?? 1) > 1)) met.add('star_up_char')

  return met
}

// Progress value toward a target (for showing X/Y bars in the UI)
export function achievementProgress(key: AchievementKey, params: Parameters<typeof checkConditions>[0]): number {
  switch (key) {
    case 'pulls_10':       return Math.min(params.totalPulls, 10)
    case 'pulls_50':       return Math.min(params.totalPulls, 50)
    case 'pulls_100':      return Math.min(params.totalPulls, 100)
    case 'collector_10':   return Math.min(params.uniqueChars, 10)
    case 'collector_50':   return Math.min(params.uniqueChars, 50)
    case 'wins_10':        return Math.min(params.totalWins, 10)
    case 'wins_50':        return Math.min(params.totalWins, 50)
    case 'tower_floor_10': return Math.min(params.towerBestFloor, 10)
    case 'tower_floor_25': return Math.min(params.towerBestFloor, 25)
    case 'pvp_wins_10':    return Math.min(params.pvpWins, 10)
    case 'reach_d_rank':   return Math.min(params.playerLevel, 10)
    case 'reach_s_rank':   return Math.min(params.playerLevel, 50)
    default:               return 0
  }
}
