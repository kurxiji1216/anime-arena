import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { levelUpCost, maxLevelForStars } from '@/lib/game/stats'
import { resolveQuests, markDone } from '@/lib/game/quests'

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  const { characterId } = await request.json()

  // Get the user's copy of this character (level, stars, count)
  const { data: userChar } = await supabase
    .from('user_characters')
    .select('level, stars')
    .eq('user_id', user.id)
    .eq('character_id', characterId)
    .single()

  if (!userChar) return NextResponse.json({ error: "You don't own this character" }, { status: 403 })

  const level = userChar.level ?? 1
  const stars = userChar.stars ?? 1
  const maxLevel = maxLevelForStars(stars)

  if (level >= maxLevel) {
    return NextResponse.json({ error: `Already at max level (${maxLevel}) for this star rating. Star up to raise the cap!` }, { status: 400 })
  }

  const cost = levelUpCost(level)

  // Check gems
  const { data: profile } = await supabase
    .from('profiles')
    .select('gems, daily_quests')
    .eq('user_id', user.id)
    .single()

  if (!profile || profile.gems < cost) {
    return NextResponse.json({ error: `Not enough gems. Need ${cost} 💎` }, { status: 400 })
  }

  // Deduct gems, increment level, mark quest done
  const updatedQuests = markDone(resolveQuests(profile.daily_quests), 'level_up')
  const [, levelResult] = await Promise.all([
    supabase.from('profiles').update({ gems: profile.gems - cost, daily_quests: updatedQuests }).eq('user_id', user.id),
    supabase.from('user_characters').update({ level: level + 1 }).eq('user_id', user.id).eq('character_id', characterId),
  ])

  if (levelResult.error) return NextResponse.json({ error: 'Failed to level up' }, { status: 500 })

  return NextResponse.json({
    newLevel: level + 1,
    gemsSpent: cost,
    gemsRemaining: profile.gems - cost,
    maxLevel,
  })
}
