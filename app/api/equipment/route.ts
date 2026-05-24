import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEquipment } from '@/lib/game/equipment'

// GET /api/equipment — returns the current user's full inventory + sparks balance
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  const [profileRes, invRes] = await Promise.all([
    supabase.from('profiles').select('sparks').eq('user_id', user.id).single(),
    supabase
      .from('user_equipment')
      .select('id, equipment_key, equipped_on_character_id, acquired_at')
      .eq('user_id', user.id)
      .order('acquired_at', { ascending: false }),
  ])

  // Hydrate each row with its catalog data (drop any orphans whose catalog entry is gone)
  const inventory = (invRes.data ?? [])
    .map(row => {
      const item = getEquipment(row.equipment_key)
      if (!item) return null
      return {
        id:                       row.id,
        equipment_key:            row.equipment_key,
        equipped_on_character_id: row.equipped_on_character_id,
        acquired_at:              row.acquired_at,
        item,
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)

  return NextResponse.json({
    sparks:    profileRes.data?.sparks ?? 0,
    inventory,
  })
}
