'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { BattleResult } from '@/lib/game/battle'

type OwnedCharacter = {
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

type PvPResult = BattleResult & {
  gemsAwarded: number
  opponentName: string
  opponentCharacter: string
}

const RARITY_ORDER = { legendary: 0, epic: 1, rare: 2, common: 3 }
const RARITY_BORDER = {
  common:    'border-gray-600',
  rare:      'border-blue-500',
  epic:      'border-violet-500',
  legendary: 'border-yellow-400',
}

type Phase = 'selecting' | 'fighting'

export default function PvPPage() {
  const [owned, setOwned]               = useState<OwnedCharacter[]>([])
  const [pvpRecord, setPvpRecord]       = useState({ wins: 0, battles: 0 })
  const [selected, setSelected]         = useState<OwnedCharacter | null>(null)
  const [phase, setPhase]               = useState<Phase>('selecting')
  const [fighting, setFighting]         = useState(false)
  const [result, setResult]             = useState<PvPResult | null>(null)
  const [displayedLog, setDisplayedLog] = useState<BattleResult['log']>([])
  const [showResult, setShowResult]     = useState(false)
  const intervalRef                     = useRef<ReturnType<typeof setInterval> | null>(null)
  const logRef                          = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const [{ data: cards }, { data: profile }] = await Promise.all([
        supabase
          .from('user_characters')
          .select('character:characters(id, name, source_anime, rarity, base_hp, base_atk, base_def, base_speed)')
          .eq('user_id', user.id),
        supabase
          .from('profiles')
          .select('pvp_wins, pvp_battles')
          .eq('user_id', user.id)
          .single(),
      ])

      if (cards) {
        setOwned(
          (cards as unknown as OwnedCharacter[]).sort(
            (a, b) => RARITY_ORDER[a.character.rarity] - RARITY_ORDER[b.character.rarity]
          )
        )
      }
      if (profile) {
        setPvpRecord({ wins: profile.pvp_wins ?? 0, battles: profile.pvp_battles ?? 0 })
      }
    }
    load()
  }, [])

  // Animate log entries one by one
  useEffect(() => {
    if (!result) return
    setDisplayedLog([])
    setShowResult(false)

    let i = 0
    intervalRef.current = setInterval(() => {
      if (i < result.log.length) {
        setDisplayedLog(prev => [...prev, result.log[i]])
        i++
        setTimeout(() => {
          if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
        }, 50)
      } else {
        if (intervalRef.current) clearInterval(intervalRef.current)
        setShowResult(true)
      }
    }, 1200)

    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [result])

  function skipAnimation() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (result) setDisplayedLog(result.log)
    setShowResult(true)
    setTimeout(() => {
      if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
    }, 50)
  }

  async function startFight() {
    if (!selected) return
    setFighting(true)

    const res = await fetch('/api/battle/pvp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterId: selected.character.id }),
    })
    const data = await res.json()
    setFighting(false)

    if (!res.ok) {
      alert(data.error ?? 'Something went wrong')
      return
    }

    setResult(data)
    setPhase('fighting')
    // Update local record optimistically
    setPvpRecord(prev => ({
      wins:    prev.wins    + (data.winner === 'player' ? 1 : 0),
      battles: prev.battles + 1,
    }))
  }

  function resetFight() {
    setPhase('selecting')
    setResult(null)
    setDisplayedLog([])
    setShowResult(false)
    setSelected(null)
  }

  const currentEntry = displayedLog[displayedLog.length - 1]
  const playerHpPct  = result ? Math.max(0, ((currentEntry?.playerHp ?? result.playerMaxHp) / result.playerMaxHp) * 100) : 100
  const enemyHpPct   = result ? Math.max(0, ((currentEntry?.enemyHp  ?? result.enemyMaxHp)  / result.enemyMaxHp)  * 100) : 100
  const winRate      = pvpRecord.battles > 0 ? Math.round((pvpRecord.wins / pvpRecord.battles) * 100) : 0

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-lg mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="text-gray-500 hover:text-gray-300 transition-colors">← Home</Link>
          <h1 className="text-xl font-black">⚔️ PvP</h1>
          <div className="w-16" />
        </div>

        {/* PvP record */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Wins',     value: pvpRecord.wins },
            { label: 'Battles',  value: pvpRecord.battles },
            { label: 'Win Rate', value: `${winRate}%` },
          ].map(stat => (
            <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-white">{stat.value}</p>
              <p className="text-gray-500 text-xs mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* ── SELECTING ── */}
        {phase === 'selecting' && (
          <>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-5">
              <p className="text-gray-500 text-sm mb-1">You face:</p>
              <p className="text-violet-300 font-black text-xl">??? — a random player's best card</p>
              <p className="text-gray-600 text-xs mt-1">Win → +15 💎 · Lose → no loss</p>
            </div>

            <p className="text-white font-bold mb-3">Choose your fighter:</p>

            {owned.length === 0 ? (
              <div className="text-center py-12 bg-gray-900 border border-gray-800 rounded-2xl">
                <p className="text-5xl mb-3">🎴</p>
                <p className="text-gray-400 mb-4">You have no characters yet!</p>
                <Link href="/pull" className="bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-xl px-6 py-3 transition-colors">
                  Pull some cards first →
                </Link>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2 mb-4 max-h-64 overflow-y-auto pr-1">
                  {owned.map(o => (
                    <button
                      key={o.character.id}
                      onClick={() => setSelected(o)}
                      className={`rounded-xl p-2.5 border-2 text-left transition-all ${
                        selected?.character.id === o.character.id
                          ? 'border-white bg-gray-700 scale-[1.03] shadow-lg shadow-white/10'
                          : `${RARITY_BORDER[o.character.rarity]} bg-gray-900 hover:bg-gray-800`
                      }`}
                    >
                      <div className="text-2xl text-center mb-1">🎴</div>
                      <p className="text-white text-xs font-bold leading-tight truncate">{o.character.name}</p>
                      <p className="text-gray-500 text-xs">{o.character.base_hp} HP</p>
                    </button>
                  ))}
                </div>

                {selected && (
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 mb-4">
                    <p className="text-white font-bold text-sm mb-2">{selected.character.name}</p>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: 'HP',  value: selected.character.base_hp,    color: 'text-red-400' },
                        { label: 'ATK', value: selected.character.base_atk,   color: 'text-orange-400' },
                        { label: 'DEF', value: selected.character.base_def,   color: 'text-blue-400' },
                        { label: 'SPD', value: selected.character.base_speed, color: 'text-green-400' },
                      ].map(s => (
                        <div key={s.label} className="bg-gray-800 rounded-lg p-2 text-center">
                          <p className="text-gray-500 text-xs">{s.label}</p>
                          <p className={`font-black ${s.color}`}>{s.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={startFight}
                  disabled={!selected || fighting}
                  className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-xl rounded-2xl py-4 transition-all hover:scale-[1.01] active:scale-[0.99]"
                >
                  {fighting
                    ? '⚔️ Finding opponent...'
                    : selected
                    ? `⚔️ Fight with ${selected.character.name}!`
                    : 'Select a character above'}
                </button>
              </>
            )}
          </>
        )}

        {/* ── FIGHTING ── */}
        {phase === 'fighting' && result && (
          <>
            {/* Opponent banner */}
            <div className="bg-violet-950 border border-violet-700 rounded-2xl p-3 mb-4 text-center">
              <p className="text-violet-300 text-sm">
                vs <span className="font-black text-white">{result.opponentName}</span>
                {' '}· {result.opponentCharacter}
              </p>
            </div>

            {/* HP Bars */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-4">
              <div className="mb-4">
                <div className="flex justify-between mb-1.5">
                  <span className="text-white font-bold text-sm">👤 {result.playerName}</span>
                  <span className="text-gray-400 text-xs font-mono">
                    {currentEntry?.playerHp ?? result.playerMaxHp} / {result.playerMaxHp}
                  </span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-4 overflow-hidden">
                  <div
                    className="bg-green-500 h-4 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${playerHpPct}%` }}
                  />
                </div>
              </div>

              <p className="text-center text-gray-600 text-xs font-bold">⚔️ VS ⚔️</p>

              <div className="mt-4">
                <div className="flex justify-between mb-1.5">
                  <span className="text-white font-bold text-sm">🎮 {result.enemyName}</span>
                  <span className="text-gray-400 text-xs font-mono">
                    {currentEntry?.enemyHp ?? result.enemyMaxHp} / {result.enemyMaxHp}
                  </span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-4 overflow-hidden">
                  <div
                    className="bg-violet-500 h-4 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${enemyHpPct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Battle Log */}
            <div className="flex items-center justify-between mb-2">
              <p className="text-gray-500 text-xs">Battle log</p>
              {!showResult && (
                <button
                  onClick={skipAnimation}
                  className="text-xs text-gray-500 hover:text-white border border-gray-700 hover:border-gray-500 rounded-full px-3 py-1 transition-colors"
                >
                  Skip →
                </button>
              )}
            </div>
            <div
              ref={logRef}
              className="bg-gray-900 border border-gray-800 rounded-2xl p-4 h-48 overflow-y-auto mb-4 space-y-1.5"
            >
              {displayedLog.map((entry, i) => (
                <p key={i} className="text-sm text-gray-300 leading-relaxed">{entry.message}</p>
              ))}
              {!showResult && <p className="text-gray-600 text-sm animate-pulse">...</p>}
            </div>

            {/* Result */}
            {showResult && (
              <div className={`rounded-2xl p-5 border text-center ${
                result.winner === 'player'
                  ? 'bg-green-950 border-green-700'
                  : 'bg-red-950 border-red-700'
              }`}>
                <p className={`text-3xl font-black mb-1 ${
                  result.winner === 'player' ? 'text-green-400' : 'text-red-400'
                }`}>
                  {result.winner === 'player' ? '🏆 Victory!' : '💀 Defeated!'}
                </p>
                <p className="text-gray-400 text-sm mb-1">
                  vs {result.opponentName} · {result.opponentCharacter}
                </p>
                {result.gemsAwarded > 0 && (
                  <p className="text-yellow-400 font-bold text-lg mb-1">+{result.gemsAwarded} 💎</p>
                )}
                <p className="text-gray-500 text-xs mt-1">
                  Record: {pvpRecord.wins}W / {pvpRecord.battles}B ({winRate}%)
                </p>

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={resetFight}
                    className="flex-1 bg-violet-700 hover:bg-violet-600 text-white font-bold rounded-xl py-3 transition-colors text-sm"
                  >
                    Fight Again
                  </button>
                  <Link
                    href="/leaderboard"
                    className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-xl py-3 text-center transition-colors text-sm"
                  >
                    Leaderboard →
                  </Link>
                </div>
              </div>
            )}
          </>
        )}

      </div>
    </main>
  )
}
