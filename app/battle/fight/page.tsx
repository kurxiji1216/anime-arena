'use client'

import { Suspense, useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { getArc, getStage } from '@/lib/game/campaign'
import { calcEffectiveStats, xpToNextLevel } from '@/lib/game/stats'
import { getHunterRank, playerXpToLevel } from '@/lib/game/player'
import type { BattleResult } from '@/lib/game/battle'

// ─── Types ────────────────────────────────────────────────────────────────────

type OwnedCharacter = {
  level: number
  stars: number
  xp: number
  character: {
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
}

type FullResult = BattleResult & {
  gemsAwarded: number
  isNewClear?: boolean
  newFloor?: number
  bestFloor?: number
  floorCleared?: number
  xpGained?: number
  levelsGained?: number
  milestoneGems?: number
  playerXpGained?: number
  newPlayerRank?: string | null
  enemyImageUrl?: string | null
}

type Phase = 'selecting' | 'fighting'

// ─── Constants ────────────────────────────────────────────────────────────────

const RARITY_ORDER = { legendary: 0, epic: 1, rare: 2, common: 3 }

const RARITY_STYLES = {
  common:    { border: 'border-gray-700',   glow: '',               accent: '#9ca3af' },
  rare:      { border: 'border-blue-500',   glow: 'glow-rare',      accent: '#3b82f6' },
  epic:      { border: 'border-violet-500', glow: 'glow-epic',      accent: '#8b5cf6' },
  legendary: { border: 'border-yellow-400', glow: 'glow-legendary', accent: '#facc15' },
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StarDisplay({ stars }: { stars: number }) {
  return (
    <span className="text-yellow-400 text-[10px]">
      {'★'.repeat(stars)}{'☆'.repeat(5 - stars)}
    </span>
  )
}

function Portrait({
  imageUrl,
  name,
  fallbackIcon,
  flipped = false,
  glowColor,
  isAttacking,
  flashKey,
}: {
  imageUrl: string | null
  name: string
  fallbackIcon: string
  flipped?: boolean
  glowColor: string
  isAttacking: boolean
  flashKey: number
}) {
  return (
    <div className="relative w-full h-36 rounded-xl overflow-hidden" style={{
      transform: flipped ? 'scaleX(-1)' : undefined,
      transition: 'filter 0.15s ease-out',
      filter: isAttacking ? `brightness(1.5) drop-shadow(0 0 14px ${glowColor})` : 'brightness(1)',
    }}>
      {imageUrl ? (
        <img src={imageUrl} alt={name} className="w-full h-full object-cover object-top" />
      ) : (
        <div className="w-full h-full flex items-center justify-center" style={{
          background: 'linear-gradient(180deg, #1a1a2e 0%, #0d0d1a 100%)',
        }}>
          <span className="text-5xl opacity-40">{fallbackIcon}</span>
        </div>
      )}
      {/* Attack flash overlay — key forces re-mount every hit */}
      {isAttacking && (
        <div
          key={flashKey}
          className="absolute inset-0 battle-attack-flash-anim rounded-xl"
          style={{ background: `${glowColor}33` }}
        />
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

function FightContent() {
  const searchParams = useSearchParams()
  const mode     = searchParams.get('mode') ?? 'campaign'
  const arcNum   = parseInt(searchParams.get('arc')   ?? '1')
  const stageNum = parseInt(searchParams.get('stage') ?? '1')

  const arc   = mode === 'campaign' ? getArc(arcNum)          : null
  const stage = mode === 'campaign' ? getStage(arcNum, stageNum) : null

  // ── Core state ──
  const [owned,       setOwned]       = useState<OwnedCharacter[]>([])
  const [selected,    setSelected]    = useState<OwnedCharacter | null>(null)
  const [phase,       setPhase]       = useState<Phase>('selecting')
  const [fighting,    setFighting]    = useState(false)
  const [result,      setResult]      = useState<FullResult | null>(null)
  const [displayedLog, setDisplayedLog] = useState<BattleResult['log']>([])
  const [showResult,  setShowResult]  = useState(false)
  const [showXpBars,  setShowXpBars]  = useState(false)
  const [towerFloor,  setTowerFloor]  = useState(1)

  // ── Player account state ──
  const [playerLevel, setPlayerLevel] = useState(1)
  const [playerXp,    setPlayerXp]    = useState(0)

  // ── Pre-battle snapshots for XP bar animation ──
  const [preCharXp,     setPreCharXp]     = useState(0)
  const [preCharLevel,  setPreCharLevel]  = useState(1)
  const [prePlayerXp,   setPrePlayerXp]   = useState(0)
  const [prePlayerLevel, setPrePlayerLevel] = useState(1)

  // ── Battle animation state ──
  const [attackerSide,  setAttackerSide]  = useState<'player' | 'enemy' | null>(null)
  const [playerFlashKey, setPlayerFlashKey] = useState(0)
  const [enemyFlashKey,  setEnemyFlashKey]  = useState(0)
  const [floatingDmg,   setFloatingDmg]   = useState<{ id: number; val: number; side: 'player' | 'enemy' } | null>(null)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const logRef      = useRef<HTMLDivElement>(null)
  const router      = useRouter()
  const supabase    = createClient()

  // ── Load owned characters + profile ──
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const [cardsRes, profileRes] = await Promise.all([
        supabase
          .from('user_characters')
          .select('level, stars, xp, character:characters(id, name, source_anime, rarity, image_url, base_hp, base_atk, base_def, base_speed)')
          .eq('user_id', user.id),
        supabase.from('profiles').select('tower_floor, player_level, player_xp').eq('user_id', user.id).single(),
      ])

      if (cardsRes.data) {
        setOwned(
          (cardsRes.data as unknown as OwnedCharacter[]).sort(
            (a, b) => RARITY_ORDER[a.character.rarity] - RARITY_ORDER[b.character.rarity]
          )
        )
      }
      if (profileRes.data) {
        if (mode === 'tower') setTowerFloor(profileRes.data.tower_floor ?? 1)
        setPlayerLevel(profileRes.data.player_level ?? 1)
        setPlayerXp(profileRes.data.player_xp    ?? 0)
      }
    }
    load()
  }, [])

  // ── Battle log animation — drives all visual effects ──
  useEffect(() => {
    if (!result) return
    setDisplayedLog([])
    setShowResult(false)
    setShowXpBars(false)
    setAttackerSide(null)
    setFloatingDmg(null)

    let i = 0
    intervalRef.current = setInterval(() => {
      if (i < result.log.length) {
        const entry = result.log[i]
        const prev  = i > 0 ? result.log[i - 1] : null

        // Detect who attacked by HP delta
        if (prev) {
          if (entry.enemyHp < prev.enemyHp) {
            const dmg = prev.enemyHp - entry.enemyHp
            setAttackerSide('player')
            setEnemyFlashKey(k => k + 1)
            setFloatingDmg({ id: Date.now(), val: dmg, side: 'enemy' })
            setTimeout(() => { setAttackerSide(null); setFloatingDmg(null) }, 700)
          } else if (entry.playerHp < prev.playerHp) {
            const dmg = prev.playerHp - entry.playerHp
            setAttackerSide('enemy')
            setPlayerFlashKey(k => k + 1)
            setFloatingDmg({ id: Date.now(), val: dmg, side: 'player' })
            setTimeout(() => { setAttackerSide(null); setFloatingDmg(null) }, 700)
          }
        }

        setDisplayedLog(prev => [...prev, entry])
        i++
        setTimeout(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight }, 50)
      } else {
        if (intervalRef.current) clearInterval(intervalRef.current)
        setShowResult(true)
        setTimeout(() => setShowXpBars(true), 500)
      }
    }, 1200)

    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [result])

  function skipAnimation() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (result) setDisplayedLog(result.log)
    setAttackerSide(null)
    setFloatingDmg(null)
    setShowResult(true)
    setTimeout(() => {
      if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
      setShowXpBars(true)
    }, 50)
  }

  async function startFight() {
    if (!selected) return
    setFighting(true)

    // Snapshot pre-battle values for XP bar animation
    setPreCharXp(selected.xp ?? 0)
    setPreCharLevel(selected.level ?? 1)
    setPrePlayerXp(playerXp)
    setPrePlayerLevel(playerLevel)

    const body     = mode === 'campaign'
      ? { characterId: selected.character.id, arc: arcNum, stage: stageNum }
      : { characterId: selected.character.id }
    const endpoint = mode === 'campaign' ? '/api/battle/campaign' : '/api/battle/tower'

    const res  = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json()
    setFighting(false)

    if (!res.ok) { alert(data.error ?? 'Something went wrong'); return }

    setResult(data)
    setPhase('fighting')
  }

  function resetFight() {
    setPhase('selecting')
    setResult(null)
    setDisplayedLog([])
    setShowResult(false)
    setShowXpBars(false)
    setSelected(null)
    setAttackerSide(null)
    setFloatingDmg(null)
  }

  // ── Derived values ──
  const currentEntry = displayedLog[displayedLog.length - 1]
  const playerHpPct  = result ? Math.max(0, ((currentEntry?.playerHp ?? result.playerMaxHp) / result.playerMaxHp) * 100) : 100
  const enemyHpPct   = result ? Math.max(0, ((currentEntry?.enemyHp  ?? result.enemyMaxHp)  / result.enemyMaxHp)  * 100) : 100
  const backHref     = mode === 'campaign' ? `/battle/campaign/${arcNum}` : '/battle'

  // XP bar calculations for results screen
  const charXpNeeded   = xpToNextLevel(preCharLevel)
  const charXpPct      = Math.min(((result?.xpGained  ?? 0) / charXpNeeded)  * 100, 100)
  const playerXpNeeded = playerXpToLevel(prePlayerLevel)
  const playerXpPct    = Math.min(((result?.playerXpGained ?? 0) / playerXpNeeded) * 100, 100)

  // ── Render ──
  return (
    <main className="min-h-screen text-white pb-8" style={{
      background: 'radial-gradient(ellipse at 50% -5%, #1a0a30 0%, #06040f 65%)',
    }}>
      <div className="max-w-lg mx-auto px-4 pt-4">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <Link href={backHref} className="font-game text-gray-500 hover:text-gray-300 transition-colors text-sm">← Back</Link>
          <div className="text-center">
            {mode === 'campaign' && arc && (
              <>
                <p className="font-game font-bold text-sm text-white">{arc.emoji} {arc.name}</p>
                <p className="font-game text-gray-500 text-xs">Stage {stageNum} of 5</p>
              </>
            )}
            {mode === 'tower' && (
              <>
                <p className="font-game font-bold text-sm text-white">🗼 Infinite Tower</p>
                <p className="font-game text-orange-400 text-xs font-bold">Floor {towerFloor}</p>
              </>
            )}
          </div>
          <div className="w-16" />
        </div>

        {/* ══════════════════════════════════════════════════════
            PHASE 1 — CHARACTER SELECTION
        ══════════════════════════════════════════════════════ */}
        {phase === 'selecting' && (
          <>
            {/* Enemy preview */}
            <div className="relative rounded-2xl overflow-hidden mb-5 p-4" style={{
              background: 'linear-gradient(135deg, #2d0808, #1a0303)',
              border: '1px solid rgba(239,68,68,0.3)',
            }}>
              <div className="absolute inset-0 pointer-events-none" style={{
                background: 'radial-gradient(ellipse at 30% 50%, rgba(239,68,68,0.18) 0%, transparent 65%)',
              }} />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-6xl opacity-10 select-none">⚡</div>
              <p className="font-game text-red-500 text-[10px] tracking-widest mb-1 relative z-10">YOU FACE</p>
              {mode === 'campaign' && stage
                ? <p className="font-game font-black text-2xl text-white relative z-10">{stage.enemyName}</p>
                : <p className="font-game font-black text-2xl text-orange-300 relative z-10">??? Unknown Enemy</p>
              }
              {mode === 'tower' && (
                <p className="font-game text-gray-600 text-xs mt-1 relative z-10">+4% stronger per floor · Floor {towerFloor}</p>
              )}
            </div>

            <p className="font-game text-gray-600 text-[10px] tracking-widest mb-3">CHOOSE YOUR FIGHTER</p>

            {owned.length === 0 ? (
              <div className="text-center py-12 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-5xl mb-3">🎴</p>
                <p className="text-gray-400 mb-4 font-game text-sm">No characters yet!</p>
                <Link href="/pull" className="bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-xl px-6 py-3 transition-colors font-game text-sm">
                  Pull some cards →
                </Link>
              </div>
            ) : (
              <>
                {/* Character grid */}
                <div className="grid grid-cols-3 gap-2 mb-4 max-h-72 overflow-y-auto pr-1">
                  {owned.map(o => {
                    const style      = RARITY_STYLES[o.character.rarity]
                    const isSelected = selected?.character.id === o.character.id
                    return (
                      <button
                        key={o.character.id}
                        onClick={() => setSelected(o)}
                        className={`relative overflow-hidden rounded-xl border-2 text-left transition-all duration-200 ${
                          isSelected
                            ? `${style.border} ${style.glow} scale-[1.05]`
                            : 'border-gray-800 hover:border-gray-700 hover:scale-[1.02]'
                        }`}
                        style={{ background: isSelected ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)' }}
                      >
                        <div className="w-full h-20 overflow-hidden bg-gray-900">
                          {o.character.image_url ? (
                            <img src={o.character.image_url} alt={o.character.name} className="w-full h-full object-cover object-top" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <span className="text-3xl opacity-25">👤</span>
                            </div>
                          )}
                        </div>
                        <div className="p-2">
                          <p className="text-white text-xs font-bold leading-tight truncate">{o.character.name}</p>
                          <div className="flex items-center justify-between mt-0.5">
                            <span className="font-game text-[9px] text-gray-500">Lv.{o.level ?? 1}</span>
                            <StarDisplay stars={o.stars ?? 1} />
                          </div>
                        </div>
                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-white flex items-center justify-center">
                            <span className="text-black text-[8px] font-black">✓</span>
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* Selected character stat panel */}
                {selected && (() => {
                  const eff   = calcEffectiveStats(selected.character, selected.level ?? 1, selected.stars ?? 1)
                  const style = RARITY_STYLES[selected.character.rarity]
                  return (
                    <div className={`rounded-xl p-3 mb-4 border ${style.border}`} style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <div className="flex items-center gap-3 mb-2.5">
                        {selected.character.image_url && (
                          <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 border" style={{ borderColor: style.accent }}>
                            <img src={selected.character.image_url} alt={selected.character.name} className="w-full h-full object-cover object-top" />
                          </div>
                        )}
                        <div>
                          <p className="text-white font-bold text-sm">{selected.character.name}</p>
                          <div className="flex items-center gap-2">
                            <span className="font-game text-xs" style={{ color: style.accent }}>Lv.{selected.level ?? 1}</span>
                            <StarDisplay stars={selected.stars ?? 1} />
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[
                          { label: 'HP',  value: eff.hp,    color: '#f87171' },
                          { label: 'ATK', value: eff.atk,   color: '#fb923c' },
                          { label: 'DEF', value: eff.def,   color: '#60a5fa' },
                          { label: 'SPD', value: eff.speed, color: '#4ade80' },
                        ].map(s => (
                          <div key={s.label} className="rounded-lg p-2 text-center" style={{ background: 'rgba(255,255,255,0.05)' }}>
                            <p className="font-game text-gray-500 text-[10px]">{s.label}</p>
                            <p className="font-black text-sm" style={{ color: s.color }}>{s.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}

                {/* Fight button */}
                <button
                  onClick={startFight}
                  disabled={!selected || fighting}
                  className="w-full font-game font-black text-xl rounded-2xl py-4 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: selected && !fighting ? 'linear-gradient(135deg, #dc2626 0%, #7f1d1d 100%)' : 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(239,68,68,0.4)',
                    color: selected ? '#fff' : '#6b7280',
                    boxShadow: selected && !fighting ? '0 0 30px rgba(239,68,68,0.25)' : 'none',
                  }}
                >
                  {fighting ? '⚔️  Fighting...' : selected ? '⚔️  FIGHT!' : 'Select a fighter above'}
                </button>
              </>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════════
            PHASE 2 — BATTLE ARENA + RESULT
        ══════════════════════════════════════════════════════ */}
        {phase === 'fighting' && result && (
          <>
            {/* ── Arena ── */}
            <div className="rounded-2xl overflow-hidden mb-3" style={{
              background: 'linear-gradient(180deg, #0c0020 0%, #180530 100%)',
              border: '1px solid rgba(139,92,246,0.2)',
            }}>
              {/* Portraits */}
              <div className="grid grid-cols-2 gap-px relative p-3 pb-1">

                {/* Player side */}
                <div className="relative pr-3">
                  <Portrait
                    imageUrl={selected?.character.image_url ?? null}
                    name={result.playerName}
                    fallbackIcon="👤"
                    flipped={false}
                    glowColor="#6366f1"
                    isAttacking={attackerSide === 'player'}
                    flashKey={enemyFlashKey}
                  />
                  {/* Damage number */}
                  {floatingDmg?.side === 'player' && (
                    <div
                      key={floatingDmg.id}
                      className="absolute top-3 left-1/2 font-game font-black text-2xl text-red-400 battle-float-dmg pointer-events-none z-20"
                      style={{ textShadow: '0 0 10px rgba(239,68,68,0.9)' }}
                    >
                      −{floatingDmg.val}
                    </div>
                  )}
                  <p className="font-game font-bold text-xs text-center mt-1.5 text-indigo-200 truncate">{result.playerName}</p>
                </div>

                {/* VS badge */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                  <div className="font-game font-black text-xs text-gray-700 bg-gray-950 rounded-full px-2 py-0.5 border border-gray-800">VS</div>
                </div>

                {/* Enemy side */}
                <div className="relative pl-3">
                  <Portrait
                    imageUrl={result.enemyImageUrl ?? null}
                    name={result.enemyName}
                    fallbackIcon="⚡"
                    flipped={true}
                    glowColor="#ef4444"
                    isAttacking={attackerSide === 'enemy'}
                    flashKey={playerFlashKey}
                  />
                  {/* Damage number */}
                  {floatingDmg?.side === 'enemy' && (
                    <div
                      key={floatingDmg.id}
                      className="absolute top-3 left-1/2 font-game font-black text-2xl text-orange-400 battle-float-dmg pointer-events-none z-20"
                      style={{ textShadow: '0 0 10px rgba(251,146,60,0.9)' }}
                    >
                      −{floatingDmg.val}
                    </div>
                  )}
                  <p className="font-game font-bold text-xs text-center mt-1.5 text-red-300 truncate">{result.enemyName}</p>
                </div>
              </div>

              {/* HP bars */}
              <div className="grid grid-cols-2 gap-3 px-3 pb-3">
                {/* Player HP */}
                <div>
                  <div className="flex justify-between font-game text-[10px] mb-1">
                    <span className="text-indigo-400">HP</span>
                    <span className="text-gray-600">{currentEntry?.playerHp ?? result.playerMaxHp} / {result.playerMaxHp}</span>
                  </div>
                  <div className="w-full bg-gray-900 rounded-full h-2.5 overflow-hidden">
                    <div className="h-2.5 rounded-full transition-all duration-500 ease-out" style={{
                      width: `${playerHpPct}%`,
                      background: playerHpPct > 50 ? '#22c55e' : playerHpPct > 25 ? '#eab308' : '#ef4444',
                    }} />
                  </div>
                </div>
                {/* Enemy HP */}
                <div>
                  <div className="flex justify-between font-game text-[10px] mb-1">
                    <span className="text-red-400">HP</span>
                    <span className="text-gray-600">{currentEntry?.enemyHp ?? result.enemyMaxHp} / {result.enemyMaxHp}</span>
                  </div>
                  <div className="w-full bg-gray-900 rounded-full h-2.5 overflow-hidden">
                    <div className="h-2.5 rounded-full transition-all duration-500 ease-out" style={{
                      width: `${enemyHpPct}%`,
                      background: enemyHpPct > 50 ? '#ef4444' : enemyHpPct > 25 ? '#f97316' : '#6b7280',
                    }} />
                  </div>
                </div>
              </div>
            </div>

            {/* ── Battle log ── */}
            <div className="flex justify-end mb-1.5">
              {!showResult && (
                <button
                  onClick={skipAnimation}
                  className="font-game text-xs text-gray-600 hover:text-gray-300 border border-gray-800 hover:border-gray-600 rounded-full px-3 py-1 transition-colors"
                >
                  Skip →
                </button>
              )}
            </div>
            <div
              ref={logRef}
              className="rounded-xl p-3 mb-4 h-28 overflow-y-auto space-y-1"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              {displayedLog.map((entry, i) => (
                <p key={i} className={`font-game text-sm leading-relaxed transition-colors ${
                  i === displayedLog.length - 1 ? 'text-white' : 'text-gray-700'
                }`}>
                  {entry.message}
                </p>
              ))}
              {!showResult && <p className="text-gray-800 text-sm animate-pulse font-game">•••</p>}
            </div>

            {/* ── Result ── */}
            {showResult && (
              <div className="rounded-2xl overflow-hidden" style={{
                background: result.winner === 'player'
                  ? 'linear-gradient(180deg, #052e16 0%, #0a1a0a 100%)'
                  : 'linear-gradient(180deg, #3b0a0a 0%, #1a0404 100%)',
                border: `1px solid ${result.winner === 'player' ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)'}`,
              }}>
                {/* Win / Loss header */}
                <div className="p-5 text-center">
                  <p className={`font-game font-black text-5xl mb-2 victory-in ${
                    result.winner === 'player' ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {result.winner === 'player' ? '🏆 VICTORY' : '💀 DEFEAT'}
                  </p>

                  <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm font-game">
                    {result.gemsAwarded > 0 && (
                      <span className="text-yellow-400 font-bold">+{result.gemsAwarded} 💎</span>
                    )}
                    {result.isNewClear && (
                      <span className="text-green-300">⭐ First clear!</span>
                    )}
                    {(result.milestoneGems ?? 0) > 0 && (
                      <span className="text-yellow-300">🎯 Milestone +{result.milestoneGems} 💎</span>
                    )}
                    {mode === 'tower' && result.winner === 'player' && result.newFloor && (
                      <span className="text-orange-300">⬆️ Floor {result.newFloor}!</span>
                    )}
                    {mode === 'tower' && result.winner === 'enemy' && (
                      <span className="text-red-400">Tower resets to Floor 1</span>
                    )}
                  </div>
                </div>

                {/* XP bars — animate in after brief delay */}
                {result.winner === 'player' && showXpBars && (
                  <div className="px-5 pb-4 space-y-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                    <p className="font-game text-[10px] text-gray-600 tracking-widest pt-4">XP EARNED</p>

                    {/* Card XP */}
                    {(result.xpGained ?? 0) > 0 && (
                      <div>
                        <div className="flex items-center justify-between font-game text-xs mb-1.5">
                          <span className="text-gray-400">{selected?.character.name}</span>
                          <span className="font-bold text-emerald-400">
                            +{result.xpGained} XP
                            {(result.levelsGained ?? 0) > 0 && (
                              <span className="ml-2 text-yellow-400">⬆️ Lv.{(preCharLevel) + (result.levelsGained ?? 0)}</span>
                            )}
                          </span>
                        </div>
                        <div className="w-full bg-gray-900 rounded-full h-3 overflow-hidden">
                          <div
                            className="h-3 rounded-full battle-xp-bar"
                            style={{
                              width: `${charXpPct}%`,
                              background: 'linear-gradient(90deg, #10b981, #6ee7b7)',
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Player account XP */}
                    {(result.playerXpGained ?? 0) > 0 && (() => {
                      const rank = getHunterRank(prePlayerLevel)
                      return (
                        <div>
                          <div className="flex items-center justify-between font-game text-xs mb-1.5">
                            <span className="text-gray-400">Hunter XP <span style={{ color: rank.color }}>({rank.rank}-Rank)</span></span>
                            <span className="font-bold text-indigo-400">
                              +{result.playerXpGained} XP
                              {result.newPlayerRank && (
                                <span className="ml-2 text-yellow-400">🎖️ {result.newPlayerRank}-Rank!</span>
                              )}
                            </span>
                          </div>
                          <div className="w-full bg-gray-900 rounded-full h-3 overflow-hidden">
                            <div
                              className="h-3 rounded-full battle-xp-bar-delayed"
                              style={{
                                width: `${playerXpPct}%`,
                                background: `linear-gradient(90deg, #6366f1, #a78bfa)`,
                              }}
                            />
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                )}

                {/* Action buttons */}
                <div className="p-4 pt-0 flex gap-2">
                  {result.winner === 'player' && mode === 'campaign' && stageNum < 5 && (
                    <Link
                      href={`/battle/fight?mode=campaign&arc=${arcNum}&stage=${stageNum + 1}`}
                      onClick={resetFight}
                      className="flex-1 font-game font-bold rounded-xl py-3 text-center text-sm transition-all hover:brightness-110"
                      style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.35)', color: '#86efac' }}
                    >
                      Next Stage →
                    </Link>
                  )}
                  {result.winner === 'player' && mode === 'campaign' && stageNum === 5 && (
                    <Link
                      href={arcNum < 20 ? `/battle/campaign/${arcNum + 1}` : '/battle/campaign'}
                      className="flex-1 font-game font-bold rounded-xl py-3 text-center text-sm transition-all hover:brightness-110"
                      style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.35)', color: '#86efac' }}
                    >
                      {arcNum < 20 ? 'Next Arc →' : '🏆 All Done!'}
                    </Link>
                  )}
                  <button
                    onClick={resetFight}
                    className="flex-1 font-game font-bold rounded-xl py-3 text-sm transition-all hover:brightness-110"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#d1d5db' }}
                  >
                    {result.winner === 'player' ? 'Again' : 'Retry'}
                  </button>
                  <Link
                    href={backHref}
                    className="flex-1 font-game font-bold rounded-xl py-3 text-center text-sm transition-all hover:brightness-110"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: '#6b7280' }}
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
      <main className="min-h-screen flex items-center justify-center" style={{ background: '#06040f' }}>
        <div className="font-game text-indigo-400 text-sm animate-pulse tracking-widest">LOADING...</div>
      </main>
    }>
      <FightContent />
    </Suspense>
  )
}
