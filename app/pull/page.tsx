'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Character = {
  id: string
  name: string
  source_anime: string
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  base_hp: number
  base_atk: number
  base_def: number
  base_speed: number
}

type PullResult = {
  character: Character
  gemsRemaining: number
  isNew: boolean
  totalCount: number
}

const RARITY_STYLES = {
  common:    { border: 'border-gray-600',   glow: '',                          badge: 'bg-gray-700 text-gray-300',       label: 'Common' },
  rare:      { border: 'border-blue-500',   glow: 'shadow-blue-500/30',        badge: 'bg-blue-900 text-blue-300',       label: 'Rare' },
  epic:      { border: 'border-violet-500', glow: 'shadow-violet-500/40',      badge: 'bg-violet-900 text-violet-300',   label: 'Epic' },
  legendary: { border: 'border-yellow-400', glow: 'shadow-yellow-400/50',      badge: 'bg-yellow-900 text-yellow-300',   label: 'Legendary ✨' },
}

export default function PullPage() {
  const [gems, setGems] = useState<number | null>(null)
  const [pulling, setPulling] = useState(false)
  const [result, setResult] = useState<PullResult | null>(null)
  const [error, setError] = useState('')
  const [revealed, setRevealed] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data } = await supabase
        .from('profiles')
        .select('gems')
        .eq('user_id', user.id)
        .single()

      if (data) setGems(data.gems)
    }
    load()
  }, [])

  async function doPull() {
    if (gems !== null && gems < 10) {
      setError('Not enough gems! Claim your daily bonus or come back tomorrow.')
      return
    }

    setPulling(true)
    setResult(null)
    setRevealed(false)
    setError('')

    const res = await fetch('/api/pull', { method: 'POST' })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error)
      setPulling(false)
      return
    }

    setResult(data)
    setGems(data.gemsRemaining)
    setPulling(false)

    // Small delay then reveal for dramatic effect
    setTimeout(() => setRevealed(true), 100)
  }

  const style = result ? RARITY_STYLES[result.character.rarity] : null

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-lg mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="text-gray-500 hover:text-gray-300 transition-colors">← Home</Link>
          <div className="flex items-center gap-1.5 bg-gray-900 border border-gray-800 rounded-full px-4 py-1.5">
            <span className="text-yellow-400 font-black">{gems ?? '...'}</span>
            <span className="text-yellow-600 text-sm">💎</span>
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black mb-1">Character Pull</h1>
          <p className="text-gray-500">10 gems per pull · 2% legendary chance</p>
        </div>

        {/* Result Card */}
        {result && style && (
          <div className={`transition-all duration-500 ${revealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <div className={`bg-gray-900 rounded-2xl border-2 ${style.border} ${style.glow ? `shadow-xl ${style.glow}` : ''} p-6 mb-6`}>

              {/* Rarity + New badge */}
              <div className="flex items-center justify-between mb-4">
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${style.badge}`}>
                  {style.label}
                </span>
                {result.isNew ? (
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-green-900 text-green-300">NEW!</span>
                ) : (
                  <span className="text-xs text-gray-500">Duplicate #{result.totalCount}</span>
                )}
              </div>

              {/* Character placeholder art */}
              <div className={`w-full h-40 rounded-xl border ${style.border} bg-gray-800 flex items-center justify-center mb-4`}>
                <div className="text-center">
                  <div className="text-5xl mb-2">🎴</div>
                  <p className="text-gray-500 text-xs">Art coming soon</p>
                </div>
              </div>

              {/* Name & source */}
              <h2 className="text-2xl font-black text-white mb-0.5">{result.character.name}</h2>
              <p className="text-gray-400 text-sm mb-5">{result.character.source_anime}</p>

              {/* Stats */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'HP', value: result.character.base_hp, color: 'text-red-400' },
                  { label: 'ATK', value: result.character.base_atk, color: 'text-orange-400' },
                  { label: 'DEF', value: result.character.base_def, color: 'text-blue-400' },
                  { label: 'SPD', value: result.character.base_speed, color: 'text-green-400' },
                ].map(stat => (
                  <div key={stat.label} className="bg-gray-800 rounded-xl p-2.5 text-center">
                    <p className="text-gray-500 text-xs mb-1">{stat.label}</p>
                    <p className={`font-black text-lg ${stat.color}`}>{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Post-pull actions */}
            <div className="flex gap-3">
              <button
                onClick={doPull}
                disabled={pulling || (gems !== null && gems < 10)}
                className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black rounded-xl py-3 transition-colors"
              >
                Pull Again (10 💎)
              </button>
              <Link
                href="/collection"
                className="flex-1 bg-gray-900 hover:bg-gray-800 border border-gray-800 text-white font-bold rounded-xl py-3 text-center transition-colors"
              >
                Collection →
              </Link>
            </div>
          </div>
        )}

        {/* Pull button (shown when no result yet) */}
        {!result && (
          <div className="text-center">
            <button
              onClick={doPull}
              disabled={pulling || gems === null || gems < 10}
              className="bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black rounded-2xl px-12 py-5 text-xl transition-all hover:scale-105 active:scale-95 shadow-xl shadow-violet-900/40"
            >
              {pulling ? '✨ Pulling...' : '🎴 Pull (10 💎)'}
            </button>

            {gems !== null && gems < 10 && (
              <p className="text-gray-500 text-sm mt-4">
                Not enough gems.{' '}
                <Link href="/" className="text-yellow-400 hover:text-yellow-300">Claim your daily bonus →</Link>
              </p>
            )}
          </div>
        )}

        {error && (
          <p className="text-red-400 text-center text-sm mt-4">{error}</p>
        )}

      </div>
    </main>
  )
}
