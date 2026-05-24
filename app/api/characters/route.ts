import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/characters?ids=uuid1,uuid2,uuid3
// Returns a name-and-anime lookup for the given character ids.
// Characters are public data so no auth required — but we still gate on user being logged in
// to discourage scraping by anonymous bots.
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  const url = new URL(request.url)
  const idsParam = url.searchParams.get('ids') ?? ''
  const ids = idsParam.split(',').map(s => s.trim()).filter(Boolean)
  if (ids.length === 0) return NextResponse.json({ characters: {} })

  const { data } = await supabase
    .from('characters')
    .select('id, name, source_anime')
    .in('id', ids)

  const lookup: Record<string, { name: string; source_anime: string }> = {}
  for (const c of data ?? []) {
    lookup[c.id] = { name: c.name, source_anime: c.source_anime }
  }

  return NextResponse.json({ characters: lookup })
}
