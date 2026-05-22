import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveQuests, type QuestKey } from '@/lib/game/quests'

// GET /api/quests — fetch today's quests (initialises if new day)
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('daily_quests, gems')
    .eq('user_id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const quests = resolveQuests(profile.daily_quests)

  // Persist if quests were reset (new day)
  if (!profile.daily_quests || (profile.daily_quests as { date?: string }).date !== quests.date) {
    await supabase.from('profiles').update({ daily_quests: quests }).eq('user_id', user.id)
  }

  return NextResponse.json({ quests })
}

// POST /api/quests — claim reward for a completed quest
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  const { key }: { key: QuestKey } = await request.json()

  const { data: profile } = await supabase
    .from('profiles')
    .select('daily_quests, gems')
    .eq('user_id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const quests = resolveQuests(profile.daily_quests)
  const quest = quests.quests.find(q => q.key === key)

  if (!quest)        return NextResponse.json({ error: 'Quest not found' }, { status: 404 })
  if (!quest.done)   return NextResponse.json({ error: 'Quest not completed yet' }, { status: 400 })
  if (quest.claimed) return NextResponse.json({ error: 'Already claimed' }, { status: 400 })

  // Mark claimed and award gems
  const updated = {
    ...quests,
    quests: quests.quests.map(q => q.key === key ? { ...q, claimed: true } : q),
  }
  const newGems = profile.gems + quest.reward

  await supabase
    .from('profiles')
    .update({ daily_quests: updated, gems: newGems })
    .eq('user_id', user.id)

  return NextResponse.json({ gemsAwarded: quest.reward, gemsTotal: newGems })
}
