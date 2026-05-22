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
  image_url: string | null
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
  common:    { border: 'border-gray-600',   glow: '',               shimmer: '',                       badge: 'bg-gray-700 text-gray-300',     label: 'Common' },
  rare:      { border: 'border-blue-500',   glow: 'glow-rare',      shimmer: 'card-shimmer',           badge: 'bg-blue-900 text-blue-300',     label: 'Rare' },
  epic:      { border: 'border-violet-500', glow: 'glow-epic',      shimmer: 'card-shimmer',           badge: 'bg-violet-900 text-violet-300', label: 'Epic' },
  legendary: { border: 'border-yellow-400', glow: 'glow-legendary', shimmer: 'card-shimmer-legendary', badge: 'bg-yellow-900 text-yellow-300', label: 'Legendary ✨' },
}

export default function PullPage() {
  const [gems, setGems] = useState<number | null>(null)
  const [pulling, setPulling] = useState(false)
  const [result, setResult] = useState<PullResult | null>(null)
  const [error, setError] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data } = await supabase.from('profiles').select('gems').eq('user_id', user.id).single()
      if (data) setGems(data.gems)
    }
    load()
  }, [])

  async function doPull() {
    if (gems !== null && gems < 10) {
      setError('Not enough gems!')
      return
    }
    setPulling(true)
    setResult(null)
    setRevealed(false)
    setShowDetails(false)
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
    // User must tap the card — no auto-reveal
  }

  function handleReveal() {
    if (revealed) return
    setRevealed(true)
    // Wait for flip animation (650ms) then show details
    setTimeout(() => setShowDetails(true), 650)
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

        {/* ── Card reveal area ── */}
        {result && style && (
          <div className="flex flex-col items-center">

            {/* Floating wrapper — stops floating once revealed */}
            <div className={!revealed ? 'card-waiting' : ''}>
              <div
                className="flip-container w-[220px] h-[320px] cursor-pointer"
                onClick={handleReveal}
              >
                <div className={`flip-inner w-full h-full ${revealed ? 'is-flipped' : ''}`}>

                  {/* ── BACK FACE ── */}
                  <div className="flip-face rounded-2xl border-2 border-gray-700 overflow-hidden bg-gray-900">
                    <div className="w-full h-full flex flex-col items-center justify-center relative">
                      {/* Diagonal grid pattern */}
                      <div
                        className="absolute inset-0"
                        style={{
                          backgroundImage: [
                            'repeating-linear-gradient(45deg,  rgba(255,255,255,0.04) 0, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 14px)',
                            'repeating-linear-gradient(-45deg, rgba(255,255,255,0.04) 0, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 14px)',
                          ].join(', '),
                        }}
                      />
                      <span className="text-5xl mb-3 relative z-10 drop-shadow-lg">⚔️</span>
                      <p className="text-gray-600 text-[10px] font-black tracking-[0.2em] uppercase relative z-10">
                        Anime Arena
                      </p>
                    </div>
                  </div>

                  {/* ── FRONT FACE ── */}
                  <div className={`flip-face flip-face-front rounded-2xl border-2 ${style.border} ${style.glow} ${style.shimmer} overflow-hidden relative`}>
                    {/* Portrait */}
                    {result.character.image_url ? (
                      <img
                        src={result.character.image_url}
                        alt={result.character.name}
                        className="w-full h-full object-cover object-top"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                        <span className="text-6xl opacity-20">👤</span>
                      </div>
                    )}

                    {/* Bottom name gradient */}
                    <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/95 via-black/60 to-transparent flex flex-col justify-end p-3">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full self-start mb-1.5 ${style.badge}`}>
                        {style.label}
                      </span>
                      <p className="text-white font-black text-sm leading-tight drop-shadow">
                        {result.character.name}
                      </p>
                    </div>

                    {/* NEW / Duplicate badge */}
                    <div className="absolute top-2.5 right-2.5">
                      {result.isNew ? (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-green-500 text-white shadow-lg">
                          NEW!
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/70 text-gray-300">
                          ×{result.totalCount}
                        </span>
                      )}
                    </div>

                  </div>
                </div>
              </div>
            </div>

            {/* Tap prompt */}
            {!revealed && (
              <p className="tap-hint text-gray-400 text-sm font-semibold mt-5">
                👆 Tap card to reveal
              </p>
            )}

            {/* Character details — slide up after flip lands */}
            {showDetails && (
              <div className="details-in w-full max-w-xs mt-6">
                <p className="text-center text-gray-400 text-sm mb-4">{result.character.source_anime}</p>

                <div className="grid grid-cols-4 gap-2 mb-6">
                  {[
                    { label: 'HP',  value: result.character.base_hp,    color: 'text-red-400' },
                    { label: 'ATK', value: result.character.base_atk,   color: 'text-orange-400' },
                    { label: 'DEF', value: result.character.base_def,   color: 'text-blue-400' },
                    { label: 'SPD', value: result.character.base_speed, color: 'text-green-400' },
                  ].map(stat => (
                    <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-xl p-2.5 text-center">
                      <p className="text-gray-500 text-xs mb-1">{stat.label}</p>
                      <p className={`font-black text-lg ${stat.color}`}>{stat.value}</p>
                    </div>
                  ))}
                </div>

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

          </div>
        )}

        {/* Pull button — shown when no result yet */}
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
