import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/equipment/unequip — body { equipmentId }
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  let body: { equipmentId?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (typeof body.equipmentId !== 'string') return NextResponse.json({ error: 'Missing equipmentId' }, { status: 400 })
  const equipmentId = body.equipmentId

  const { error, count } = await supabase
    .from('user_equipment')
    .update({ equipped_on_character_id: null }, { count: 'exact' })
    .eq('id', equipmentId)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: 'Failed to unequip' }, { status: 500 })
  if (!count) return NextResponse.json({ error: "You don't own that item" }, { status: 403 })

  return NextResponse.json({ unequipped: equipmentId })
}
