import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const DAILY_GEMS = 20

export async function POST() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('gems, last_daily_claim_at')
    .eq('user_id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const now = new Date()
  const lastClaim = profile.last_daily_claim_at ? new Date(profile.last_daily_claim_at) : null
  const hoursSinceClaim = lastClaim ? (now.getTime() - lastClaim.getTime()) / (1000 * 60 * 60) : 999

  if (hoursSinceClaim < 24) {
    const hoursLeft = Math.ceil(24 - hoursSinceClaim)
    return NextResponse.json(
      { error: `Already claimed today. Come back in ${hoursLeft} hour${hoursLeft === 1 ? '' : 's'}.` },
      { status: 400 }
    )
  }

  const newGems = profile.gems + DAILY_GEMS

  await supabase
    .from('profiles')
    .update({ gems: newGems, last_daily_claim_at: now.toISOString() })
    .eq('user_id', user.id)

  return NextResponse.json({ gemsAwarded: DAILY_GEMS, gemsTotal: newGems })
}
