import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  TUTORIAL_STEPS,
  checkTutorialConditions,
  type TutorialStepKey,
} from '@/lib/game/tutorial'

// ── Shared helper: build the per-user tutorial state ──────────────────────────
async function loadTutorialState(userId: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  const [profileRes, charsRes, progRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('gems, total_pulls, total_wins, tutorial_claimed')
      .eq('user_id', userId)
      .single(),
    supabase
      .from('user_characters')
      .select('level')
      .eq('user_id', userId),
    supabase
      .from('campaign_progress')
      .select('arc, stage')
      .eq('user_id', userId),
  ])

  const profile = profileRes.data
  const chars   = (charsRes.data ?? []) as { level: number }[]
  const cleared = progRes.data ?? []
  const claimed = (profile?.tutorial_claimed ?? []) as string[]

  const params = {
    totalPulls: profile?.total_pulls ?? 0,
    totalWins:  profile?.total_wins  ?? 0,
    chars,
    cleared,
  }

  return { profile, params, claimed }
}

// GET /api/tutorial — list all steps with status
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  const { params, claimed } = await loadTutorialState(user.id, supabase)
  const met = checkTutorialConditions(params)

  const steps = TUTORIAL_STEPS.map(s => ({
    ...s,
    conditionMet: met.has(s.key),
    claimed:      claimed.includes(s.key),
  }))

  return NextResponse.json({ steps })
}

// POST /api/tutorial — claim a step's reward, body { key }
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  const { key }: { key: TutorialStepKey } = await request.json()
  const step = TUTORIAL_STEPS.find(s => s.key === key)
  if (!step) return NextResponse.json({ error: 'Step not found' }, { status: 404 })

  const { profile, params, claimed } = await loadTutorialState(user.id, supabase)
  if (claimed.includes(key)) {
    return NextResponse.json({ error: 'Already claimed' }, { status: 400 })
  }

  const met = checkTutorialConditions(params)
  if (!met.has(key)) {
    return NextResponse.json({ error: 'Condition not yet met' }, { status: 400 })
  }

  const newClaimed = [...claimed, key]
  const newGems    = (profile?.gems ?? 0) + step.reward

  const { error } = await supabase
    .from('profiles')
    .update({ tutorial_claimed: newClaimed, gems: newGems })
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: 'Failed to claim' }, { status: 500 })

  return NextResponse.json({ gemsAwarded: step.reward, gemsTotal: newGems })
}
