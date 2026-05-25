'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

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

type SingleResult = {
  character: Character
  gemsRemaining: number
  isNew: boolean
  totalCount: number
}

type MultiPullEntry = {
  character: Character
  isNew: boolean
  totalCount: number
}

type MultiResult = {
  pulls: MultiPullEntry[]
  gemsRemaining: number
  playerXpGained?: number
  newPlayerRank?: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const RARITY_ORDER = { legendary: 0, epic: 1, rare: 2, common: 3 }

const RARITY_STYLES = {
  common:    { border: 'border-gray-600',   glow: '',               shimmer: '',                       badge: 'bg-gray-700 text-gray-300',     label: 'Common' },
  rare:      { border: 'border-blue-500',   glow: 'glow-rare',      shimmer: 'card-shimmer',           badge: 'bg-blue-900 text-blue-300',     label: 'Rare' },
  epic:      { border: 'border-violet-500', glow: 'glow-epic',      shimmer: 'card-shimmer',           badge: 'bg-violet-900 text-violet-300', label: 'Epic' },
  legendary: { border: 'border-yellow-400', glow: 'glow-legendary', shimmer: 'card-shimmer-legendary', badge: 'bg-yellow-900 text-yellow-300', label: 'Legendary ✨' },
}

const RARITY_LABEL_COLOR = {
  common: 'text-gray-400', rare: 'text-blue-400', epic: 'text-violet-400', legendary: 'text-yellow-400',
}

// ─── Component ────────────────────────────────────────────────────────────────

type PullHistoryEntry = {
  name: string
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  imageUrl: string | null
  isNew: boolean
  pulledAt: string
}

const HARD_PITY = 90

export default function PullPage() {
  const [gems,        setGems]        = useState<number | null>(null)
  const [pulling,     setPulling]     = useState(false)
  const [error,       setError]       = useState('')
  const [pity,        setPity]        = useState(0)
  const [history,     setHistory]     = useState<PullHistoryEntry[]>([])
  const [showHistory, setShowHistory] = useState(false)

  // Single pull state
  const [single,      setSingle]      = useState<SingleResult | null>(null)
  const [revealed,    setRevealed]    = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  // Multi pull state
  const [multi,         setMulti]         = useState<MultiResult | null>(null)
  const [revealedCount, setRevealedCount] = useState(0)
  const [allRevealed,   setAllRevealed]   = useState(false)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const router  = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data } = await supabase.from('profiles').select('gems, pity_counter, pull_history').eq('user_id', user.id).single()
      if (data) {
        setGems(data.gems)
        setPity(data.pity_counter ?? 0)
        setHistory(Array.isArray(data.pull_history) ? data.pull_history : [])
      }
    }
    load()
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  // Auto-reveal multi cards one by one
  useEffect(() => {
    if (!multi) return
    setRevealedCount(0)
    setAllRevealed(false)

    let count = 0
    intervalRef.current = setInterval(() => {
      count++
      setRevealedCount(count)
      if (count >= multi.pulls.length) {
        clearInterval(intervalRef.current!)
        setTimeout(() => setAllRevealed(true), 300)
      }
    }, 380)

    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [multi])

  // ── Single pull ──
  async function doPull() {
    if (gems !== null && gems < 10) { setError('Not enough gems!'); return }
    setPulling(true)
    setSingle(null)
    setRevealed(false)
    setShowDetails(false)
    setError('')
    setMulti(null)

    const res  = await fetch('/api/pull', { method: 'POST' })
    const data = await res.json()
    if (!res.ok) { setError(data.error); setPulling(false); return }

    setSingle(data)
    setGems(data.gemsRemaining)
    if (typeof data.pityCounter === 'number') setPity(data.pityCounter)
    // Prepend to local history
    setHistory(prev => [{
      name: data.character.name, rarity: data.character.rarity,
      imageUrl: data.character.image_url ?? null, isNew: data.isNew,
      pulledAt: new Date().toISOString(),
    }, ...prev].slice(0, 20))
    setPulling(false)
  }

  // ── Multi pull ──
  async function doMultiPull() {
    if (gems !== null && gems < 100) { setError('Not enough gems! Need 100 💎'); return }
    setPulling(true)
    setMulti(null)
    setSingle(null)
    setRevealed(false)
    setShowDetails(false)
    setError('')

    const res  = await fetch('/api/pull/multi', { method: 'POST' })
    const data = await res.json()
    if (!res.ok) { setError(data.error); setPulling(false); return }

    // Sort worst→best so best reveals last
    const sorted: MultiResult = {
      ...data,
      pulls: [...data.pulls].sort(
        (a: MultiPullEntry, b: MultiPullEntry) =>
          RARITY_ORDER[a.character.rarity] - RARITY_ORDER[b.character.rarity]
      ),
    }
    setMulti(sorted)
    setGems(data.gemsRemaining)
    if (typeof data.pityCounter === 'number') setPity(data.pityCounter)
    // Prepend all 10 to local history
    const entries: PullHistoryEntry[] = data.pulls.map((p: MultiPullEntry) => ({
      name: p.character.name, rarity: p.character.rarity,
      imageUrl: p.character.image_url ?? null, isNew: p.isNew,
      pulledAt: new Date().toISOString(),
    }))
    setHistory(prev => [...entries, ...prev].slice(0, 20))
    setPulling(false)
  }

  function skipMultiReveal() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (multi) setRevealedCount(multi.pulls.length)
    setAllRevealed(true)
  }

  function handleReveal() {
    if (revealed) return
    setRevealed(true)
    setTimeout(() => setShowDetails(true), 650)
  }

  function reset() {
    setSingle(null)
    setMulti(null)
    setRevealed(false)
    setShowDetails(false)
    setAllRevealed(false)
    setRevealedCount(0)
    setError('')
  }

  const singleStyle = single ? RARITY_STYLES[single.character.rarity] : null

  // Rarity summary for multi pull
  const raritySummary = multi
    ? (['legendary', 'epic', 'rare', 'common'] as const)
        .map(r => ({ rarity: r, count: multi.pulls.filter(p => p.character.rarity === r).length }))
        .filter(x => x.count > 0)
    : []

  const canSingle = !pulling && (gems === null || gems >= 10)
  const canMulti  = !pulling && (gems === null || gems >= 100)

  return (
    <main className="min-h-screen text-white pb-10" style={{
      background: 'radial-gradient(ellipse at 50% -10%, #1a0a40 0%, #06061a 55%)',
    }}>
      <div className="max-w-lg mx-auto px-4 pt-4">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="font-game text-gray-500 hover:text-gray-300 transition-colors text-sm">← Home</Link>
          <div className="flex items-center gap-1.5 rounded-full px-4 py-1.5" style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
          }}>
            <span className="font-game font-black text-yellow-400">{gems ?? '...'}</span>
            <span className="text-yellow-600 text-sm">💎</span>
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="font-game font-black text-3xl text-white mb-1">CHARACTER PULL</h1>
          <p className="font-game text-gray-600 text-xs tracking-widest">2% LEGENDARY · 8% EPIC · 30% RARE</p>
        </div>

        {/* ══════════════════════════════════════════════════
            SINGLE PULL REVEAL
        ══════════════════════════════════════════════════ */}
        {single && singleStyle && (
          <div className="flex flex-col items-center">
            <div className={!revealed ? 'card-waiting' : ''}>
              <div className="flip-container w-[220px] h-[320px] cursor-pointer" onClick={handleReveal}>
                <div className={`flip-inner w-full h-full ${revealed ? 'is-flipped' : ''}`}>

                  {/* Back */}
                  <div className="flip-face rounded-2xl border-2 border-gray-700 overflow-hidden bg-gray-900">
                    <div className="w-full h-full flex flex-col items-center justify-center relative">
                      <div className="absolute inset-0" style={{
                        backgroundImage: [
                          'repeating-linear-gradient(45deg,  rgba(255,255,255,0.04) 0, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 14px)',
                          'repeating-linear-gradient(-45deg, rgba(255,255,255,0.04) 0, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 14px)',
                        ].join(', '),
                      }} />
                      <span className="text-5xl mb-3 relative z-10 drop-shadow-lg">⚔️</span>
                      <p className="text-gray-600 text-[10px] font-black tracking-[0.2em] uppercase relative z-10">Anime Arena</p>
                    </div>
                  </div>

                  {/* Front */}
                  <div className={`flip-face flip-face-front rounded-2xl border-2 ${singleStyle.border} ${singleStyle.glow} ${singleStyle.shimmer} overflow-hidden relative`}>
                    {single.character.image_url ? (
                      <img src={single.character.image_url} alt={single.character.name} className="w-full h-full object-cover face-anchor" />
                    ) : (
                      <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                        <span className="text-6xl opacity-20">👤</span>
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/95 via-black/60 to-transparent flex flex-col justify-end p-3">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full self-start mb-1.5 ${singleStyle.badge}`}>{singleStyle.label}</span>
                      <p className="text-white font-black text-sm leading-tight drop-shadow">{single.character.name}</p>
                    </div>
                    <div className="absolute top-2.5 right-2.5">
                      {single.isNew
                        ? <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-green-500 text-white shadow-lg">NEW!</span>
                        : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/70 text-gray-300">×{single.totalCount}</span>
                      }
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {!revealed && <p className="tap-hint text-gray-400 text-sm font-semibold mt-5">👆 Tap card to reveal</p>}

            {showDetails && (
              <div className="details-in w-full max-w-xs mt-6">
                <p className="text-center text-gray-400 text-sm mb-4 font-game">{single.character.source_anime}</p>
                <div className="grid grid-cols-4 gap-2 mb-6">
                  {[
                    { label: 'HP',  value: single.character.base_hp,    color: 'text-red-400' },
                    { label: 'ATK', value: single.character.base_atk,   color: 'text-orange-400' },
                    { label: 'DEF', value: single.character.base_def,   color: 'text-blue-400' },
                    { label: 'SPD', value: single.character.base_speed, color: 'text-green-400' },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl p-2.5 text-center" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <p className="font-game text-gray-500 text-xs mb-1">{s.label}</p>
                      <p className={`font-black text-lg ${s.color}`}>{s.value}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button onClick={doPull} disabled={!canSingle} className="flex-1 font-game font-black rounded-xl py-3 transition-colors disabled:opacity-40" style={{ background: 'linear-gradient(135deg,#7c3aed,#4c1d95)', color: '#fff' }}>
                    Again (10 💎)
                  </button>
                  <button onClick={doMultiPull} disabled={!canMulti} className="flex-1 font-game font-black rounded-xl py-3 transition-colors disabled:opacity-40" style={{ background: 'linear-gradient(135deg,#5b21b6,#2e1065)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.4)' }}>
                    10× (100 💎)
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════
            MULTI PULL GRID
        ══════════════════════════════════════════════════ */}
        {multi && (
          <div>
            {/* Skip button */}
            {!allRevealed && (
              <div className="flex justify-end mb-3">
                <button onClick={skipMultiReveal} className="font-game text-xs text-gray-500 hover:text-white border border-gray-800 hover:border-gray-600 rounded-full px-3 py-1 transition-colors">
                  Skip →
                </button>
              </div>
            )}

            {/* 5×2 card grid */}
            <div className="grid grid-cols-5 gap-2 mb-5">
              {multi.pulls.map((entry, i) => {
                const isFlipped = i < revealedCount
                const s = RARITY_STYLES[entry.character.rarity]
                return (
                  <div key={i} className="flip-container" style={{ height: '110px' }}>
                    <div className={`flip-inner w-full h-full ${isFlipped ? 'is-flipped' : ''}`}>

                      {/* Back */}
                      <div className="flip-face rounded-lg border border-gray-800 overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-2xl opacity-40">⚔️</span>
                        </div>
                      </div>

                      {/* Front */}
                      <div className={`flip-face flip-face-front rounded-lg border-2 ${s.border} ${s.glow} overflow-hidden relative`}>
                        {entry.character.image_url ? (
                          <img src={entry.character.image_url} alt={entry.character.name} className="w-full h-full object-cover face-anchor" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.05)' }}>
                            <span className="text-2xl opacity-30">👤</span>
                          </div>
                        )}
                        {/* Rarity glow overlay at bottom */}
                        <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/80 to-transparent" />
                        {entry.isNew && (
                          <div className="absolute top-1 right-1 w-3 h-3 rounded-full bg-green-400 shadow-lg shadow-green-400/50" />
                        )}
                      </div>

                    </div>
                  </div>
                )
              })}
            </div>

            {/* Summary + buttons — slide in after all revealed */}
            {allRevealed && (
              <div className="details-in">
                {/* Rarity breakdown */}
                <div className="rounded-xl p-4 mb-4 flex flex-wrap justify-center gap-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {raritySummary.map(({ rarity, count }) => (
                    <div key={rarity} className="text-center">
                      <p className={`font-game font-black text-2xl ${RARITY_LABEL_COLOR[rarity]}`}>{count}</p>
                      <p className="font-game text-gray-500 text-[10px] capitalize">{rarity}</p>
                    </div>
                  ))}
                  {multi.pulls.filter(p => p.isNew).length > 0 && (
                    <div className="text-center">
                      <p className="font-game font-black text-2xl text-green-400">
                        {multi.pulls.filter(p => p.isNew).length}
                      </p>
                      <p className="font-game text-gray-500 text-[10px]">New!</p>
                    </div>
                  )}
                </div>

                {/* Character name list for rares+ */}
                {multi.pulls.filter(p => p.character.rarity !== 'common').length > 0 && (
                  <div className="mb-4 space-y-1.5">
                    {multi.pulls
                      .filter(p => p.character.rarity !== 'common')
                      .sort((a, b) => RARITY_ORDER[a.character.rarity] - RARITY_ORDER[b.character.rarity])
                      .map((p, i) => {
                        const s = RARITY_STYLES[p.character.rarity]
                        return (
                          <div key={i} className={`flex items-center gap-2 rounded-lg px-3 py-2 border ${s.border}`} style={{ background: 'rgba(255,255,255,0.03)' }}>
                            <span className={`font-game text-xs font-bold ${RARITY_LABEL_COLOR[p.character.rarity]}`}>{s.label}</span>
                            <span className="font-game text-white text-sm font-bold flex-1 truncate">{p.character.name}</span>
                            {p.isNew && <span className="font-game text-[9px] text-green-400 font-bold">NEW</span>}
                          </div>
                        )
                      })
                    }
                  </div>
                )}

                {/* Pull again buttons */}
                <div className="flex gap-3">
                  <button onClick={doMultiPull} disabled={!canMulti} className="flex-1 font-game font-black rounded-xl py-3 transition-all hover:scale-[1.02] disabled:opacity-40" style={{ background: 'linear-gradient(135deg,#7c3aed,#4c1d95)', color: '#fff', boxShadow: '0 0 24px rgba(124,58,237,0.3)' }}>
                    10× Again (100 💎)
                  </button>
                  <button onClick={doPull} disabled={!canSingle} className="flex-1 font-game font-bold rounded-xl py-3 transition-colors disabled:opacity-40" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#d1d5db' }}>
                    1× Pull
                  </button>
                </div>
                <Link href="/collection" onClick={reset} className="block text-center font-game text-gray-600 hover:text-gray-400 text-sm mt-3 transition-colors">
                  View Collection →
                </Link>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════
            IDLE STATE — no result yet
        ══════════════════════════════════════════════════ */}
        {!single && !multi && (
          <div className="flex flex-col items-center gap-4">

            {/* 10× pull — hero button */}
            <button
              onClick={doMultiPull}
              disabled={!canMulti}
              className="w-full font-game font-black text-xl rounded-2xl py-5 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: canMulti ? 'linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)' : 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(139,92,246,0.5)',
                boxShadow: canMulti ? '0 0 40px rgba(124,58,237,0.3)' : 'none',
                color: canMulti ? '#fff' : '#6b7280',
              }}
            >
              {pulling ? '✨ Pulling...' : '🎴 10× Pull (100 💎)'}
            </button>

            {/* Pity note */}
            <p className="font-game text-xs text-gray-700 -mt-1">Guaranteed Rare or better in every 10×</p>

            {/* 1× pull — secondary */}
            <button
              onClick={doPull}
              disabled={!canSingle}
              className="w-full font-game font-bold text-base rounded-2xl py-4 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(139,92,246,0.25)',
                color: canSingle ? '#c4b5fd' : '#6b7280',
              }}
            >
              {pulling ? '...' : '1× Pull (10 💎)'}
            </button>

            {gems !== null && gems < 10 && (
              <p className="font-game text-gray-500 text-sm text-center mt-2">
                Not enough gems.{' '}
                <Link href="/" className="text-yellow-400 hover:text-yellow-300 transition-colors">Claim daily bonus →</Link>
              </p>
            )}

            {/* ── Pity counter ── */}
            <div className="w-full rounded-xl p-3 mt-3" style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
            }}>
              <div className="flex justify-between font-game text-[10px] mb-1.5">
                <span className="text-gray-500 tracking-widest">LEGENDARY PITY</span>
                <span className={pity >= 80 ? 'text-yellow-400 font-bold' : 'text-gray-500'}>
                  {pity} / {HARD_PITY}
                </span>
              </div>
              <div className="w-full rounded-full h-1.5" style={{ background: 'rgba(255,255,255,0.07)' }}>
                <div
                  className="h-1.5 rounded-full transition-all"
                  style={{
                    width: `${Math.min((pity / HARD_PITY) * 100, 100)}%`,
                    background: pity >= 80
                      ? 'linear-gradient(90deg, #fbbf24, #facc15)'
                      : pity >= 50
                      ? 'linear-gradient(90deg, #8b5cf6, #a78bfa)'
                      : 'linear-gradient(90deg, #4b5563, #6b7280)',
                  }}
                />
              </div>
              <p className="font-game text-gray-700 text-[10px] mt-1.5 text-center">
                {pity >= HARD_PITY
                  ? '🌟 Next pull is a guaranteed Legendary!'
                  : `Guaranteed Legendary within ${HARD_PITY - pity} more pulls`}
              </p>
            </div>

            {/* ── Recent pulls toggle ── */}
            {history.length > 0 && (
              <button
                onClick={() => setShowHistory(s => !s)}
                className="font-game text-xs text-gray-600 hover:text-gray-400 mt-2 transition-colors"
              >
                {showHistory ? '↑ Hide' : '↓ Show'} recent pulls ({history.length})
              </button>
            )}

            {showHistory && history.length > 0 && (
              <div className="w-full rounded-xl p-3 mt-2" style={{
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
              }}>
                <div className="grid grid-cols-5 gap-1.5">
                  {history.map((h, i) => {
                    const borderColor = h.rarity === 'legendary' ? '#facc15'
                                      : h.rarity === 'epic'      ? '#8b5cf6'
                                      : h.rarity === 'rare'      ? '#3b82f6'
                                                                 : '#4b5563'
                    return (
                      <div key={i} className="relative rounded-lg overflow-hidden" style={{ height: '70px', border: `1.5px solid ${borderColor}` }}>
                        {h.imageUrl ? (
                          <img src={h.imageUrl} alt={h.name} className="w-full h-full object-cover face-anchor" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.05)' }}>
                            <span className="text-xl opacity-30">👤</span>
                          </div>
                        )}
                        {h.isNew && (
                          <div className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-green-400" />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {error && <p className="font-game text-red-400 text-center text-sm mt-4">{error}</p>}

      </div>
    </main>
  )
}
