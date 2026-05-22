'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Quest } from '@/lib/game/quests'

type Profile = {
  username: string | null
  gems: number
  last_daily_claim_at: string | null
  streak_days: number
}

const STREAK_MILESTONES: Record<number, number> = { 3: 40, 7: 100 }

function streakFlame(days: number) {
  if (days >= 7) return '🔥'
  if (days >= 3) return '🟠'
  return '✨'
}

export default function HomePage() {
  const [profile, setProfile]       = useState<Profile | null>(null)
  const [quests, setQuests]         = useState<Quest[]>([])
  const [loading, setLoading]       = useState(true)
  const [claiming, setClaiming]     = useState(false)
  const [claimMessage, setClaimMessage] = useState('')
  const [claimingQuest, setClaimingQuest] = useState<string | null>(null)
  const [streakMsg, setStreakMsg]   = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const [profileRes, questsRes, streakRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('username, gems, last_daily_claim_at, streak_days')
          .eq('user_id', user.id)
          .single(),
        fetch('/api/quests'),
        fetch('/api/streak', { method: 'POST' }),
      ])

      if (profileRes.data) setProfile(profileRes.data)

      if (questsRes.ok) {
        const q = await questsRes.json()
        setQuests(q.quests?.quests ?? [])
      }

      if (streakRes.ok) {
        const s = await streakRes.json()
        // Refresh gems + streak after streak update
        if (!s.alreadyCounted) {
          setProfile(prev => prev
            ? { ...prev, streak_days: s.streak, gems: s.gemsAwarded > 0 ? s.gemsTotal : prev.gems }
            : prev
          )
          if (s.gemsAwarded > 0) {
            setStreakMsg(`🔥 Day ${s.milestone} streak! +${s.gemsAwarded} 💎 bonus!`)
          }
        }
      }

      setLoading(false)
    }
    load()
  }, [])

  async function claimDaily() {
    setClaiming(true)
    setClaimMessage('')
    const res = await fetch('/api/daily', { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      setProfile(prev => prev ? { ...prev, gems: data.gemsTotal, last_daily_claim_at: new Date().toISOString() } : prev)
      setClaimMessage(`+${data.gemsAwarded} gems claimed!`)
      // Refresh quests since claim_daily quest is now done
      const qRes = await fetch('/api/quests')
      if (qRes.ok) { const q = await qRes.json(); setQuests(q.quests?.quests ?? []) }
    } else {
      setClaimMessage(data.error)
    }
    setClaiming(false)
  }

  async function claimQuest(key: string) {
    setClaimingQuest(key)
    const res = await fetch('/api/quests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    })
    const data = await res.json()
    if (res.ok) {
      setProfile(prev => prev ? { ...prev, gems: data.gemsTotal } : prev)
      setQuests(prev => prev.map(q => q.key === key ? { ...q, claimed: true } : q))
    }
    setClaimingQuest(null)
  }

  function canClaimDaily() {
    if (!profile?.last_daily_claim_at) return true
    return (Date.now() - new Date(profile.last_daily_claim_at).getTime()) / 3600000 >= 24
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-500 animate-pulse">Loading...</div>
      </main>
    )
  }

  const streak = profile?.streak_days ?? 0
  const nextMilestone = [3, 7].find(m => m > streak) ?? null

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-lg mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-black tracking-tight">⚔️ Anime Arena</h1>
          <button onClick={signOut} className="text-gray-500 hover:text-gray-300 text-sm transition-colors">
            Sign out
          </button>
        </div>

        {/* Gem Balance + Streak side by side */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
            <p className="text-gray-500 text-xs mb-1">Balance</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-yellow-400">{profile?.gems ?? 0}</span>
              <span className="text-yellow-600 text-sm font-semibold">💎</span>
            </div>
          </div>

          <div className={`rounded-2xl p-5 border ${streak >= 7 ? 'bg-orange-950 border-orange-700' : streak >= 3 ? 'bg-amber-950 border-amber-700' : 'bg-gray-900 border-gray-800'}`}>
            <p className="text-gray-400 text-xs mb-1">Login Streak</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-white">{streak}</span>
              <span className="text-lg">{streakFlame(streak)}</span>
            </div>
            <p className="text-gray-500 text-[10px] mt-0.5">
              {nextMilestone
                ? `Day ${nextMilestone} → +${STREAK_MILESTONES[nextMilestone]}💎`
                : streak >= 7 ? '+100💎 / day 7' : 'Log in daily!'}
            </p>
          </div>
        </div>

        {/* Streak milestone toast */}
        {streakMsg && (
          <div className="bg-orange-950 border border-orange-600 text-orange-300 text-sm font-bold rounded-xl px-4 py-3 mb-4 text-center">
            {streakMsg}
          </div>
        )}

        {/* Daily Bonus */}
        <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-white">Daily Bonus</p>
              <p className="text-gray-500 text-sm">+20 gems every 24 hours</p>
            </div>
            <button
              onClick={claimDaily}
              disabled={claiming || !canClaimDaily()}
              className="bg-yellow-500 hover:bg-yellow-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-black rounded-xl px-5 py-2.5 transition-colors text-sm"
            >
              {claiming ? 'Claiming...' : canClaimDaily() ? 'Claim!' : 'Claimed ✓'}
            </button>
          </div>
          {claimMessage && (
            <p className={`text-sm mt-3 font-medium ${claimMessage.startsWith('+') ? 'text-yellow-400' : 'text-gray-400'}`}>
              {claimMessage}
            </p>
          )}
        </div>

        {/* Daily Quests */}
        {quests.length > 0 && (
          <div className="bg-gray-900 rounded-2xl border border-gray-800 mb-6 overflow-hidden">
            <div className="px-5 pt-4 pb-3 border-b border-gray-800 flex items-center justify-between">
              <p className="font-black text-white">Daily Quests</p>
              <p className="text-gray-600 text-xs">Resets at midnight</p>
            </div>
            <div className="divide-y divide-gray-800">
              {quests.map(q => (
                <div key={q.key} className="flex items-center justify-between px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${q.done ? 'bg-green-500 border-green-500' : 'border-gray-600'}`}>
                      {q.done && <span className="text-[10px] text-white font-black">✓</span>}
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${q.claimed ? 'text-gray-600 line-through' : q.done ? 'text-white' : 'text-gray-300'}`}>
                        {q.label}
                      </p>
                      <p className="text-gray-600 text-xs">+{q.reward} 💎</p>
                    </div>
                  </div>
                  {q.done && !q.claimed && (
                    <button
                      onClick={() => claimQuest(q.key)}
                      disabled={claimingQuest === q.key}
                      className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-xs font-black rounded-lg px-3 py-1.5 transition-colors"
                    >
                      {claimingQuest === q.key ? '...' : `+${q.reward} 💎`}
                    </button>
                  )}
                  {q.claimed && (
                    <span className="text-gray-600 text-xs font-semibold">Claimed ✓</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main Actions */}
        <div className="flex flex-col gap-4">

          <Link href="/battle" className="relative bg-gradient-to-r from-red-900 to-orange-900 hover:from-red-800 hover:to-orange-800 border border-red-700 rounded-2xl p-6 transition-colors block overflow-hidden">
            <div className="relative z-10">
              <div className="text-4xl mb-2">⚔️</div>
              <p className="font-black text-white text-2xl">Battle</p>
              <p className="text-red-300 text-sm mt-1">Campaign · Infinite Tower</p>
            </div>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-7xl opacity-20">🏆</div>
          </Link>

          <div className="grid grid-cols-2 gap-4">
            <Link href="/pull" className="bg-violet-600 hover:bg-violet-500 rounded-2xl p-6 text-center transition-colors block">
              <div className="text-4xl mb-3">🎴</div>
              <p className="font-black text-white text-lg">Pull</p>
              <p className="text-violet-300 text-sm mt-1">10 gems each</p>
            </Link>
            <Link href="/collection" className="bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-2xl p-6 text-center transition-colors block">
              <div className="text-4xl mb-3">📚</div>
              <p className="font-black text-white text-lg">Collection</p>
              <p className="text-gray-500 text-sm mt-1">View your cards</p>
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Link href="/pvp" className="bg-gradient-to-br from-violet-900 to-violet-800 hover:from-violet-800 hover:to-violet-700 border border-violet-700 rounded-2xl p-6 text-center transition-colors block">
              <div className="text-4xl mb-3">🥊</div>
              <p className="font-black text-white text-lg">PvP</p>
              <p className="text-violet-300 text-sm mt-1">Fight players · +15 💎</p>
            </Link>
            <Link href="/leaderboard" className="bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-2xl p-6 text-center transition-colors block">
              <div className="text-4xl mb-3">🏆</div>
              <p className="font-black text-white text-lg">Leaderboard</p>
              <p className="text-gray-500 text-sm mt-1">Top players</p>
            </Link>
          </div>

        </div>
      </div>
    </main>
  )
}
