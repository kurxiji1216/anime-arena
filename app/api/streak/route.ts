import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const MILESTONE_REWARDS: Record<number, number> = {
  3: 40,
  7: 100,
}

function yesterdayDate(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}

function todayDate(): string {
  return new Date().toISOString().split('T')[0]
}

// POST /api/streak — call on home page load to update streak
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('gems, streak_days, last_login_date')
    .eq('user_id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const today     = todayDate()
  const yesterday = yesterdayDate()
  const lastLogin = profile.last_login_date ?? null
  const currentStreak = profile.streak_days ?? 0

  // Already logged in today — just return current state
  if (lastLogin === today) {
    return NextResponse.json({ streak: currentStreak, gemsAwarded: 0, milestone: 0, alreadyCounted: true })
  }

  // Calculate new streak
  const newStreak = lastLogin === yesterday ? currentStreak + 1 : 1

  // Check for milestone reward
  const gemsAwarded = MILESTONE_REWARDS[newStreak] ?? 0
  const newGems = profile.gems + gemsAwarded

  await supabase
    .from('profiles')
    .update({
      streak_days:     newStreak,
      last_login_date: today,
      ...(gemsAwarded > 0 ? { gems: newGems } : {}),
    })
    .eq('user_id', user.id)

  return NextResponse.json({
    streak:      newStreak,
    gemsAwarded,
    milestone:   gemsAwarded > 0 ? newStreak : 0,
    gemsTotal:   gemsAwarded > 0 ? newGems : profile.gems,
  })
}
