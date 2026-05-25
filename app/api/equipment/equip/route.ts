import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEquipment } from '@/lib/game/equipment'

// POST /api/equipment/equip — body { equipmentId, characterId }
//
// Plain English: equips an item. The unequip-old + equip-new happens atomically
// inside the equip_item DB function, and a partial unique index on the table
// makes it impossible for two items to occupy the same slot on one character.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  let body: { equipmentId?: unknown; characterId?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (typeof body.equipmentId !== 'string' || typeof body.characterId !== 'string') {
    return NextResponse.json({ error: 'Missing equipmentId or characterId' }, { status: 400 })
  }
  const equipmentId = body.equipmentId
  const characterId = body.characterId

  // Look up the item's catalog entry so we know its slot AND its anime-lock
  const { data: invRow } = await supabase
    .from('user_equipment')
    .select('id, equipment_key, user_id')
    .eq('id', equipmentId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!invRow) return NextResponse.json({ error: "You don't own that item" }, { status: 403 })

  const item = getEquipment(invRow.equipment_key)
  if (!item) return NextResponse.json({ error: 'Unknown equipment key' }, { status: 500 })

  // Anime-lock check: character's source_anime must match the item's anime
  const { data: userChar } = await supabase
    .from('user_characters')
    .select('character_id, character:characters(source_anime)')
    .eq('user_id', user.id)
    .eq('character_id', characterId)
    .maybeSingle()
  if (!userChar) return NextResponse.json({ error: "You don't own that character" }, { status: 403 })

  type CharLite = { source_anime: string } | null
  const character = userChar.character as unknown as CharLite
  if (!character) return NextResponse.json({ error: 'Character not found' }, { status: 500 })
  if (character.source_anime !== item.anime) {
    return NextResponse.json(
      { error: `${item.name} only equips on ${item.anime} characters.` },
      { status: 400 },
    )
  }

  const { data: rows, error } = await supabase.rpc('equip_item', {
    p_equipment_id: equipmentId,
    p_character_id: characterId,
    p_slot:         item.slot,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  type EquipRow = { success: boolean; error_message: string | null; unequipped_id: string | null }
  const row = (rows as EquipRow[] | null)?.[0]
  if (!row) return NextResponse.json({ error: 'Equip failed' }, { status: 500 })
  if (!row.success) return NextResponse.json({ error: row.error_message ?? 'Equip failed' }, { status: 400 })

  return NextResponse.json({
    equipped:   { id: equipmentId, key: item.key, slot: item.slot, name: item.name },
    unequipped: row.unequipped_id ? { id: row.unequipped_id } : null,
  })
}
