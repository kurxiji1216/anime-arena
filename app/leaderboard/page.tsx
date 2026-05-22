'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type PvPRow = {
  username: string | null
  pvp_wins: number
  pvp_battles: number
}

type TowerRow = {
  username: string | null
  tower_best_floor: number
}

type CollectionRow = {
  username: string | null
  total: number
}

type Tab = 'pvp' | 'tower' | 'collection'

const MEDAL = ['🥇', '🥈', '🥉']

export default function LeaderboardPage() {
  const [tab, setTab]               = useState<Tab>('pvp')
  const [pvp, setPvp]               = useState<PvPRow[]>([])
  const [tower, setTower]           = useState<TowerRow[]>([])
  const [collection, setCollection] = useState<CollectionRow[]>([])
  const [loading, setLoading]       = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // Fetch all three boards in parallel
      const [pvpRes, towerRes, collectionRes] = await Promise.all([
        // PvP: top 20 by wins, must have played at least 1 battle
        supabase
          .from('profiles')
          .select('username, pvp_wins, pvp_battles')
          .gt('pvp_battles', 0)
          .order('pvp_wins', { ascending: false })
          .limit(20),

        // Tower: top 20 by best floor
        supabase
          .from('profiles')
          .select('username, tower_best_floor')
          .gt('tower_best_floor', 0)
          .order('tower_best_floor', { ascending: false })
          .limit(20),

        // Collection: just get user_id from every owned character row
        supabase
          .from('user_characters')
          .select('user_id')
          .limit(5000),
      ])

      if (pvpRes.data)    setPvp(pvpRes.data)
      if (towerRes.data)  setTower(towerRes.data)

      // Roll up collection counts, then fetch usernames in a second query
      if (collectionRes.data) {
        // Count characters per user
        const counts: Record<string, number> = {}
        for (const row of collectionRes.data as { user_id: string }[]) {
          counts[row.user_id] = (counts[row.user_id] ?? 0) + 1
        }

        // Top 20 user IDs by character count
        const topIds = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 20)
          .map(([uid]) => uid)

        // Fetch their usernames from profiles
        const { data: profileRows } = await supabase
          .from('profiles')
          .select('user_id, username')
          .in('user_id', topIds)

        const usernameMap: Record<string, string | null> = {}
        for (const p of profileRows ?? []) usernameMap[p.user_id] = p.username

        setCollection(topIds.map(uid => ({ username: usernameMap[uid] ?? null, total: counts[uid] })))
      }

      setLoading(false)
    }
    load()
  }, [])

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-lg mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="text-gray-500 hover:text-gray-300 transition-colors">← Home</Link>
          <h1 className="text-xl font-black">🏆 Leaderboard</h1>
          <div className="w-16" />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 bg-gray-900 border border-gray-800 rounded-xl p-1">
          {([
            { id: 'pvp',        label: '⚔️ PvP' },
            { id: 'tower',      label: '🗼 Tower' },
            { id: 'collection', label: '📚 Cards' },
          ] as { id: Tab; label: string }[]).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 rounded-lg py-2 text-sm font-bold transition-colors ${
                tab === t.id
                  ? 'bg-white text-gray-950'
                  : 'text-gray-500 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-600 animate-pulse">Loading...</div>
        ) : (
          <>
            {/* ── PvP Tab ── */}
            {tab === 'pvp' && (
              <div className="flex flex-col gap-2">
                {pvp.length === 0 && (
                  <div className="text-center py-16 text-gray-600">
                    <p className="text-4xl mb-3">⚔️</p>
                    <p>No PvP battles yet — be the first!</p>
                  </div>
                )}
                {pvp.map((row, i) => {
                  const winRate = row.pvp_battles > 0
                    ? Math.round((row.pvp_wins / row.pvp_battles) * 100)
                    : 0
                  return (
                    <div key={i} className="flex items-center gap-4 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
                      <span className="text-xl w-7 text-center shrink-0">
                        {i < 3 ? MEDAL[i] : <span className="text-gray-600 font-bold text-sm">#{i + 1}</span>}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-white truncate">{row.username ?? 'Unknown'}</p>
                        <p className="text-gray-500 text-xs">{row.pvp_battles} battles · {winRate}% win rate</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-black text-green-400 text-lg">{row.pvp_wins}</p>
                        <p className="text-gray-600 text-xs">wins</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* ── Tower Tab ── */}
            {tab === 'tower' && (
              <div className="flex flex-col gap-2">
                {tower.length === 0 && (
                  <div className="text-center py-16 text-gray-600">
                    <p className="text-4xl mb-3">🗼</p>
                    <p>Nobody has climbed the tower yet!</p>
                  </div>
                )}
                {tower.map((row, i) => (
                  <div key={i} className="flex items-center gap-4 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
                    <span className="text-xl w-7 text-center shrink-0">
                      {i < 3 ? MEDAL[i] : <span className="text-gray-600 font-bold text-sm">#{i + 1}</span>}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white truncate">{row.username ?? 'Unknown'}</p>
                      <p className="text-gray-500 text-xs">Infinite Tower</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-black text-orange-400 text-lg">Floor {row.tower_best_floor}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Collection Tab ── */}
            {tab === 'collection' && (
              <div className="flex flex-col gap-2">
                {collection.length === 0 && (
                  <div className="text-center py-16 text-gray-600">
                    <p className="text-4xl mb-3">📚</p>
                    <p>No collectors yet!</p>
                  </div>
                )}
                {collection.map((row, i) => (
                  <div key={i} className="flex items-center gap-4 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
                    <span className="text-xl w-7 text-center shrink-0">
                      {i < 3 ? MEDAL[i] : <span className="text-gray-600 font-bold text-sm">#{i + 1}</span>}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white truncate">{row.username ?? 'Unknown'}</p>
                      <p className="text-gray-500 text-xs">unique characters</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-black text-violet-400 text-lg">{row.total}</p>
                      <p className="text-gray-600 text-xs">cards</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

      </div>
    </main>
  )
}
