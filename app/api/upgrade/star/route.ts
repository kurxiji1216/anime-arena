import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { starUpCopiesNeeded, minCountForStarUp } from '@/lib/game/stats'

const MAX_STARS = 5

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  const { characterId } = await request.json()

  const { data: userChar } = await supabase
    .from('user_characters')
    .select('count, level, stars')
    .eq('user_id', user.id)
    .eq('character_id', characterId)
    .single()

  if (!userChar) return NextResponse.json({ error: "You don't own this character" }, { status: 403 })

  const stars = userChar.stars ?? 1
  const count = userChar.count ?? 1

  if (stars >= MAX_STARS) {
    return NextResponse.json({ error: 'Already at max stars (5★)!' }, { status: 400 })
  }

  const needed = minCountForStarUp(stars)
  if (count < needed) {
    const extras = starUpCopiesNeeded(stars)
    return NextResponse.json({
      error: `Need ${needed} total copies (${extras} extras). You have ${count}.`,
    }, { status: 400 })
  }

  const copiesConsumed = starUpCopiesNeeded(stars)
  const newCount = count - copiesConsumed
  const newStars = stars + 1

  const { error } = await supabase
    .from('user_characters')
    .update({ stars: newStars, count: newCount })
    .eq('user_id', user.id)
    .eq('character_id', characterId)

  if (error) return NextResponse.json({ error: 'Failed to star up' }, { status: 500 })

  return NextResponse.json({
    newStars,
    copiesConsumed,
    countRemaining: newCount,
  })
}
