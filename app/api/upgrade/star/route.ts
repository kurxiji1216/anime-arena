import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/upgrade/star — consume copies to bump star rating by 1.
//
// Plain English: count check + decrement + star bump happen atomically inside
// star_up_character(). No way to spend the same copies twice.

type StarUpRow = {
  success: boolean
  error_message: string | null
  new_stars: number
  copies_consumed: number
  count_remaining: number
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  let body: { characterId?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (typeof body.characterId !== 'string') return NextResponse.json({ error: 'Missing characterId' }, { status: 400 })
  const characterId = body.characterId

  const { data: rows, error } = await supabase.rpc('star_up_character', { p_character_id: characterId })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const row = (rows as StarUpRow[] | null)?.[0]
  if (!row) return NextResponse.json({ error: 'Star-up failed' }, { status: 500 })
  if (!row.success) return NextResponse.json({ error: row.error_message ?? 'Star-up failed' }, { status: 400 })

  return NextResponse.json({
    newStars:       row.new_stars,
    copiesConsumed: row.copies_consumed,
    countRemaining: row.count_remaining,
  })
}
