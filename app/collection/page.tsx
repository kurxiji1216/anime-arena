'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type OwnedCharacter = {
  count: number
  character: {
    id: string
    name: string
    source_anime: string
    rarity: 'common' | 'rare' | 'epic' | 'legendary'
    base_hp: number
    base_atk: number
    base_def: number
    base_speed: number
  }
}

const RARITY_STYLES = {
  common:    { border: 'border-gray-700',   badge: 'bg-gray-800 text-gray-400',     label: 'Common',    order: 0 },
  rare:      { border: 'border-blue-600',   badge: 'bg-blue-950 text-blue-400',     label: 'Rare',      order: 1 },
  epic:      { border: 'border-violet-600', badge: 'bg-violet-950 text-violet-400', label: 'Epic',      order: 2 },
  legendary: { border: 'border-yellow-500', badge: 'bg-yellow-950 text-yellow-400', label: 'Legendary', order: 3 },
}

const RARITY_ORDER = { legendary: 0, epic: 1, rare: 2, common: 3 }

type FilterRarity = 'all' | 'common' | 'rare' | 'epic' | 'legendary'

export default function CollectionPage() {
  const [owned, setOwned] = useState<OwnedCharacter[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterRarity>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<OwnedCharacter | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data } = await supabase
        .from('user_characters')
        .select('count, character:characters(id, name, source_anime, rarity, base_hp, base_atk, base_def, base_speed)')
        .eq('user_id', user.id)

      if (data) {
        const sorted = (data as unknown as OwnedCharacter[]).sort(
          (a, b) => RARITY_ORDER[a.character.rarity] - RARITY_ORDER[b.character.rarity]
        )
        setOwned(sorted)
      }
      setLoading(false)
    }
    load()
  }, [])

  const filtered = owned.filter(o => {
    const matchRarity = filter === 'all' || o.character.rarity === filter
    const matchSearch = o.character.name.toLowerCase().includes(search.toLowerCase()) ||
                        o.character.source_anime.toLowerCase().includes(search.toLowerCase())
    return matchRarity && matchSearch
  })

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-500 animate-pulse">Loading collection...</div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="text-gray-500 hover:text-gray-300 transition-colors">← Home</Link>
          <h1 className="text-xl font-black">My Collection</h1>
          <span className="text-gray-500 text-sm">{owned.length} cards</span>
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search by name or anime..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-gray-900 text-white placeholder-gray-600 border border-gray-800 rounded-xl px-4 py-3 mb-4 focus:outline-none focus:border-violet-500 transition-colors"
        />

        {/* Rarity filter */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {(['all', 'legendary', 'epic', 'rare', 'common'] as FilterRarity[]).map(r => (
            <button
              key={r}
              onClick={() => setFilter(r)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors capitalize ${
                filter === r
                  ? 'bg-violet-600 text-white'
                  : 'bg-gray-900 text-gray-400 hover:text-white border border-gray-800'
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🎴</div>
            <p className="text-gray-400 font-semibold mb-2">
              {owned.length === 0 ? 'No cards yet' : 'No cards match your filter'}
            </p>
            <p className="text-gray-600 text-sm mb-6">
              {owned.length === 0 ? 'Head to the pull page to start your collection' : 'Try a different filter or search'}
            </p>
            {owned.length === 0 && (
              <Link href="/pull" className="bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-xl px-6 py-3 transition-colors">
                Pull now →
              </Link>
            )}
          </div>
        )}

        {/* Card grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {filtered.map(o => {
            const style = RARITY_STYLES[o.character.rarity]
            return (
              <button
                key={o.character.id}
                onClick={() => setSelected(o)}
                className={`bg-gray-900 border-2 ${style.border} rounded-xl p-3 text-left hover:brightness-110 transition-all`}
              >
                {/* Placeholder art */}
                <div className={`w-full h-24 rounded-lg border ${style.border} bg-gray-800 flex items-center justify-center mb-2`}>
                  <span className="text-3xl">🎴</span>
                </div>

                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${style.badge}`}>
                  {style.label}
                </span>
                <p className="text-white font-bold text-sm mt-1.5 leading-tight">{o.character.name}</p>
                <p className="text-gray-500 text-xs">{o.character.source_anime}</p>
                {o.count > 1 && (
                  <p className="text-yellow-600 text-xs font-semibold mt-1">×{o.count} copies</p>
                )}
              </button>
            )
          })}
        </div>

      </div>

      {/* Character detail modal */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => setSelected(null)}
        >
          <div
            className={`bg-gray-900 border-2 ${RARITY_STYLES[selected.character.rarity].border} rounded-2xl p-6 max-w-sm w-full`}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${RARITY_STYLES[selected.character.rarity].badge}`}>
                {RARITY_STYLES[selected.character.rarity].label}
              </span>
              <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
            </div>

            <div className={`w-full h-36 rounded-xl border ${RARITY_STYLES[selected.character.rarity].border} bg-gray-800 flex items-center justify-center mb-4`}>
              <span className="text-5xl">🎴</span>
            </div>

            <h2 className="text-2xl font-black text-white mb-0.5">{selected.character.name}</h2>
            <p className="text-gray-400 text-sm mb-1">{selected.character.source_anime}</p>
            <p className="text-gray-600 text-xs mb-5">Owned: {selected.count} {selected.count === 1 ? 'copy' : 'copies'}</p>

            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'HP',  value: selected.character.base_hp,    color: 'text-red-400' },
                { label: 'ATK', value: selected.character.base_atk,   color: 'text-orange-400' },
                { label: 'DEF', value: selected.character.base_def,   color: 'text-blue-400' },
                { label: 'SPD', value: selected.character.base_speed, color: 'text-green-400' },
              ].map(stat => (
                <div key={stat.label} className="bg-gray-800 rounded-xl p-2.5 text-center">
                  <p className="text-gray-500 text-xs mb-1">{stat.label}</p>
                  <p className={`font-black text-lg ${stat.color}`}>{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
