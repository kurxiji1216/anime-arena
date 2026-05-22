export type QuestKey = 'do_pull' | 'claim_daily' | 'level_up'

export type Quest = {
  key: QuestKey
  label: string
  reward: number
  done: boolean
  claimed: boolean
}

export type DailyQuests = {
  date: string
  quests: Quest[]
}

const QUEST_DEFS: Pick<Quest, 'key' | 'label' | 'reward'>[] = [
  { key: 'do_pull',     label: 'Do 1 Pull',        reward: 15 },
  { key: 'claim_daily', label: 'Claim Daily Bonus', reward: 10 },
  { key: 'level_up',    label: 'Level Up a Card',   reward: 20 },
]

export function todayDate(): string {
  return new Date().toISOString().split('T')[0]
}

export function freshQuests(): DailyQuests {
  return {
    date: todayDate(),
    quests: QUEST_DEFS.map(q => ({ ...q, done: false, claimed: false })),
  }
}

// Returns today's quests, resetting if stored data is from a previous day
export function resolveQuests(stored: unknown): DailyQuests {
  if (
    stored !== null &&
    typeof stored === 'object' &&
    (stored as DailyQuests).date === todayDate()
  ) {
    return stored as DailyQuests
  }
  return freshQuests()
}

export function markDone(quests: DailyQuests, key: QuestKey): DailyQuests {
  return {
    ...quests,
    quests: quests.quests.map(q => q.key === key ? { ...q, done: true } : q),
  }
}
