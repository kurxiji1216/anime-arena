'use client'

import { Suspense, useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { getArc, getStage } from '@/lib/game/campaign'
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

type FullResult = BattleResult & {
  gemsAwarded: number
  isNewClear?: boolean
  newFloor?: number
  bestFloor?: number
  floorCleared?: number
}

const RARITY_ORDER = { legendary: 0, epic: 1, rare: 2, common: 3 }
const RARITY_BORDER = {
  common: 'border-gray-600',
  rare: 'border-blue-500',
  epic: 'border-violet-500',
  legendary: 'border-yellow-400',
}

type Phase = 'selecting' | 'fighting' | 'result'

function FightContent() {
  const searchParams = useSearchParams()
  const mode = searchParams.get('mode') ?? 'campaign'
  const arcNum = parseInt(searchParams.get('arc') ?? '1')
  const stageNum = parseInt(searchParams.get('stage') ?? '1')

  const arc = mode === 'campaign' ? getArc(arcNum) : null
  const stage = mode === 'campaign' ? getStage(arcNum, stageNum) : null

  const [owned, setOwned] = useState<OwnedCharacter[]>([])
  const [selected, setSelected] = useState<OwnedCharacter | null>(null)
  const [phase, setPhase] = useState<Phase>('selecting')
  const [fighting, setFighting] = useState(false)
  const [result, setResult] = useState<FullResult | null>(null)
  const [displayedLog, setDisplayedLog] = useState<BattleResult['log']>([])
  const [showResult, setShowResult] = useState(false)
  const [skipped, setSkipped] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [towerFloor, setTowerFloor] = useState(1)
  const logRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: cards } = await supabase
        .from('user_characters')
        .select('character:characters(id, name, source_anime, rarity, base_hp, base_atk, base_def, base_speed)')
        .eq('user_id', user.id)

      if (cards) {
        setOwned(
          (cards as unknown as OwnedCharacter[]).sort(
            (a, b) => RARITY_ORDER[a.character.rarity] - RARITY_ORDER[b.character.rarity]
          )
        )
      }

      if (mode === 'tower') {
        const { data: profile } = await supabase
          .from('profiles')
          .select('tower_floor')
          .eq('user_id', user.id)
          .single()
        if (profile) setTowerFloor(profile.tower_floor ?? 1)
      }
    }
    load()
  }, [])

  // Animate log entries one by one
  useEffect(() => {
    if (!result) return
    setDisplayedLog([])
    setShowResult(false)
    setSkipped(false)

    let i = 0
    intervalRef.current = setInterval(() => {
      if (i < result.log.length) {
        const entry = result.log[i]
        setDisplayedLog(prev => [...prev, entry])
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
    setSkipped(true)
    setTimeout(() => {
      if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
    }, 50)
  }

  async function startFight() {
    if (!selected) return
    setFighting(true)

    const body = mode === 'campaign'
      ? { characterId: selected.character.id, arc: arcNum, stage: stageNum }
      : { characterId: selected.character.id }

    const endpoint = mode === 'campaign' ? '/api/battle/campaign' : '/api/battle/tower'

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    setFighting(false)

    if (!res.ok) {
      alert(data.error ?? 'Something went wrong')
      return
    }

    setResult(data)
    setPhase('fighting')
  }

  function resetFight() {
    setPhase('selecting')
    setResult(null)
    setDisplayedLog([])
    setShowResult(false)
    setSelected(null)
  }

  const currentEntry = displayedLog[displayedLog.length - 1]
  const playerHpPct = result
    ? Math.max(0, ((currentEntry?.playerHp ?? result.playerMaxHp) / result.playerMaxHp) * 100)
    : 100
  const enemyHpPct = result
    ? Math.max(0, ((currentEntry?.enemyHp ?? result.enemyMaxHp) / result.enemyMaxHp) * 100)
    : 100

  const backHref = mode === 'campaign' ? `/battle/campaign/${arcNum}` : '/battle'

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-lg mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link href={backHref} className="text-gray-500 hover:text-gray-300 transition-colors">← Back</Link>
          <div className="text-center">
            {mode === 'campaign' && arc && (
              <>
                <p className="text-white font-black text-sm">{arc.emoji} {arc.name}</p>
                <p className="text-gray-500 text-xs">Stage {stageNum} of 5</p>
              </>
            )}
            {mode === 'tower' && (
              <>
                <p className="text-white font-black text-sm">🗼 Infinite Tower</p>
                <p className="text-orange-400 text-xs font-bold">Floor {towerFloor}</p>
              </>
            )}
          </div>
          <div className="w-16" />
        </div>

        {/* ── SELECTING ── */}
        {phase === 'selecting' && (
          <>
            {/* Enemy preview */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-5">
              <p className="text-gray-500 text-sm mb-1">You face:</p>
              {mode === 'campaign' && stage
                ? <p className="text-violet-300 font-black text-xl">{stage.enemyName}</p>
                : <p className="text-orange-300 font-black text-xl">??? — random enemy awaits</p>
              }
              {mode === 'tower' && (
                <p className="text-gray-500 text-xs mt-1">Enemies grow stronger every floor (+4% stats each floor)</p>
              )}
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
                {/* Character grid */}
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

                {/* Selected character stats */}
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
                  className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-xl rounded-2xl py-4 transition-all hover:scale-[1.01] active:scale-[0.99]"
                >
                  {fighting
                    ? '⚔️ Fighting...'
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
            {/* HP Bars */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-4">
              {/* Player HP */}
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

              {/* Enemy HP */}
              <div className="mt-4">
                <div className="flex justify-between mb-1.5">
                  <span className="text-white font-bold text-sm">⚡ {result.enemyName}</span>
                  <span className="text-gray-400 text-xs font-mono">
                    {currentEntry?.enemyHp ?? result.enemyMaxHp} / {result.enemyMaxHp}
                  </span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-4 overflow-hidden">
                  <div
                    className="bg-red-500 h-4 rounded-full transition-all duration-500 ease-out"
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

            {/* Result panel */}
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

                {result.gemsAwarded > 0 && (
                  <p className="text-yellow-400 font-bold text-lg mb-1">+{result.gemsAwarded} 💎</p>
                )}
                {result.isNewClear && (
                  <p className="text-green-300 text-sm mb-1">⭐ Stage cleared for the first time!</p>
                )}
                {mode === 'tower' && result.winner === 'player' && result.newFloor && (
                  <p className="text-orange-300 text-sm mb-1">Advanced to Floor {result.newFloor}!</p>
                )}
                {mode === 'tower' && result.winner === 'enemy' && (
                  <p className="text-red-300 text-sm mb-1">Tower resets to Floor 1</p>
                )}

                <div className="flex gap-2 mt-4">
                  {/* Campaign: next stage button */}
                  {result.winner === 'player' && mode === 'campaign' && stageNum < 5 && (
                    <Link
                      href={`/battle/fight?mode=campaign&arc=${arcNum}&stage=${stageNum + 1}`}
                      onClick={resetFight}
                      className="flex-1 bg-green-700 hover:bg-green-600 text-white font-bold rounded-xl py-3 text-center transition-colors text-sm"
                    >
                      Next Stage →
                    </Link>
                  )}
                  {/* Campaign: finished arc */}
                  {result.winner === 'player' && mode === 'campaign' && stageNum === 5 && (
                    <Link
                      href={arcNum < 20 ? `/battle/campaign/${arcNum + 1}` : '/battle/campaign'}
                      className="flex-1 bg-green-700 hover:bg-green-600 text-white font-bold rounded-xl py-3 text-center transition-colors text-sm"
                    >
                      {arcNum < 20 ? 'Next Arc →' : '🏆 All Done!'}
                    </Link>
                  )}
                  {/* Fight again */}
                  <button
                    onClick={resetFight}
                    className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-xl py-3 transition-colors text-sm"
                  >
                    {result.winner === 'player' ? 'Again' : 'Retry'}
                  </button>
                  {/* Back */}
                  <Link
                    href={backHref}
                    className="flex-1 bg-gray-900 border border-gray-700 hover:bg-gray-800 text-white font-bold rounded-xl py-3 text-center transition-colors text-sm"
                  >
                    Back
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

export default function FightPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-500 animate-pulse">Loading...</div>
      </main>
    }>
      <FightContent />
    </Suspense>
  )
}
