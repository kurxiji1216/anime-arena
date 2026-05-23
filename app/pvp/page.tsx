'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type ProfileStats = {
  pvp_wins:     number
  pvp_battles:  number
  player_level: number
  username:     string | null
}

type TopHunter = {
  user_id:    string
  username:   string | null
  pvp_wins:   number
}

// PvP tier system based on wins
const PVP_TIERS = [
  { minWins:   0, label: 'Unranked', color: '#6b7280', icon: '◇' },
  { minWins:   5, label: 'Bronze',   color: '#b45309', icon: '🥉' },
  { minWins:  20, label: 'Silver',   color: '#9ca3af', icon: '🥈' },
  { minWins:  50, label: 'Gold',     color: '#facc15', icon: '🥇' },
  { minWins: 100, label: 'Platinum', color: '#60a5fa', icon: '💎' },
  { minWins: 250, label: 'Diamond',  color: '#c084fc', icon: '🌟' },
]

function getTier(wins: number) {
  return [...PVP_TIERS].reverse().find(t => wins >= t.minWins) ?? PVP_TIERS[0]
}

export default function PvPPage() {
  const [profile, setProfile] = useState<ProfileStats | null>(null)
  const [top,     setTop]     = useState<TopHunter[]>([])
  const [loading, setLoading] = useState(true)
  const [myId,    setMyId]    = useState<string | null>(null)
  const router    = useRouter()
  const supabase  = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setMyId(user.id)

      const [profileRes, topRes] = await Promise.all([
        supabase.from('profiles')
          .select('pvp_wins, pvp_battles, player_level, username')
          .eq('user_id', user.id)
          .single(),
        supabase.from('profiles')
          .select('user_id, username, pvp_wins')
          .gt('pvp_battles', 0)
          .order('pvp_wins', { ascending: false })
          .limit(5),
      ])

      if (profileRes.data) setProfile(profileRes.data)
      if (topRes.data) setTop(topRes.data)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: '#06061a' }}>
        <div className="font-game text-pink-400 text-sm animate-pulse tracking-widest">LOADING...</div>
      </main>
    )
  }

  const wins        = profile?.pvp_wins    ?? 0
  const battles     = profile?.pvp_battles ?? 0
  const losses      = Math.max(0, battles - wins)
  const winRate     = battles > 0 ? Math.round((wins / battles) * 100) : 0
  const tier        = getTier(wins)
  const nextTier    = PVP_TIERS.find(t => t.minWins > wins)
  const winsToNext  = nextTier ? nextTier.minWins - wins : null

  return (
    <main className="min-h-screen text-white pb-10" style={{
      background: 'radial-gradient(ellipse at 50% -5%, #2d0030 0%, #06061a 60%)',
    }}>
      <div className="max-w-lg mx-auto px-4 pt-4">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <Link href="/" className="font-game text-gray-500 hover:text-gray-300 transition-colors text-sm">← Home</Link>
          <span className="font-game font-bold text-white tracking-widest text-sm">🥊 PvP ARENA</span>
          <div className="w-16" />
        </div>

        {/* ── Player tier card ── */}
        <div className="relative rounded-2xl overflow-hidden p-5 mb-4" style={{
          background: `linear-gradient(135deg, ${tier.color}18 0%, rgba(6,6,26,0.95) 60%)`,
          border: `1px solid ${tier.color}44`,
        }}>
          <div className="absolute inset-0 pointer-events-none" style={{
            background: `radial-gradient(ellipse at 10% 50%, ${tier.color}22 0%, transparent 60%)`,
          }} />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-7xl opacity-10 select-none">{tier.icon}</div>

          <div className="relative z-10">
            <p className="font-game text-gray-500 text-[10px] tracking-widest mb-1">YOUR TIER</p>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-3xl">{tier.icon}</span>
              <p className="font-game font-black text-2xl" style={{ color: tier.color }}>{tier.label}</p>
            </div>
            <p className="font-game text-gray-600 text-xs">{profile?.username || 'Unnamed Hunter'}</p>

            {/* Progress to next tier */}
            {nextTier && winsToNext !== null && (
              <div className="mt-3">
                <div className="flex justify-between font-game text-[10px] mb-1">
                  <span className="text-gray-600">Next: {nextTier.label}</span>
                  <span style={{ color: nextTier.color }}>{winsToNext} {winsToNext === 1 ? 'win' : 'wins'}</span>
                </div>
                <div className="w-full rounded-full h-1.5" style={{ background: 'rgba(255,255,255,0.07)' }}>
                  <div
                    className="h-1.5 rounded-full transition-all"
                    style={{
                      width: `${Math.min(((wins - tier.minWins) / Math.max(nextTier.minWins - tier.minWins, 1)) * 100, 100)}%`,
                      background: `linear-gradient(90deg, ${tier.color}, ${nextTier.color})`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Stats grid ── */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)' }}>
            <p className="font-game text-gray-500 text-[10px] tracking-widest mb-1">WINS</p>
            <p className="font-game font-black text-2xl text-green-400">{wins}</p>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <p className="font-game text-gray-500 text-[10px] tracking-widest mb-1">LOSSES</p>
            <p className="font-game font-black text-2xl text-red-400">{losses}</p>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.2)' }}>
            <p className="font-game text-gray-500 text-[10px] tracking-widest mb-1">WIN RATE</p>
            <p className="font-game font-black text-2xl text-violet-400">{winRate}%</p>
          </div>
        </div>

        {/* ── Find opponent CTA ── */}
        <Link
          href="/battle/fight?mode=pvp"
          className="block w-full font-game font-black text-xl rounded-2xl py-5 mb-2 transition-all hover:scale-[1.01] active:scale-[0.99] text-center"
          style={{
            background: 'linear-gradient(135deg, #db2777 0%, #831843 100%)',
            border: '1px solid rgba(236,72,153,0.5)',
            boxShadow: '0 0 40px rgba(219,39,119,0.3)',
            color: '#fff',
          }}
        >
          ⚔️  FIND OPPONENT
        </Link>
        <p className="font-game text-gray-600 text-xs text-center mb-5">
          +15 💎 per win · No entry fee · No rank stat bonus
        </p>

        {/* ── Top hunters ── */}
        <div className="rounded-2xl p-4 mb-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="font-game font-bold text-white text-sm tracking-widest">🏆 TOP HUNTERS</p>
            <Link href="/leaderboard" className="font-game text-pink-400 hover:text-pink-300 text-xs transition-colors">
              View all →
            </Link>
          </div>
          {top.length === 0 ? (
            <p className="font-game text-gray-600 text-sm text-center py-6">No PvP battles yet — be the first!</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {top.map((row, i) => {
                const isMe = row.user_id === myId
                const medal = ['🥇', '🥈', '🥉'][i] ?? `#${i + 1}`
                return (
                  <div
                    key={row.user_id}
                    className="flex items-center gap-3 rounded-lg px-3 py-2"
                    style={{
                      background: isMe ? 'rgba(236,72,153,0.1)' : 'rgba(255,255,255,0.02)',
                      border: isMe ? '1px solid rgba(236,72,153,0.3)' : '1px solid transparent',
                    }}
                  >
                    <span className="font-game text-sm w-8 text-center">{medal}</span>
                    <p className="font-game font-bold text-white text-sm flex-1 truncate">
                      {row.username ?? 'Unknown'}
                    </p>
                    {isMe && <span className="font-game text-[10px] text-pink-400 font-bold">YOU</span>}
                    <p className="font-game font-black text-pink-400 text-sm">{row.pvp_wins} wins</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </main>
  )
}
