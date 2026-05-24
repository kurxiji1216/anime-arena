import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEquipment } from '@/lib/game/equipment'

// POST /api/equipment/equip — body { equipmentId, characterId }
// Equips an owned equipment instance onto a character.
// Validates anime match and slot conflict (unequips an existing slot occupant if needed).
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  const { equipmentId, characterId }: { equipmentId: string; characterId: string } = await request.json()
  if (!equipmentId || !characterId) {
    return NextResponse.json({ error: 'Missing equipmentId or characterId' }, { status: 400 })
  }

  // Verify equipment ownership + look up its catalog entry
  const { data: invRow } = await supabase
    .from('user_equipment')
    .select('id, equipment_key, equipped_on_character_id, user_id')
    .eq('id', equipmentId)
    .eq('user_id', user.id)
    .single()
  if (!invRow) return NextResponse.json({ error: "You don't own that item" }, { status: 403 })

  const item = getEquipment(invRow.equipment_key)
  if (!item) return NextResponse.json({ error: 'Unknown equipment key' }, { status: 500 })

  // Verify character ownership
  const { data: userChar } = await supabase
    .from('user_characters')
    .select('character_id, character:characters(id, name, source_anime)')
    .eq('user_id', user.id)
    .eq('character_id', characterId)
    .single()
  if (!userChar) return NextResponse.json({ error: "You don't own that character" }, { status: 403 })

  // Anime-lock check
  const character = userChar.character as unknown as { id: string; name: string; source_anime: string } | null
  if (!character) return NextResponse.json({ error: 'Character not found' }, { status: 500 })
  if (character.source_anime !== item.anime) {
    return NextResponse.json(
      { error: `${item.name} only equips on ${item.anime} characters.` },
      { status: 400 },
    )
  }

  // Find any item currently in the same slot on this character — auto-unequip it
  const { data: currentSlotItems } = await supabase
    .from('user_equipment')
    .select('id, equipment_key')
    .eq('user_id', user.id)
    .eq('equipped_on_character_id', characterId)

  const conflict = (currentSlotItems ?? []).find(row => {
    const other = getEquipment(row.equipment_key)
    return other?.slot === item.slot
  })

  if (conflict) {
    await supabase
      .from('user_equipment')
      .update({ equipped_on_character_id: null })
      .eq('id', conflict.id)
  }

  // Equip the new item
  const { error } = await supabase
    .from('user_equipment')
    .update({ equipped_on_character_id: characterId })
    .eq('id', equipmentId)

  if (error) return NextResponse.json({ error: 'Failed to equip' }, { status: 500 })

  return NextResponse.json({
    equipped:        { id: equipmentId, key: item.key, slot: item.slot, name: item.name },
    unequipped:      conflict ? { id: conflict.id } : null,
  })
}
