// ─── Tutorial / Hunter's Path ─────────────────────────────────────────────────
//
// A small, pinned quest log for first-time players. Each step auto-checks
// against existing profile data — no new tracking required for the conditions.
// Once a player claims all four, the panel auto-hides on the home page.

export type TutorialStepKey = 'first_pull' | 'first_win' | 'power_up' | 'arc1_champion'

export type TutorialStep = {
  key:           TutorialStepKey
  title:         string
  description:   string
  icon:          string
  reward:        number  // gems
  color:         string  // accent color for the UI
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    key:         'first_pull',
    title:       'First Pull',
    description: 'Spend 10 gems on your first card pull.',
    icon:        '🎴',
    reward:      15,
    color:       '#a855f7',
  },
  {
    key:         'first_win',
    title:       'First Win',
    description: 'Win your first battle in any mode.',
    icon:        '⚔️',
    reward:      20,
    color:       '#ef4444',
  },
  {
    key:         'power_up',
    title:       'Power Up',
    description: 'Level up any character (via gems or battle XP).',
    icon:        '⬆️',
    reward:      20,
    color:       '#22c55e',
  },
  {
    key:         'arc1_champion',
    title:       'Arc 1 Champion',
    description: 'Clear all 5 stages of the Naruto: Part 1 arc.',
    icon:        '🏆',
    reward:      50,
    color:       '#facc15',
  },
]

export const TOTAL_TUTORIAL_GEMS = TUTORIAL_STEPS.reduce((s, st) => s + st.reward, 0)

// ─── Condition checker ────────────────────────────────────────────────────────

type UserCharLite = { level: number }
type ClearedStage = { arc: number; stage: number }

export function checkTutorialConditions(params: {
  totalPulls: number
  totalWins:  number
  chars:      UserCharLite[]
  cleared:    ClearedStage[]
}): Set<TutorialStepKey> {
  const met = new Set<TutorialStepKey>()
  const { totalPulls, totalWins, chars, cleared } = params

  if (totalPulls >= 1) met.add('first_pull')
  if (totalWins  >= 1) met.add('first_win')
  if (chars.some(c => (c.level ?? 1) >= 2)) met.add('power_up')

  const arc1Stages = [1, 2, 3, 4, 5]
  if (arc1Stages.every(s => cleared.some(c => c.arc === 1 && c.stage === s))) {
    met.add('arc1_champion')
  }

  return met
}

// Helper for UI: returns whether the tutorial should be visible at all
export function isTutorialActive(claimed: string[]): boolean {
  return claimed.length < TUTORIAL_STEPS.length
}
