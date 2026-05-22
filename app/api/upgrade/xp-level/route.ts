import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { xpToNextLevel, maxLevelForStars, MILESTONE_GEMS } from '@/lib/game/stats'

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  const { characterId } = await request.json()

  // Get the user's copy of this character
  const { data: userChar } = await supabase
    .from('user_characters')
    .select('level, stars, xp')
    .eq('user_id', user.id)
    .eq('character_id', characterId)
    .single()

  if (!userChar) return NextResponse.json({ error: "You don't own this character" }, { status: 403 })

  const level = userChar.level ?? 1
  const stars = userChar.stars ?? 1
  const xp = userChar.xp ?? 0
  const maxLevel = maxLevelForStars(stars)
  const needed = xpToNextLevel(level)

  if (level >= maxLevel) {
    return NextResponse.json(
      { error: `Already at max level (${maxLevel}) for this star rating. Star up to raise the cap!` },
      { status: 400 }
    )
  }

  if (xp < needed) {
    return NextResponse.json(
      { error: `Not enough XP. Have ${xp}, need ${needed}.` },
      { status: 400 }
    )
  }

  const newLevel = level + 1
  const newXp = xp - needed
  const milestoneGems = MILESTONE_GEMS[newLevel] ?? 0

  // Update character level + xp
  const { error: charError } = await supabase
    .from('user_characters')
    .update({ level: newLevel, xp: newXp })
    .eq('user_id', user.id)
    .eq('character_id', characterId)

  if (charError) return NextResponse.json({ error: 'Failed to level up' }, { status: 500 })

  // Award milestone gems if applicable
  let gemsTotal: number | null = null
  if (milestoneGems > 0) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('gems')
      .eq('user_id', user.id)
      .single()

    if (profile) {
      gemsTotal = profile.gems + milestoneGems
      await supabase
        .from('profiles')
        .update({ gems: gemsTotal })
        .eq('user_id', user.id)
    }
  }

  return NextResponse.json({
    newLevel,
    newXp,
    milestoneGems,
    gemsTotal,
    maxLevel,
  })
}
