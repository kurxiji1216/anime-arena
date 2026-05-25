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

// Validates that an arbitrary JSON value actually looks like a DailyQuests
// object before we trust it. Without this, a corrupted DB column would crash
// the app downstream when we try to .map over `quests.quests`.
function isDailyQuests(x: unknown): x is DailyQuests {
  if (!x || typeof x !== 'object') return false
  const d = x as Partial<DailyQuests>
  if (typeof d.date !== 'string' || !Array.isArray(d.quests)) return false
  return d.quests.every(q =>
    q != null
    && typeof q === 'object'
    && typeof (q as Quest).key     === 'string'
    && typeof (q as Quest).done    === 'boolean'
    && typeof (q as Quest).claimed === 'boolean',
  )
}

// Returns today's quests, resetting if stored data is from a previous day
// or if the stored value is missing/malformed.
export function resolveQuests(stored: unknown): DailyQuests {
  if (isDailyQuests(stored) && stored.date === todayDate()) return stored
  return freshQuests()
}

export function markDone(quests: DailyQuests, key: QuestKey): DailyQuests {
  return {
    ...quests,
    quests: quests.quests.map(q => q.key === key ? { ...q, done: true } : q),
  }
}
