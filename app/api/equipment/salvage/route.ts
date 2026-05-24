import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEquipment, SPARKS_SALVAGE } from '@/lib/game/equipment'

// POST /api/equipment/salvage — body { equipmentId }
// Deletes the equipment row and awards Sparks based on rarity.
// Refuses to salvage an item that's currently equipped (unequip it first).
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  const { equipmentId }: { equipmentId: string } = await request.json()
  if (!equipmentId) return NextResponse.json({ error: 'Missing equipmentId' }, { status: 400 })

  // Verify ownership + get the catalog info
  const { data: invRow } = await supabase
    .from('user_equipment')
    .select('id, equipment_key, equipped_on_character_id')
    .eq('id', equipmentId)
    .eq('user_id', user.id)
    .single()
  if (!invRow) return NextResponse.json({ error: "You don't own that item" }, { status: 403 })

  if (invRow.equipped_on_character_id) {
    return NextResponse.json({ error: 'Unequip the item before salvaging.' }, { status: 400 })
  }

  const item = getEquipment(invRow.equipment_key)
  if (!item) return NextResponse.json({ error: 'Unknown equipment key' }, { status: 500 })

  const sparksGained = SPARKS_SALVAGE[item.rarity]

  // Delete the equipment row
  const { error: delErr } = await supabase
    .from('user_equipment')
    .delete()
    .eq('id', equipmentId)
  if (delErr) return NextResponse.json({ error: 'Failed to salvage' }, { status: 500 })

  // Award Sparks
  const { data: profile } = await supabase
    .from('profiles')
    .select('sparks')
    .eq('user_id', user.id)
    .single()
  const newSparks = (profile?.sparks ?? 0) + sparksGained

  await supabase
    .from('profiles')
    .update({ sparks: newSparks })
    .eq('user_id', user.id)

  return NextResponse.json({
    sparksGained,
    sparksTotal:  newSparks,
    salvagedItem: { key: item.key, name: item.name, rarity: item.rarity },
  })
}
