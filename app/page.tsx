'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Profile = {
  username: string | null
  gems: number
  last_daily_claim_at: string | null
}

export default function HomePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState(false)
  const [claimMessage, setClaimMessage] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data } = await supabase
        .from('profiles')
        .select('username, gems, last_daily_claim_at')
        .eq('user_id', user.id)
        .single()

      setProfile(data)
      setLoading(false)
    }

    loadProfile()
  }, [])

  async function claimDaily() {
    setClaiming(true)
    setClaimMessage('')

    const res = await fetch('/api/daily', { method: 'POST' })
    const data = await res.json()

    if (res.ok) {
      setProfile(prev => prev ? { ...prev, gems: data.gemsTotal, last_daily_claim_at: new Date().toISOString() } : prev)
      setClaimMessage(`+${data.gemsAwarded} gems claimed!`)
    } else {
      setClaimMessage(data.error)
    }

    setClaiming(false)
  }

  function canClaimDaily() {
    if (!profile?.last_daily_claim_at) return true
    const hoursSince = (Date.now() - new Date(profile.last_daily_claim_at).getTime()) / (1000 * 60 * 60)
    return hoursSince >= 24
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

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-lg mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-black tracking-tight">⚔️ Anime Arena</h1>
          <button
            onClick={signOut}
            className="text-gray-500 hover:text-gray-300 text-sm transition-colors"
          >
            Sign out
          </button>
        </div>

        {/* Gem Balance */}
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 mb-4">
          <p className="text-gray-500 text-sm mb-1">Your balance</p>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-black text-yellow-400">{profile?.gems ?? 0}</span>
            <span className="text-yellow-600 text-lg font-semibold">💎 gems</span>
          </div>
        </div>

        {/* Daily Bonus */}
        <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800 mb-6">
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

        {/* Main Actions */}
        <div className="flex flex-col gap-4">

          {/* Battle — featured card */}
          <Link
            href="/battle"
            className="relative bg-gradient-to-r from-red-900 to-orange-900 hover:from-red-800 hover:to-orange-800 border border-red-700 rounded-2xl p-6 transition-colors block overflow-hidden"
          >
            <div className="relative z-10">
              <div className="text-4xl mb-2">⚔️</div>
              <p className="font-black text-white text-2xl">Battle</p>
              <p className="text-red-300 text-sm mt-1">Campaign · Infinite Tower</p>
            </div>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-7xl opacity-20">🏆</div>
          </Link>

          {/* Pull + Collection */}
          <div className="grid grid-cols-2 gap-4">
            <Link
              href="/pull"
              className="bg-violet-600 hover:bg-violet-500 rounded-2xl p-6 text-center transition-colors block"
            >
              <div className="text-4xl mb-3">🎴</div>
              <p className="font-black text-white text-lg">Pull</p>
              <p className="text-violet-300 text-sm mt-1">10 gems each</p>
            </Link>

            <Link
              href="/collection"
              className="bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-2xl p-6 text-center transition-colors block"
            >
              <div className="text-4xl mb-3">📚</div>
              <p className="font-black text-white text-lg">Collection</p>
              <p className="text-gray-500 text-sm mt-1">View your cards</p>
            </Link>
          </div>

          {/* PvP + Leaderboard */}
          <div className="grid grid-cols-2 gap-4">
            <Link
              href="/pvp"
              className="bg-gradient-to-br from-violet-900 to-violet-800 hover:from-violet-800 hover:to-violet-700 border border-violet-700 rounded-2xl p-6 text-center transition-colors block"
            >
              <div className="text-4xl mb-3">🥊</div>
              <p className="font-black text-white text-lg">PvP</p>
              <p className="text-violet-300 text-sm mt-1">Fight players · +15 💎</p>
            </Link>

            <Link
              href="/leaderboard"
              className="bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-2xl p-6 text-center transition-colors block"
            >
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
