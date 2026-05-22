'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getHunterRank } from '@/lib/game/player'

// ─── Types ────────────────────────────────────────────────────────────────────

type PvPRow       = { user_id: string; username: string | null; pvp_wins: number; pvp_battles: number }
type TowerRow     = { user_id: string; username: string | null; tower_best_floor: number }
type CollectionRow = { username: string | null; total: number; user_id: string }
type RankRow      = { user_id: string; username: string | null; player_level: number; player_xp: number }

type Tab = 'rank' | 'pvp' | 'tower' | 'collection'

const MEDAL = ['🥇', '🥈', '🥉']

const TABS: { id: Tab; label: string }[] = [
  { id: 'rank',       label: '🎖️ Rank' },
  { id: 'pvp',        label: '⚔️ PvP' },
  { id: 'tower',      label: '🗼 Tower' },
  { id: 'collection', label: '📚 Cards' },
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function LeaderboardPage() {
  const [tab,        setTab]        = useState<Tab>('rank')
  const [ranks,      setRanks]      = useState<RankRow[]>([])
  const [pvp,        setPvp]        = useState<PvPRow[]>([])
  const [tower,      setTower]      = useState<TowerRow[]>([])
  const [collection, setCollection] = useState<CollectionRow[]>([])
  const [myId,       setMyId]       = useState<string | null>(null)
  const [loading,    setLoading]    = useState(true)
  const router  = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setMyId(user.id)

      const [rankRes, pvpRes, towerRes, colRes] = await Promise.all([
        // Rank: top 20 by player_level then player_xp
        supabase
          .from('profiles')
          .select('user_id, username, player_level, player_xp')
          .order('player_level', { ascending: false })
          .order('player_xp',    { ascending: false })
          .limit(20),

        // PvP: top 20 by wins
        supabase
          .from('profiles')
          .select('user_id, username, pvp_wins, pvp_battles')
          .gt('pvp_battles', 0)
          .order('pvp_wins', { ascending: false })
          .limit(20),

        // Tower: top 20 by best floor
        supabase
          .from('profiles')
          .select('user_id, username, tower_best_floor')
          .gt('tower_best_floor', 0)
          .order('tower_best_floor', { ascending: false })
          .limit(20),

        // Collection: count unique characters per user
        supabase
          .from('user_characters')
          .select('user_id')
          .limit(5000),
      ])

      if (rankRes.data)  setRanks(rankRes.data)
      if (pvpRes.data)   setPvp(pvpRes.data)
      if (towerRes.data) setTower(towerRes.data)

      // Roll up collection counts
      if (colRes.data) {
        const counts: Record<string, number> = {}
        for (const row of colRes.data as { user_id: string }[]) {
          counts[row.user_id] = (counts[row.user_id] ?? 0) + 1
        }
        const topIds = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 20)
          .map(([uid]) => uid)

        const { data: profileRows } = await supabase
          .from('profiles')
          .select('user_id, username')
          .in('user_id', topIds)

        const nameMap: Record<string, string | null> = {}
        for (const p of profileRows ?? []) nameMap[p.user_id] = p.username

        setCollection(topIds.map(uid => ({ user_id: uid, username: nameMap[uid] ?? null, total: counts[uid] })))
      }

      setLoading(false)
    }
    load()
  }, [])

  // ── Helpers ──
  function isMe(userId: string) { return userId === myId }

  function RowWrapper({ userId, children }: { userId: string; children: React.ReactNode }) {
    const me = isMe(userId)
    return (
      <div className="flex items-center gap-3 rounded-xl px-4 py-3 transition-all" style={{
        background: me ? 'rgba(139,92,246,0.1)' : 'rgba(255,255,255,0.03)',
        border: me ? '1px solid rgba(139,92,246,0.35)' : '1px solid rgba(255,255,255,0.06)',
      }}>
        {children}
        {me && <span className="font-game text-[10px] text-violet-400 font-bold shrink-0">YOU</span>}
      </div>
    )
  }

  function RankBadge({ pos }: { pos: number }) {
    if (pos < 3) return <span className="text-xl w-7 text-center shrink-0">{MEDAL[pos]}</span>
    return <span className="font-game font-bold text-gray-600 text-sm w-7 text-center shrink-0">#{pos + 1}</span>
  }

  return (
    <main className="min-h-screen text-white pb-10" style={{
      background: 'radial-gradient(ellipse at 50% -10%, #1a1000 0%, #06061a 55%)',
    }}>
      <div className="max-w-lg mx-auto px-4 pt-4">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="font-game text-gray-500 hover:text-gray-300 transition-colors text-sm">← Home</Link>
          <span className="font-game font-bold text-white tracking-widest text-sm">🏆 LEADERBOARD</span>
          <div className="w-16" />
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-4 gap-1 rounded-xl p-1 mb-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="rounded-lg py-2 font-game text-xs font-bold transition-all"
              style={{
                background: tab === t.id ? 'rgba(255,255,255,0.12)' : 'transparent',
                color: tab === t.id ? '#fff' : '#6b7280',
                border: tab === t.id ? '1px solid rgba(255,255,255,0.15)' : '1px solid transparent',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-20 font-game text-gray-700 animate-pulse">Loading...</div>
        ) : (
          <div className="flex flex-col gap-2">

            {/* ── Rank Tab ── */}
            {tab === 'rank' && (
              <>
                {ranks.length === 0 && (
                  <div className="text-center py-16 text-gray-600">
                    <p className="text-4xl mb-3">🎖️</p>
                    <p className="font-game text-sm">No hunters yet — start battling!</p>
                  </div>
                )}
                {ranks.map((row, i) => {
                  const r = getHunterRank(row.player_level ?? 1)
                  return (
                    <RowWrapper key={row.user_id} userId={row.user_id}>
                      <RankBadge pos={i} />
                      {/* Rank badge */}
                      <span
                        className="font-game font-black text-xs px-2 py-0.5 rounded shrink-0"
                        style={{ background: `${r.color}22`, border: `1px solid ${r.color}55`, color: r.color }}
                      >
                        {r.rank}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-white truncate">{row.username ?? 'Unknown Hunter'}</p>
                        <p className="font-game text-gray-600 text-xs">{r.title}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-game font-black text-lg" style={{ color: r.color }}>Lv.{row.player_level ?? 1}</p>
                      </div>
                    </RowWrapper>
                  )
                })}
              </>
            )}

            {/* ── PvP Tab ── */}
            {tab === 'pvp' && (
              <>
                {pvp.length === 0 && (
                  <div className="text-center py-16 text-gray-600">
                    <p className="text-4xl mb-3">⚔️</p>
                    <p className="font-game text-sm">No PvP battles yet — be the first!</p>
                  </div>
                )}
                {pvp.map((row, i) => {
                  const winRate = row.pvp_battles > 0 ? Math.round((row.pvp_wins / row.pvp_battles) * 100) : 0
                  return (
                    <RowWrapper key={row.user_id} userId={row.user_id}>
                      <RankBadge pos={i} />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-white truncate">{row.username ?? 'Unknown'}</p>
                        <p className="font-game text-gray-600 text-xs">{row.pvp_battles} battles · {winRate}% win rate</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-game font-black text-lg text-pink-400">{row.pvp_wins}</p>
                        <p className="font-game text-gray-600 text-[10px]">wins</p>
                      </div>
                    </RowWrapper>
                  )
                })}
              </>
            )}

            {/* ── Tower Tab ── */}
            {tab === 'tower' && (
              <>
                {tower.length === 0 && (
                  <div className="text-center py-16 text-gray-600">
                    <p className="text-4xl mb-3">🗼</p>
                    <p className="font-game text-sm">Nobody has climbed the tower yet!</p>
                  </div>
                )}
                {tower.map((row, i) => (
                  <RowWrapper key={row.user_id} userId={row.user_id}>
                    <RankBadge pos={i} />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white truncate">{row.username ?? 'Unknown'}</p>
                      <p className="font-game text-gray-600 text-xs">Infinite Tower</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-game font-black text-lg text-orange-400">Floor {row.tower_best_floor}</p>
                    </div>
                  </RowWrapper>
                ))}
              </>
            )}

            {/* ── Collection Tab ── */}
            {tab === 'collection' && (
              <>
                {collection.length === 0 && (
                  <div className="text-center py-16 text-gray-600">
                    <p className="text-4xl mb-3">📚</p>
                    <p className="font-game text-sm">No collectors yet!</p>
                  </div>
                )}
                {collection.map((row, i) => (
                  <RowWrapper key={row.user_id} userId={row.user_id}>
                    <RankBadge pos={i} />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white truncate">{row.username ?? 'Unknown'}</p>
                      <p className="font-game text-gray-600 text-xs">unique characters</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-game font-black text-lg text-violet-400">{row.total}</p>
                      <p className="font-game text-gray-600 text-[10px]">cards</p>
                    </div>
                  </RowWrapper>
                ))}
              </>
            )}

          </div>
        )}

      </div>
    </main>
  )
}
