import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEquipment, SPARKS_BUY } from '@/lib/game/equipment'

// POST /api/equipment/buy — body { equipmentKey }
// Spends Sparks to add a new instance of the specified item to the player's inventory.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  const { equipmentKey }: { equipmentKey: string } = await request.json()
  if (!equipmentKey) return NextResponse.json({ error: 'Missing equipmentKey' }, { status: 400 })

  const item = getEquipment(equipmentKey)
  if (!item) return NextResponse.json({ error: 'Unknown equipment key' }, { status: 404 })

  const cost = SPARKS_BUY[item.rarity]

  const { data: profile } = await supabase
    .from('profiles')
    .select('sparks')
    .eq('user_id', user.id)
    .single()
  const currentSparks = profile?.sparks ?? 0

  if (currentSparks < cost) {
    return NextResponse.json(
      { error: `Need ${cost} Sparks (you have ${currentSparks}).` },
      { status: 400 },
    )
  }

  // Insert the new equipment instance
  const { error: insErr } = await supabase
    .from('user_equipment')
    .insert({ user_id: user.id, equipment_key: equipmentKey })
  if (insErr) return NextResponse.json({ error: 'Failed to add item' }, { status: 500 })

  // Deduct Sparks
  await supabase
    .from('profiles')
    .update({ sparks: currentSparks - cost })
    .eq('user_id', user.id)

  return NextResponse.json({
    sparksSpent:  cost,
    sparksTotal:  currentSparks - cost,
    purchased:    { key: item.key, name: item.name, rarity: item.rarity, slot: item.slot, anime: item.anime },
  })
}
