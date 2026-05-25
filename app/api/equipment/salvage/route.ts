import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEquipment, SPARKS_SALVAGE } from '@/lib/game/equipment'

// POST /api/equipment/salvage — body { equipmentId }
//
// Plain English: deletes the equipment row and awards Sparks. The DB function
// does the delete and the grant in one transaction; if the item was already
// salvaged (or is equipped), the delete affects 0 rows and we return an error.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  let body: { equipmentId?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (typeof body.equipmentId !== 'string') return NextResponse.json({ error: 'Missing equipmentId' }, { status: 400 })
  const equipmentId = body.equipmentId

  // We need the item rarity to know how many sparks to award. Look it up first.
  const { data: invRow } = await supabase
    .from('user_equipment')
    .select('id, equipment_key, equipped_on_character_id')
    .eq('id', equipmentId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!invRow) return NextResponse.json({ error: "You don't own that item" }, { status: 403 })
  if (invRow.equipped_on_character_id) {
    return NextResponse.json({ error: 'Unequip the item before salvaging.' }, { status: 400 })
  }

  const item = getEquipment(invRow.equipment_key)
  if (!item) return NextResponse.json({ error: 'Unknown equipment key' }, { status: 500 })

  const sparksGained = SPARKS_SALVAGE[item.rarity]

  const { data: rows, error } = await supabase.rpc('salvage_equipment', {
    p_equipment_id:  equipmentId,
    p_sparks_value:  sparksGained,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const row = (rows as { success: boolean; error_message: string | null; sparks_remaining: number | null }[] | null)?.[0]
  if (!row) return NextResponse.json({ error: 'Salvage failed' }, { status: 500 })
  if (!row.success) {
    return NextResponse.json({ error: row.error_message ?? 'Salvage failed' }, { status: 400 })
  }

  return NextResponse.json({
    sparksGained,
    sparksTotal:  row.sparks_remaining,
    salvagedItem: { key: item.key, name: item.name, rarity: item.rarity },
  })
}
