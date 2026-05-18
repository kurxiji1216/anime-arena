'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { calcEffectiveStats, levelUpCost, maxLevelForStars, minCountForStarUp, starUpCopiesNeeded } from '@/lib/game/stats'

type OwnedCharacter = {
  id: string        // user_characters row id (not used directly)
  count: number
  level: number
  stars: number
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

function StarDisplay({ stars }: { stars: number }) {
  return (
    <span className="text-yellow-400 text-xs tracking-tight">
      {'★'.repeat(stars)}{'☆'.repeat(5 - stars)}
    </span>
  )
}

export default function CollectionPage() {
  const [owned, setOwned] = useState<OwnedCharacter[]>([])
  const [gems, setGems] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterRarity>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<OwnedCharacter | null>(null)
  const [upgrading, setUpgrading] = useState(false)
  const [upgradeMsg, setUpgradeMsg] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const [cardsRes, profileRes] = await Promise.all([
      supabase
        .from('user_characters')
        .select('count, level, stars, character:characters(id, name, source_anime, rarity, base_hp, base_atk, base_def, base_speed)')
        .eq('user_id', user.id),
      supabase.from('profiles').select('gems').eq('user_id', user.id).single(),
    ])

    if (cardsRes.data) {
      const sorted = (cardsRes.data as unknown as OwnedCharacter[]).sort(
        (a, b) => RARITY_ORDER[a.character.rarity] - RARITY_ORDER[b.character.rarity]
      )
      setOwned(sorted)
    }

    if (profileRes.data) setGems(profileRes.data.gems)
    setLoading(false)
  }

  async function levelUp() {
    if (!selected) return
    setUpgrading(true)
    setUpgradeMsg('')

    const res = await fetch('/api/upgrade/level', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterId: selected.character.id }),
    })
    const data = await res.json()

    if (!res.ok) {
      setUpgradeMsg(data.error)
    } else {
      setGems(data.gemsRemaining)
      // Update local state
      const updated = { ...selected, level: data.newLevel }
      setSelected(updated)
      setOwned(prev => prev.map(o =>
        o.character.id === selected.character.id ? { ...o, level: data.newLevel } : o
      ))
      setUpgradeMsg(`⬆️ Now Level ${data.newLevel}! (−${data.gemsSpent} 💎)`)
    }
    setUpgrading(false)
  }

  async function starUp() {
    if (!selected) return
    setUpgrading(true)
    setUpgradeMsg('')

    const res = await fetch('/api/upgrade/star', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterId: selected.character.id }),
    })
    const data = await res.json()

    if (!res.ok) {
      setUpgradeMsg(data.error)
    } else {
      const updated = { ...selected, stars: data.newStars, count: data.countRemaining }
      setSelected(updated)
      setOwned(prev => prev.map(o =>
        o.character.id === selected.character.id
          ? { ...o, stars: data.newStars, count: data.countRemaining }
          : o
      ))
      setUpgradeMsg(`✨ Starred up to ${data.newStars}★! (−${data.copiesConsumed} copies)`)
    }
    setUpgrading(false)
  }

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
                onClick={() => { setSelected(o); setUpgradeMsg('') }}
                className={`bg-gray-900 border-2 ${style.border} rounded-xl p-3 text-left hover:brightness-110 transition-all`}
              >
                <div className={`w-full h-20 rounded-lg border ${style.border} bg-gray-800 flex items-center justify-center mb-2`}>
                  <span className="text-3xl">🎴</span>
                </div>
                <div className="flex items-center justify-between mb-0.5">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${style.badge}`}>{style.label}</span>
                  <StarDisplay stars={o.stars ?? 1} />
                </div>
                <p className="text-white font-bold text-sm mt-1 leading-tight">{o.character.name}</p>
                <p className="text-gray-500 text-xs">{o.character.source_anime}</p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-gray-600 text-xs">Lv {o.level ?? 1}</p>
                  {(o.count ?? 1) > 1 && <p className="text-yellow-600 text-xs font-semibold">×{o.count}</p>}
                </div>
              </button>
            )
          })}
        </div>

      </div>

      {/* Character detail + upgrade modal */}
      {selected && (() => {
        const s = selected
        const style = RARITY_STYLES[s.character.rarity]
        const level = s.level ?? 1
        const stars = s.stars ?? 1
        const count = s.count ?? 1
        const maxLv = maxLevelForStars(stars)
        const lvCost = levelUpCost(level)
        const canLevel = level < maxLv && gems >= lvCost
        const copiesForStar = starUpCopiesNeeded(stars)
        const minForStar = minCountForStarUp(stars)
        const canStar = stars < 5 && count >= minForStar
        const eff = calcEffectiveStats(s.character, level, stars)

        return (
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 z-50"
            onClick={() => setSelected(null)}
          >
            <div
              className={`bg-gray-900 border-2 ${style.border} rounded-2xl p-5 w-full max-w-sm max-h-[90vh] overflow-y-auto`}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${style.badge}`}>{style.label}</span>
                <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
              </div>

              {/* Art placeholder */}
              <div className={`w-full h-32 rounded-xl border ${style.border} bg-gray-800 flex items-center justify-center mb-4`}>
                <span className="text-5xl">🎴</span>
              </div>

              {/* Name + stars */}
              <div className="flex items-start justify-between mb-0.5">
                <h2 className="text-xl font-black text-white">{s.character.name}</h2>
                <StarDisplay stars={stars} />
              </div>
              <p className="text-gray-400 text-sm mb-1">{s.character.source_anime}</p>
              <p className="text-gray-600 text-xs mb-4">
                Level {level}/{maxLv} · {count} {count === 1 ? 'copy' : 'copies'}
              </p>

              {/* Effective stats */}
              <div className="grid grid-cols-4 gap-2 mb-5">
                {[
                  { label: 'HP',  value: eff.hp,    color: 'text-red-400' },
                  { label: 'ATK', value: eff.atk,   color: 'text-orange-400' },
                  { label: 'DEF', value: eff.def,   color: 'text-blue-400' },
                  { label: 'SPD', value: eff.speed, color: 'text-green-400' },
                ].map(stat => (
                  <div key={stat.label} className="bg-gray-800 rounded-xl p-2 text-center">
                    <p className="text-gray-500 text-xs mb-0.5">{stat.label}</p>
                    <p className={`font-black ${stat.color}`}>{stat.value}</p>
                  </div>
                ))}
              </div>

              {/* Upgrade message */}
              {upgradeMsg && (
                <p className={`text-sm mb-3 text-center font-medium ${upgradeMsg.startsWith('⬆️') || upgradeMsg.startsWith('✨') ? 'text-green-400' : 'text-red-400'}`}>
                  {upgradeMsg}
                </p>
              )}

              {/* Level Up */}
              <div className="bg-gray-800 rounded-xl p-3 mb-2">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-white font-bold text-sm">Level Up</p>
                    <p className="text-gray-500 text-xs">
                      {level >= maxLv
                        ? `Max level for ${stars}★ — star up to continue`
                        : `Lv ${level} → ${level + 1} · costs ${lvCost} 💎`}
                    </p>
                  </div>
                  <button
                    onClick={levelUp}
                    disabled={!canLevel || upgrading}
                    className="bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-lg px-4 py-2 text-sm transition-colors"
                  >
                    {upgrading ? '...' : `+1 (${lvCost}💎)`}
                  </button>
                </div>
                {/* Level bar */}
                <div className="w-full bg-gray-700 rounded-full h-1.5">
                  <div className="bg-violet-500 h-1.5 rounded-full transition-all" style={{ width: `${(level / maxLv) * 100}%` }} />
                </div>
              </div>

              {/* Star Up */}
              <div className="bg-gray-800 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-bold text-sm">Star Up</p>
                    <p className="text-gray-500 text-xs">
                      {stars >= 5
                        ? 'Already at max stars ★★★★★'
                        : `${stars}★ → ${stars + 1}★ · need ${minForStar} copies (you have ${count})`}
                    </p>
                    {stars < 5 && !canStar && (
                      <p className="text-yellow-700 text-xs mt-0.5">
                        Need {minForStar - count} more {s.character.name} copies
                      </p>
                    )}
                  </div>
                  <button
                    onClick={starUp}
                    disabled={!canStar || upgrading}
                    className="bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-lg px-4 py-2 text-sm transition-colors"
                  >
                    {upgrading ? '...' : `${stars}→${stars + 1}★`}
                  </button>
                </div>
              </div>

            </div>
          </div>
        )
      })()}
    </main>
  )
}
