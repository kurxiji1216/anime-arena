'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getHunterRank, playerXpToLevel } from '@/lib/game/player'

type ProfileData = {
  username: string | null
  gems: number
  created_at: string
  player_level: number
  player_xp: number
  pvp_wins: number
  pvp_battles: number
  tower_best_floor: number
  streak_days: number
}

export default function ProfilePage() {
  const [profile,     setProfile]     = useState<ProfileData | null>(null)
  const [email,       setEmail]       = useState<string | null>(null)
  const [uniqueCards, setUniqueCards] = useState(0)
  const [totalCards,  setTotalCards]  = useState(0)
  const [loading,     setLoading]     = useState(true)
  const [username,    setUsername]    = useState('')
  const [saving,      setSaving]      = useState(false)
  const [saveMsg,     setSaveMsg]     = useState('')
  const router  = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setEmail(user.email ?? null)

      const [profileRes, cardsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('username, gems, created_at, player_level, player_xp, pvp_wins, pvp_battles, tower_best_floor, streak_days')
          .eq('user_id', user.id)
          .single(),
        supabase
          .from('user_characters')
          .select('count')
          .eq('user_id', user.id),
      ])

      if (profileRes.data) {
        setProfile(profileRes.data)
        setUsername(profileRes.data.username ?? '')
      }
      if (cardsRes.data) {
        setUniqueCards(cardsRes.data.length)
        setTotalCards(cardsRes.data.reduce((s, c) => s + c.count, 0))
      }
      setLoading(false)
    }
    load()
  }, [])

  async function saveUsername() {
    setSaving(true); setSaveMsg('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase
      .from('profiles')
      .update({ username: username.trim() || null })
      .eq('user_id', user.id)
    setSaveMsg(error ? 'Failed to save.' : 'Saved!')
    setSaving(false)
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: '#06061a' }}>
        <div className="font-game text-indigo-400 text-sm animate-pulse tracking-widest">LOADING...</div>
      </main>
    )
  }

  const playerLevel = profile?.player_level ?? 1
  const playerXp    = profile?.player_xp    ?? 0
  const rank        = getHunterRank(playerLevel)
  const xpNeeded    = playerXpToLevel(playerLevel)
  const xpPct       = Math.min((playerXp / xpNeeded) * 100, 100)
  const pvpWins     = profile?.pvp_wins    ?? 0
  const pvpBattles  = profile?.pvp_battles ?? 0
  const winRate     = pvpBattles > 0 ? Math.round((pvpWins / pvpBattles) * 100) : 0
  const bestFloor   = profile?.tower_best_floor ?? 0
  const streak      = profile?.streak_days ?? 0
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '—'

  return (
    <main className="min-h-screen text-white pb-10" style={{
      background: 'radial-gradient(ellipse at 50% -10%, #1a1060 0%, #06061a 55%)',
    }}>
      <div className="max-w-lg mx-auto px-4 pt-4">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="font-game text-gray-500 hover:text-gray-300 transition-colors text-sm">← Home</Link>
          <span className="font-game font-bold text-white text-sm tracking-widest">PROFILE</span>
          <div className="w-16" />
        </div>

        {/* ── Hunter card ── */}
        <div className="relative rounded-2xl overflow-hidden p-5 mb-4" style={{
          background: `linear-gradient(135deg, ${rank.color}18 0%, rgba(6,6,26,0.95) 60%)`,
          border: `1px solid ${rank.color}44`,
        }}>
          {/* Background glow */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: `radial-gradient(ellipse at 0% 50%, ${rank.color}22 0%, transparent 60%)`,
          }} />

          <div className="relative z-10 flex items-center gap-4">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0" style={{
              background: `${rank.color}22`,
              border: `2px solid ${rank.color}55`,
            }}>
              ⚔️
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                {/* Rank badge */}
                <span
                  className="font-game font-black text-xs px-2 py-0.5 rounded"
                  style={{ background: `${rank.color}22`, border: `1px solid ${rank.color}66`, color: rank.color }}
                >
                  {rank.rank}
                </span>
                <span className="font-game font-bold text-sm" style={{ color: rank.color }}>{rank.title}</span>
              </div>
              <p className="font-black text-white text-xl leading-tight truncate">
                {profile?.username || 'Unnamed Hunter'}
              </p>
              <p className="font-game text-gray-500 text-xs mt-0.5">Member since {memberSince}</p>
            </div>

            {/* Level */}
            <div className="text-right flex-shrink-0">
              <p className="font-game text-gray-500 text-[10px] tracking-widest">LEVEL</p>
              <p className="font-game font-black text-3xl leading-none" style={{ color: rank.color }}>{playerLevel}</p>
            </div>
          </div>

          {/* XP bar */}
          <div className="relative z-10 mt-4">
            <div className="flex justify-between font-game text-[10px] mb-1.5">
              <span className="text-gray-500">Hunter XP</span>
              <span style={{ color: rank.color }}>{playerXp} / {xpNeeded}</span>
            </div>
            <div className="w-full rounded-full h-2" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div className="h-2 rounded-full transition-all" style={{ width: `${xpPct}%`, background: `linear-gradient(90deg, ${rank.color}99, ${rank.color})` }} />
            </div>
          </div>
        </div>

        {/* ── Stats grid ── */}
        <div className="grid grid-cols-2 gap-3 mb-4">

          {/* PvP */}
          <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(236,72,153,0.2)' }}>
            <p className="font-game text-gray-500 text-[10px] tracking-widest mb-2">PvP RECORD</p>
            <p className="font-game font-black text-2xl text-pink-400">{pvpWins} <span className="text-gray-600 text-base font-normal">wins</span></p>
            <p className="font-game text-gray-600 text-xs mt-0.5">{pvpBattles} battles · {winRate}% win rate</p>
          </div>

          {/* Tower */}
          <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(249,115,22,0.2)' }}>
            <p className="font-game text-gray-500 text-[10px] tracking-widest mb-2">TOWER BEST</p>
            <p className="font-game font-black text-2xl text-orange-400">
              {bestFloor > 0 ? `Floor ${bestFloor}` : '—'}
            </p>
            <p className="font-game text-gray-600 text-xs mt-0.5">Infinite Tower</p>
          </div>

          {/* Cards */}
          <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(139,92,246,0.2)' }}>
            <p className="font-game text-gray-500 text-[10px] tracking-widest mb-2">COLLECTION</p>
            <p className="font-game font-black text-2xl text-violet-400">{uniqueCards} <span className="text-gray-600 text-base font-normal">unique</span></p>
            <p className="font-game text-gray-600 text-xs mt-0.5">{totalCards} total pulled</p>
          </div>

          {/* Streak */}
          <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${streak >= 7 ? 'rgba(249,115,22,0.4)' : streak >= 3 ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.08)'}` }}>
            <p className="font-game text-gray-500 text-[10px] tracking-widest mb-2">LOGIN STREAK</p>
            <p className={`font-game font-black text-2xl ${streak >= 7 ? 'text-orange-400' : streak >= 3 ? 'text-amber-400' : 'text-gray-400'}`}>
              {streak} <span className="text-base">{streak >= 7 ? '🔥' : streak >= 3 ? '🟠' : '✦'}</span>
            </p>
            <p className="font-game text-gray-600 text-xs mt-0.5">day{streak !== 1 ? 's' : ''} in a row</p>
          </div>
        </div>

        {/* Gems */}
        <div className="rounded-2xl p-4 mb-4 flex items-center justify-between" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(234,179,8,0.2)' }}>
          <div>
            <p className="font-game text-gray-500 text-[10px] tracking-widest mb-1">GEMS</p>
            <p className="font-game font-black text-2xl text-yellow-400">{profile?.gems ?? 0} 💎</p>
          </div>
          <Link href="/pull" className="font-game font-bold text-sm rounded-xl px-4 py-2 transition-colors" style={{ background: 'rgba(234,179,8,0.15)', border: '1px solid rgba(234,179,8,0.3)', color: '#fbbf24' }}>
            Pull Cards →
          </Link>
        </div>

        {/* ── Edit username ── */}
        <div className="rounded-2xl p-5 mb-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="font-game font-bold text-white text-sm mb-3">Display Name</p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter a username..."
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveUsername()}
              maxLength={32}
              className="flex-1 font-game text-white placeholder-gray-600 rounded-xl px-4 py-2.5 focus:outline-none transition-colors"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
            <button
              onClick={saveUsername}
              disabled={saving}
              className="font-game font-bold rounded-xl px-4 py-2.5 transition-colors disabled:opacity-50"
              style={{ background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.4)', color: '#c4b5fd' }}
            >
              {saving ? '...' : 'Save'}
            </button>
          </div>
          {saveMsg && (
            <p className={`font-game text-sm mt-2 ${saveMsg.includes('Saved') ? 'text-green-400' : 'text-red-400'}`}>{saveMsg}</p>
          )}
          {email && <p className="font-game text-gray-700 text-xs mt-2">{email}</p>}
        </div>

        {/* Sign out */}
        <button
          onClick={signOut}
          className="w-full font-game font-semibold rounded-2xl py-3 transition-colors"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: '#6b7280' }}
        >
          Sign Out
        </button>

      </div>
    </main>
  )
}
