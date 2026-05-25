import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEquipment, SPARKS_BUY } from '@/lib/game/equipment'

// POST /api/equipment/buy — body { equipmentKey }
//
// Plain English: spends Sparks to buy an item. The DB function buy_equipment()
// does the spark check, the insert, and the deduct in ONE transaction with a
// row lock — no way to get a free item by double-clicking.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  let body: { equipmentKey?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (typeof body.equipmentKey !== 'string') return NextResponse.json({ error: 'Missing equipmentKey' }, { status: 400 })
  const equipmentKey = body.equipmentKey

  const item = getEquipment(equipmentKey)
  if (!item) return NextResponse.json({ error: 'Unknown equipment key' }, { status: 404 })

  const cost = SPARKS_BUY[item.rarity]

  const { data: rows, error } = await supabase.rpc('buy_equipment', {
    p_key:  item.key,
    p_cost: cost,
    p_slot: item.slot,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const row = (rows as { success: boolean; error_message: string | null; sparks_remaining: number | null }[] | null)?.[0]
  if (!row) return NextResponse.json({ error: 'Buy failed' }, { status: 500 })
  if (!row.success) {
    return NextResponse.json({ error: row.error_message ?? 'Buy failed' }, { status: 400 })
  }

  return NextResponse.json({
    sparksSpent:  cost,
    sparksTotal:  row.sparks_remaining,
    purchased:    { key: item.key, name: item.name, rarity: item.rarity, slot: item.slot, anime: item.anime },
  })
}
