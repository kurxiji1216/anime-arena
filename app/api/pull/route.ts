import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const PULL_COST = 10

function pickRarity(): 'common' | 'rare' | 'epic' | 'legendary' {
  const roll = Math.random() * 100
  if (roll < 2) return 'legendary'
  if (roll < 10) return 'epic'
  if (roll < 40) return 'rare'
  return 'common'
}

export async function POST() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('gems')
    .eq('user_id', user.id)
    .single()

  if (!profile || profile.gems < PULL_COST) {
    return NextResponse.json({ error: 'Not enough gems' }, { status: 400 })
  }

  const rarity = pickRarity()

  const { data: characters } = await supabase
    .from('characters')
    .select('*')
    .eq('rarity', rarity)

  if (!characters || characters.length === 0) {
    return NextResponse.json({ error: 'No characters available' }, { status: 500 })
  }

  const character = characters[Math.floor(Math.random() * characters.length)]

  await supabase
    .from('profiles')
    .update({ gems: profile.gems - PULL_COST })
    .eq('user_id', user.id)

  const { data: existing } = await supabase
    .from('user_characters')
    .select('id, count')
    .eq('user_id', user.id)
    .eq('character_id', character.id)
    .single()

  let isNew = false
  let totalCount = 1

  if (existing) {
    totalCount = existing.count + 1
    await supabase
      .from('user_characters')
      .update({ count: totalCount, last_pulled_at: new Date().toISOString() })
      .eq('id', existing.id)
  } else {
    isNew = true
    await supabase
      .from('user_characters')
      .insert({ user_id: user.id, character_id: character.id })
  }

  return NextResponse.json({ character, gemsRemaining: profile.gems - PULL_COST, isNew, totalCount })
}
