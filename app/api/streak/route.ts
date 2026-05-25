import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Plain English: ticks the login streak. The "did they already log in today?"
// check happens inside tick_streak(), which is row-locked so two concurrent
// home-page loads can't both award the 3-day or 7-day milestone gems.
type TickStreakRow = {
  success: boolean
  streak_days: number
  gems_awarded: number
  milestone_day: number
  gems_total: number
  already_counted: boolean
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  const { data: rows, error } = await supabase.rpc('tick_streak')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const row = (rows as TickStreakRow[] | null)?.[0]
  if (!row || !row.success) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  return NextResponse.json({
    streak:         row.streak_days,
    gemsAwarded:    row.gems_awarded,
    milestone:      row.milestone_day,
    gemsTotal:      row.gems_total,
    alreadyCounted: row.already_counted,
  })
}
