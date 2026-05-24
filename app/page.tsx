'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Quest } from '@/lib/game/quests'
import { getHunterRank } from '@/lib/game/player'
import { TUTORIAL_STEPS, TOTAL_TUTORIAL_GEMS, type TutorialStepKey } from '@/lib/game/tutorial'

type TutorialState = (typeof TUTORIAL_STEPS)[number] & {
  conditionMet: boolean
  claimed:      boolean
}

type Profile = {
  username: string | null
  gems: number
  last_daily_claim_at: string | null
  streak_days: number
  player_level: number
  player_xp: number
}

const STREAK_MILESTONES: Record<number, number> = { 3: 40, 7: 100 }

function streakColor(days: number) {
  if (days >= 7) return { border: 'border-orange-500', bg: 'rgba(249,115,22,0.12)', text: 'text-orange-400', icon: '🔥' }
  if (days >= 3) return { border: 'border-amber-500', bg: 'rgba(245,158,11,0.10)', text: 'text-amber-400', icon: '🟠' }
  return { border: 'border-gray-700', bg: 'rgba(255,255,255,0.03)', text: 'text-gray-400', icon: '✦' }
}

const NAV_CARDS = [
  {
    href: '/pull',
    label: 'PULL',
    sub: '10 💎 per pull',
    icon: '🎴',
    cls: 'nav-pull',
    gradient: 'linear-gradient(135deg, #1e0450 0%, #2d0a6b 50%, #1a0440 100%)',
    border: 'rgba(139,92,246,0.4)',
    accent: '#8b5cf6',
  },
  {
    href: '/collection',
    label: 'CARDS',
    sub: 'My collection',
    icon: '📚',
    cls: 'nav-collect',
    gradient: 'linear-gradient(135deg, #021433 0%, #0a2454 50%, #011028 100%)',
    border: 'rgba(59,130,246,0.4)',
    accent: '#3b82f6',
  },
  {
    href: '/pvp',
    label: 'PvP',
    sub: '+15 💎 per win',
    icon: '🥊',
    cls: 'nav-pvp',
    gradient: 'linear-gradient(135deg, #2d0030 0%, #4a0050 50%, #220024 100%)',
    border: 'rgba(236,72,153,0.4)',
    accent: '#ec4899',
  },
  {
    href: '/leaderboard',
    label: 'RANKS',
    sub: 'Top players',
    icon: '🏆',
    cls: 'nav-rank',
    gradient: 'linear-gradient(135deg, #1a1000 0%, #2e1c00 50%, #140c00 100%)',
    border: 'rgba(245,158,11,0.4)',
    accent: '#f59e0b',
  },
  {
    href: '/achievements',
    label: 'GOALS',
    sub: 'Earn bonus gems',
    icon: '🎖️',
    cls: 'nav-rank',
    gradient: 'linear-gradient(135deg, #0a1a20 0%, #0d2440 50%, #051018 100%)',
    border: 'rgba(34,197,94,0.4)',
    accent: '#22c55e',
  },
  {
    href: '/equipment',
    label: 'GEAR',
    sub: 'Items & Sparks',
    icon: '⚙️',
    cls: 'nav-rank',
    gradient: 'linear-gradient(135deg, #1a0a30 0%, #2d0a50 50%, #100620 100%)',
    border: 'rgba(168,85,247,0.4)',
    accent: '#a855f7',
  },
]

export default function HomePage() {
  const [profile, setProfile]             = useState<Profile | null>(null)
  const [quests, setQuests]               = useState<Quest[]>([])
  const [tutorial, setTutorial]           = useState<TutorialState[]>([])
  const [loading, setLoading]             = useState(true)
  const [claiming, setClaiming]           = useState(false)
  const [claimMsg, setClaimMsg]           = useState('')
  const [claimingQuest, setClaimingQuest] = useState<string | null>(null)
  const [claimingTutorial, setClaimingTutorial] = useState<string | null>(null)
  const [streakMsg, setStreakMsg]         = useState('')
  const [gemPop, setGemPop]              = useState(false)
  const router  = useRouter()
  const supabase = createClient()
  const gemRef  = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const [profileRes, questsRes, streakRes, tutorialRes] = await Promise.all([
        supabase.from('profiles').select('username, gems, last_daily_claim_at, streak_days, player_level, player_xp').eq('user_id', user.id).single(),
        fetch('/api/quests'),
        fetch('/api/streak', { method: 'POST' }),
        fetch('/api/tutorial'),
      ])

      if (profileRes.data) setProfile(profileRes.data)
      if (questsRes.ok) {
        const q = await questsRes.json()
        setQuests(q.quests?.quests ?? [])
      }
      if (tutorialRes.ok) {
        const t = await tutorialRes.json()
        setTutorial(t.steps ?? [])
      }
      if (streakRes.ok) {
        const s = await streakRes.json()
        if (!s.alreadyCounted) {
          setProfile(prev => prev ? { ...prev, streak_days: s.streak, ...(s.gemsAwarded > 0 ? { gems: s.gemsTotal } : {}) } : prev)
          if (s.gemsAwarded > 0) setStreakMsg(`🔥 Day ${s.milestone} streak! +${s.gemsAwarded}💎 bonus!`)
        }
      }
      setLoading(false)
    }
    load()
  }, [])

  function popGems() {
    setGemPop(true)
    setTimeout(() => setGemPop(false), 400)
  }

  async function claimDaily() {
    setClaiming(true); setClaimMsg('')
    const res  = await fetch('/api/daily', { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      setProfile(prev => prev ? { ...prev, gems: data.gemsTotal, last_daily_claim_at: new Date().toISOString() } : prev)
      setClaimMsg(`+${data.gemsAwarded}💎`)
      popGems()
      const qRes = await fetch('/api/quests')
      if (qRes.ok) { const q = await qRes.json(); setQuests(q.quests?.quests ?? []) }
    } else {
      setClaimMsg(data.error)
    }
    setClaiming(false)
  }

  async function claimQuest(key: string) {
    setClaimingQuest(key)
    const res  = await fetch('/api/quests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key }) })
    const data = await res.json()
    if (res.ok) {
      setProfile(prev => prev ? { ...prev, gems: data.gemsTotal } : prev)
      setQuests(prev => prev.map(q => q.key === key ? { ...q, claimed: true } : q))
      popGems()
    }
    setClaimingQuest(null)
  }

  async function claimTutorial(key: TutorialStepKey) {
    setClaimingTutorial(key)
    const res  = await fetch('/api/tutorial', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key }) })
    const data = await res.json()
    if (res.ok) {
      setProfile(prev => prev ? { ...prev, gems: data.gemsTotal } : prev)
      setTutorial(prev => prev.map(t => t.key === key ? { ...t, claimed: true } : t))
      popGems()
    }
    setClaimingTutorial(null)
  }

  const canClaimDaily = !profile?.last_daily_claim_at ||
    (Date.now() - new Date(profile.last_daily_claim_at).getTime()) / 3600000 >= 24

  async function signOut() { await supabase.auth.signOut(); router.push('/login') }

  const streak = profile?.streak_days ?? 0
  const sc     = streakColor(streak)
  const nextMs = [3, 7].find(m => m > streak) ?? null
  const claimableQuests = quests.filter(q => q.done && !q.claimed)

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: '#06061a' }}>
        <div className="font-game text-indigo-400 tracking-widest text-sm animate-pulse">LOADING...</div>
      </main>
    )
  }

  return (
    <main className="min-h-screen text-white pb-8" style={{
      background: 'radial-gradient(ellipse at 50% -10%, #1a1060 0%, #06061a 55%)',
    }}>

      {/* ── Sticky top bar ── */}
      {(() => {
        const playerLevel = profile?.player_level ?? 1
        const playerXp    = profile?.player_xp ?? 0
        const rank        = getHunterRank(playerLevel)
        return (
          <header className="sticky top-0 z-40 px-4 py-2.5 flex items-center justify-between" style={{
            background: 'rgba(6,6,26,0.85)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            {/* Left: title */}
            <div className="flex items-center gap-2">
              <span className="text-xl">⚔️</span>
              <span className="font-game font-700 text-lg text-white tracking-widest">ANIME ARENA</span>
            </div>

            {/* Right: rank badge + level + gems + exit */}
            <div className="flex items-center gap-3">

              {/* Hunter rank badge */}
              <div className="flex items-center gap-1.5">
                <span
                  className="font-game font-black text-xs px-2 py-0.5 rounded"
                  style={{ background: `${rank.color}22`, border: `1px solid ${rank.color}66`, color: rank.color }}
                >
                  {rank.rank}
                </span>
                <span className="font-game font-bold text-sm" style={{ color: rank.color }}>
                  Lv.{playerLevel}
                </span>
              </div>

              {/* Divider */}
              <span className="text-gray-800 text-xs">|</span>

              {/* Gems */}
              <div className="flex items-center gap-1.5">
                <span className="text-yellow-500 text-base">💎</span>
                <span
                  ref={gemRef}
                  className={`font-game font-bold text-xl text-yellow-400 ${gemPop ? 'gem-pop' : ''}`}
                >
                  {profile?.gems ?? 0}
                </span>
              </div>

              <button onClick={signOut} className="text-gray-600 hover:text-gray-400 text-xs transition-colors font-game">
                EXIT
              </button>
            </div>
          </header>
        )
      })()}

      <div className="max-w-md mx-auto px-4 pt-5 space-y-3">

        {/* ── Tutorial / Hunter's Path — auto-hides when all claimed ── */}
        {tutorial.length > 0 && tutorial.some(t => !t.claimed) && (() => {
          const claimedCount  = tutorial.filter(t => t.claimed).length
          const claimableCount = tutorial.filter(t => t.conditionMet && !t.claimed).length
          return (
            <div className="menu-in menu-in-1 rounded-2xl overflow-hidden" style={{
              background: 'linear-gradient(135deg, rgba(168,85,247,0.10), rgba(99,102,241,0.06))',
              border: '1px solid rgba(168,85,247,0.35)',
            }}>
              <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="flex items-center gap-2">
                  <span className="text-base">🎯</span>
                  <div>
                    <p className="font-game font-bold text-sm tracking-widest text-purple-200">HUNTER&apos;S PATH</p>
                    <p className="font-game text-[10px] text-gray-500">{claimedCount} / {tutorial.length} steps · up to {TOTAL_TUTORIAL_GEMS} 💎</p>
                  </div>
                </div>
                {claimableCount > 0 && (
                  <span className="font-game text-[10px] text-green-400 bg-green-900/40 border border-green-700/50 px-2 py-0.5 rounded-full animate-pulse">
                    {claimableCount} READY
                  </span>
                )}
              </div>
              <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                {tutorial.map(step => {
                  const canClaim = step.conditionMet && !step.claimed
                  return (
                    <div key={step.key} className="flex items-center gap-3 px-4 py-3">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                        style={{
                          background: step.claimed ? 'rgba(255,255,255,0.05)' : `${step.color}15`,
                          border: `1px solid ${step.claimed ? 'rgba(255,255,255,0.08)' : `${step.color}55`}`,
                        }}
                      >
                        {step.claimed ? '✓' : step.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-game font-bold text-sm ${step.claimed ? 'text-gray-600 line-through' : 'text-white'}`}>
                          {step.title}
                        </p>
                        <p className={`font-game text-[11px] ${step.claimed ? 'text-gray-700' : 'text-gray-500'}`}>
                          {step.description}
                        </p>
                      </div>
                      {step.claimed ? (
                        <span className="font-game text-[10px] text-gray-700">+{step.reward}💎</span>
                      ) : canClaim ? (
                        <button
                          onClick={() => claimTutorial(step.key)}
                          disabled={claimingTutorial === step.key}
                          className="font-game font-black text-xs px-3 py-1.5 rounded-lg transition-all hover:brightness-110 disabled:opacity-50"
                          style={{ background: step.color, color: '#000' }}
                        >
                          {claimingTutorial === step.key ? '...' : `+${step.reward}💎`}
                        </button>
                      ) : (
                        <span className="font-game text-[10px] text-gray-700">+{step.reward}💎</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {/* ── Streak milestone toast ── */}
        {streakMsg && (
          <div className="menu-in menu-in-1 rounded-xl px-4 py-3 text-center font-game font-bold text-sm" style={{
            background: 'linear-gradient(135deg, rgba(249,115,22,0.2), rgba(245,158,11,0.15))',
            border: '1px solid rgba(249,115,22,0.4)',
            color: '#fb923c',
          }}>
            {streakMsg}
          </div>
        )}

        {/* ── Streak + Daily row ── */}
        <div className="menu-in menu-in-1 grid grid-cols-2 gap-3">

          {/* Streak */}
          <div className="rounded-2xl p-4" style={{
            background: sc.bg,
            border: `1px solid ${sc.border.replace('border-', '')}`,
            borderColor: streak >= 7 ? 'rgba(249,115,22,0.5)' : streak >= 3 ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.07)',
          }}>
            <p className="font-game text-gray-500 text-xs tracking-widest mb-1">STREAK</p>
            <div className="flex items-end gap-1.5">
              <span className={`font-game font-bold text-4xl leading-none ${sc.text}`}>{streak}</span>
              <span className="text-2xl mb-0.5">{sc.icon}</span>
            </div>
            <p className="text-gray-600 text-[10px] font-game mt-1.5">
              {nextMs ? `Day ${nextMs} → +${STREAK_MILESTONES[nextMs]}💎` : streak >= 7 ? 'MAX BONUS ACTIVE' : 'LOGIN DAILY'}
            </p>
          </div>

          {/* Daily Bonus */}
          <div className="rounded-2xl p-4 flex flex-col justify-between" style={{
            background: canClaimDaily ? 'rgba(234,179,8,0.08)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${canClaimDaily ? 'rgba(234,179,8,0.35)' : 'rgba(255,255,255,0.07)'}`,
          }}>
            <div>
              <p className="font-game text-gray-500 text-xs tracking-widest mb-1">DAILY</p>
              <p className="font-game font-bold text-white text-sm">+20 💎</p>
              {claimMsg && (
                <p className={`text-xs font-game mt-1 ${claimMsg.startsWith('+') ? 'text-yellow-400' : 'text-gray-500'}`}>
                  {claimMsg}
                </p>
              )}
            </div>
            <button
              onClick={claimDaily}
              disabled={claiming || !canClaimDaily}
              className="mt-2 w-full font-game font-bold text-xs rounded-lg py-2 transition-all"
              style={{
                background: canClaimDaily ? 'linear-gradient(135deg, #d97706, #f59e0b)' : 'rgba(255,255,255,0.06)',
                color: canClaimDaily ? '#000' : '#4b5563',
                cursor: canClaimDaily ? 'pointer' : 'default',
              }}
            >
              {claiming ? '...' : canClaimDaily ? 'CLAIM!' : 'CLAIMED ✓'}
            </button>
          </div>
        </div>

        {/* ── Daily Quests ── */}
        <div className="menu-in menu-in-2 rounded-2xl overflow-hidden" style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
        }}>
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <span className="font-game font-bold text-sm tracking-widest text-white">DAILY QUESTS</span>
            {claimableQuests.length > 0 && (
              <span className="font-game text-[10px] text-green-400 bg-green-900/40 border border-green-700/50 px-2 py-0.5 rounded-full">
                {claimableQuests.length} READY
              </span>
            )}
          </div>
          <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
            {quests.map((q, i) => {
              const questColors: Record<string, string> = {
                do_pull: '#8b5cf6', claim_daily: '#f59e0b', level_up: '#22c55e'
              }
              const color = questColors[q.key] ?? '#6b7280'
              return (
                <div key={q.key} className="flex items-center gap-3 px-4 py-3">
                  {/* Color bar */}
                  <div className="w-1 h-8 rounded-full flex-shrink-0" style={{ background: q.done ? color : 'rgba(255,255,255,0.1)' }} />
                  {/* Checkmark */}
                  <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center" style={{
                    background: q.done ? color : 'rgba(255,255,255,0.05)',
                    border: `1.5px solid ${q.done ? color : 'rgba(255,255,255,0.15)'}`,
                  }}>
                    {q.done && <span className="text-white text-[9px] font-black">✓</span>}
                  </div>
                  {/* Label */}
                  <div className="flex-1 min-w-0">
                    <p className={`font-game font-semibold text-sm ${q.claimed ? 'line-through text-gray-600' : q.done ? 'text-white' : 'text-gray-400'}`}>
                      {q.label}
                    </p>
                    <p className="font-game text-[10px]" style={{ color: q.done && !q.claimed ? color : '#4b5563' }}>
                      +{q.reward} 💎
                    </p>
                  </div>
                  {/* Claim / status */}
                  {q.done && !q.claimed ? (
                    <button
                      onClick={() => claimQuest(q.key)}
                      disabled={claimingQuest === q.key}
                      className="font-game font-bold text-xs px-3 py-1.5 rounded-lg flex-shrink-0 transition-all hover:brightness-110"
                      style={{ background: color, color: '#000' }}
                    >
                      {claimingQuest === q.key ? '...' : `+${q.reward}💎`}
                    </button>
                  ) : q.claimed ? (
                    <span className="font-game text-[10px] text-gray-700">DONE</span>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── BATTLE — hero card ── */}
        <Link href="/battle" className="menu-in menu-in-3 nav-battle block rounded-2xl overflow-hidden relative transition-all duration-200 hover:scale-[1.02]" style={{
          background: 'linear-gradient(135deg, #3d0808 0%, #1a0303 60%, #0d0202 100%)',
          border: '1px solid rgba(239,68,68,0.35)',
          minHeight: '110px',
        }}>
          {/* Background glow blob */}
          <div className="absolute inset-0" style={{
            background: 'radial-gradient(ellipse at 20% 50%, rgba(239,68,68,0.2) 0%, transparent 60%)',
          }} />
          {/* Big faded icon */}
          <div className="absolute right-5 top-1/2 -translate-y-1/2 text-[80px] opacity-10 select-none">⚔️</div>
          <div className="relative z-10 p-5">
            <p className="font-game font-bold text-[10px] tracking-widest text-red-500 mb-1">FEATURED</p>
            <p className="font-game font-bold text-3xl text-white leading-none">BATTLE</p>
            <p className="font-game text-red-400 text-sm mt-1">Campaign · Infinite Tower</p>
          </div>
        </Link>

        {/* ── Nav grid 2×2 ── */}
        <div className="menu-in menu-in-4 grid grid-cols-2 gap-3">
          {NAV_CARDS.map(card => (
            <Link
              key={card.href}
              href={card.href}
              className={`${card.cls} block rounded-2xl overflow-hidden relative transition-all duration-200 hover:scale-[1.03]`}
              style={{
                background: card.gradient,
                border: `1px solid ${card.border}`,
                minHeight: '100px',
              }}
            >
              <div className="absolute inset-0" style={{
                background: `radial-gradient(ellipse at 15% 50%, ${card.accent}22 0%, transparent 65%)`,
              }} />
              <div className="absolute right-3 bottom-2 text-[48px] opacity-10 select-none leading-none">{card.icon}</div>
              <div className="relative z-10 p-4">
                <div className="text-2xl mb-1">{card.icon}</div>
                <p className="font-game font-bold text-base text-white leading-none">{card.label}</p>
                <p className="font-game text-[11px] mt-1" style={{ color: card.accent }}>{card.sub}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* ── Footer ── */}
        <p className="menu-in menu-in-6 text-center font-game text-[10px] tracking-widest text-gray-800 pt-2">
          ANIME ARENA · COLLECT · BATTLE · DOMINATE
        </p>

      </div>
    </main>
  )
}
