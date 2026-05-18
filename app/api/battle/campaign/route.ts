import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runBattle } from '@/lib/game/battle'
import { getStage, isStageUnlocked } from '@/lib/game/campaign'

const REPLAY_REWARD = 5

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  const { characterId, arc, stage } = await request.json()

  // Validate arc and stage numbers
  const stageConfig = getStage(arc, stage)
  if (!stageConfig) return NextResponse.json({ error: 'Invalid arc or stage' }, { status: 400 })

  // Fetch player's campaign progress
  const { data: progressRows } = await supabase
    .from('campaign_progress')
    .select('arc, stage')
    .eq('user_id', user.id)

  const cleared = progressRows ?? []

  // Check stage is unlocked
  if (!isStageUnlocked(arc, stage, cleared)) {
    return NextResponse.json({ error: 'Complete the previous stage first' }, { status: 403 })
  }

  // Verify player owns the chosen character
  const { data: ownership } = await supabase
    .from('user_characters')
    .select('character_id')
    .eq('user_id', user.id)
    .eq('character_id', characterId)
    .single()

  if (!ownership) return NextResponse.json({ error: "You don't own that character" }, { status: 403 })

  // Fetch player character stats
  const { data: playerChar } = await supabase
    .from('characters')
    .select('*')
    .eq('id', characterId)
    .single()

  if (!playerChar) return NextResponse.json({ error: 'Character not found' }, { status: 404 })

  // Fetch enemy character by name from campaign config
  const { data: enemyChar } = await supabase
    .from('characters')
    .select('*')
    .eq('name', stageConfig.enemyName)
    .single()

  if (!enemyChar) return NextResponse.json({ error: `Enemy "${stageConfig.enemyName}" not found in database` }, { status: 500 })

  // Run the battle
  const result = runBattle(playerChar, enemyChar)

  // Handle win
  const alreadyCleared = cleared.some(c => c.arc === arc && c.stage === stage)
  let gemsAwarded = 0

  if (result.winner === 'player') {
    gemsAwarded = alreadyCleared ? REPLAY_REWARD : stageConfig.reward

    if (!alreadyCleared) {
      await supabase
        .from('campaign_progress')
        .insert({ user_id: user.id, arc, stage })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('gems')
      .eq('user_id', user.id)
      .single()

    if (profile) {
      await supabase
        .from('profiles')
        .update({ gems: profile.gems + gemsAwarded })
        .eq('user_id', user.id)
    }
  }

  return NextResponse.json({
    ...result,
    gemsAwarded,
    isNewClear: !alreadyCleared && result.winner === 'player',
  })
}
