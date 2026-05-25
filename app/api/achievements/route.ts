import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ACHIEVEMENTS, checkConditions, achievementProgress, type AchievementKey } from '@/lib/game/achievements'

// ── Shared helper: gather all user stats needed for condition checking ─────────
async function gatherStats(userId: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  const [profileRes, charsRes, campaignRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('total_pulls, total_wins, pvp_wins, player_level, tower_best_floor, achievements, gems')
      .eq('user_id', userId)
      .single(),
    supabase
      .from('user_characters')
      .select('level, stars, character:characters(rarity)')
      .eq('user_id', userId),
    supabase
      .from('campaign_progress')
      .select('arc, stage')
      .eq('user_id', userId),
  ])

  const profile  = profileRes.data
  const chars    = (charsRes.data  ?? []) as unknown as { level: number; stars: number; character: { rarity: string } | null }[]
  const cleared  = campaignRes.data ?? []
  const claimed  = (profile?.achievements ?? []) as string[]

  const params = {
    totalPulls:     profile?.total_pulls     ?? 0,
    uniqueChars:    chars.length,
    hasLegendary:   chars.some(c => c.character?.rarity === 'legendary'),
    totalWins:      profile?.total_wins      ?? 0,
    cleared,
    towerBestFloor: profile?.tower_best_floor ?? 0,
    pvpWins:        profile?.pvp_wins        ?? 0,
    playerLevel:    profile?.player_level    ?? 1,
    chars,
  }

  return { profile, params, claimed }
}

// GET /api/achievements — return all achievements with status for the current user
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  const { params, claimed } = await gatherStats(user.id, supabase)
  const conditionsMet = checkConditions(params)

  const result = ACHIEVEMENTS.map(a => ({
    ...a,
    conditionMet: conditionsMet.has(a.key),
    claimed: claimed.includes(a.key),
    progress: achievementProgress(a.key, params),
  }))

  return NextResponse.json({ achievements: result })
}

// POST /api/achievements — claim a specific achievement
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  let body: { key?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (typeof body.key !== 'string') return NextResponse.json({ error: 'Missing achievement key' }, { status: 400 })
  const key = body.key as AchievementKey

  const achievement = ACHIEVEMENTS.find(a => a.key === key)
  if (!achievement) return NextResponse.json({ error: 'Achievement not found' }, { status: 404 })

  // The "is this condition actually met?" check stays in TS — it needs joins
  // across profiles, user_characters, and campaign_progress. Server-authoritative
  // because it's run server-side, but not race-protected. The RPC below DOES
  // protect against double-claim races.
  const { params, claimed } = await gatherStats(user.id, supabase)

  if (claimed.includes(key)) {
    return NextResponse.json({ error: 'Already claimed' }, { status: 400 })
  }

  const conditionsMet = checkConditions(params)
  if (!conditionsMet.has(key)) {
    return NextResponse.json({ error: 'Condition not met yet' }, { status: 400 })
  }

  const { data: rows, error } = await supabase.rpc('claim_achievement', {
    p_key:    key,
    p_reward: achievement.reward,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const row = (rows as { success: boolean; error_message: string | null; gems_awarded: number; gems_total: number }[] | null)?.[0]
  if (!row) return NextResponse.json({ error: 'Claim failed' }, { status: 500 })
  if (!row.success) return NextResponse.json({ error: row.error_message ?? 'Already claimed' }, { status: 400 })

  return NextResponse.json({ gemsAwarded: row.gems_awarded, gemsTotal: row.gems_total })
}
