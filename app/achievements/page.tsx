'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ACHIEVEMENTS, TOTAL_ACHIEVEMENT_GEMS, type AchievementCategory, type AchievementKey } from '@/lib/game/achievements'

type AchievementState = (typeof ACHIEVEMENTS)[number] & {
  conditionMet: boolean
  claimed: boolean
  progress: number
}

const CATEGORY_TABS: { id: AchievementCategory | 'all'; label: string }[] = [
  { id: 'all',      label: 'All' },
  { id: 'gacha',    label: '🎴 Gacha' },
  { id: 'battle',   label: '⚔️ Battle' },
  { id: 'progress', label: '📈 Progress' },
]

const CATEGORY_COLOR: Record<AchievementCategory, string> = {
  gacha:    '#8b5cf6',
  battle:   '#ef4444',
  progress: '#3b82f6',
}

export default function AchievementsPage() {
  const [achievements, setAchievements] = useState<AchievementState[]>([])
  const [loading,      setLoading]      = useState(true)
  const [claiming,     setClaiming]     = useState<string | null>(null)
  const [tab,          setTab]          = useState<AchievementCategory | 'all'>('all')
  const router = useRouter()

  useEffect(() => { load() }, [])

  async function load() {
    const res = await fetch('/api/achievements')
    if (!res.ok) { router.push('/login'); return }
    const data = await res.json()
    setAchievements(data.achievements)
    setLoading(false)
  }

  async function claim(key: AchievementKey) {
    setClaiming(key)
    const res  = await fetch('/api/achievements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    })
    if (res.ok) {
      setAchievements(prev => prev.map(a => a.key === key ? { ...a, claimed: true } : a))
    }
    setClaiming(null)
  }

  const filtered = tab === 'all' ? achievements : achievements.filter(a => a.category === tab)
  const claimedCount  = achievements.filter(a => a.claimed).length
  const claimableCount = achievements.filter(a => a.conditionMet && !a.claimed).length
  const claimedGems   = achievements.filter(a => a.claimed).reduce((s, a) => s + a.reward, 0)

  return (
    <main className="min-h-screen text-white pb-10" style={{
      background: 'radial-gradient(ellipse at 50% -5%, #0f0a20 0%, #06061a 60%)',
    }}>
      <div className="max-w-lg mx-auto px-4 pt-4">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <Link href="/" className="font-game text-gray-500 hover:text-gray-300 transition-colors text-sm">← Home</Link>
          <span className="font-game font-bold text-white tracking-widest text-sm">ACHIEVEMENTS</span>
          <div className="w-16" />
        </div>

        {/* Summary bar */}
        <div className="rounded-2xl p-4 mb-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="font-game font-black text-white text-lg">{claimedCount} <span className="text-gray-500 font-normal text-sm">/ {achievements.length} claimed</span></p>
              <p className="font-game text-gray-600 text-xs">{claimedGems} / {TOTAL_ACHIEVEMENT_GEMS} 💎 earned</p>
            </div>
            {claimableCount > 0 && (
              <div className="font-game font-bold text-sm px-3 py-1.5 rounded-xl animate-pulse" style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)', color: '#4ade80' }}>
                {claimableCount} ready!
              </div>
            )}
          </div>
          <div className="w-full rounded-full h-2" style={{ background: 'rgba(255,255,255,0.07)' }}>
            <div className="h-2 rounded-full transition-all" style={{
              width: `${(claimedCount / Math.max(achievements.length, 1)) * 100}%`,
              background: 'linear-gradient(90deg, #8b5cf6, #3b82f6)',
            }} />
          </div>
        </div>

        {/* Category tabs */}
        <div className="grid grid-cols-4 gap-1 rounded-xl p-1 mb-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          {CATEGORY_TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="rounded-lg py-2 font-game text-xs font-bold transition-all"
              style={{
                background: tab === t.id ? 'rgba(255,255,255,0.12)' : 'transparent',
                color: tab === t.id ? '#fff' : '#6b7280',
                border: tab === t.id ? '1px solid rgba(255,255,255,0.15)' : '1px solid transparent',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Achievement list */}
        {loading ? (
          <div className="text-center py-20 font-game text-gray-700 animate-pulse">Loading...</div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map(a => {
              const color = CATEGORY_COLOR[a.category]
              const canClaim = a.conditionMet && !a.claimed
              const pct = a.progressTarget ? (a.progress / a.progressTarget) * 100 : 0

              return (
                <div
                  key={a.key}
                  className="rounded-2xl p-4 transition-all"
                  style={{
                    background: a.claimed
                      ? 'rgba(255,255,255,0.02)'
                      : canClaim
                      ? `${color}12`
                      : 'rgba(255,255,255,0.04)',
                    border: a.claimed
                      ? '1px solid rgba(255,255,255,0.05)'
                      : canClaim
                      ? `1px solid ${color}44`
                      : '1px solid rgba(255,255,255,0.08)',
                    opacity: a.claimed ? 0.6 : 1,
                  }}
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                      style={{ background: a.claimed ? 'rgba(255,255,255,0.05)' : `${color}20`, border: `1px solid ${color}33` }}
                    >
                      {a.claimed ? '✓' : a.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <p className={`font-game font-black text-sm ${a.claimed ? 'text-gray-500' : 'text-white'}`}>
                          {a.title}
                        </p>
                        <span className="font-game font-bold text-sm shrink-0" style={{ color: a.claimed ? '#4b5563' : '#fbbf24' }}>
                          +{a.reward}💎
                        </span>
                      </div>
                      <p className={`font-game text-xs mb-2 ${a.claimed ? 'text-gray-700' : 'text-gray-500'}`}>
                        {a.description}
                      </p>

                      {/* Progress bar (for achievements with targets) */}
                      {a.progressTarget && !a.claimed && (
                        <div className="mb-2">
                          <div className="flex justify-between font-game text-[10px] mb-1">
                            <span className="text-gray-600">{a.progress} / {a.progressTarget}</span>
                            <span style={{ color }}>{Math.round(pct)}%</span>
                          </div>
                          <div className="w-full rounded-full h-1.5" style={{ background: 'rgba(255,255,255,0.07)' }}>
                            <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                          </div>
                        </div>
                      )}

                      {/* Claim button or status */}
                      {a.claimed ? (
                        <span className="font-game text-[10px] text-gray-700">CLAIMED</span>
                      ) : canClaim ? (
                        <button
                          onClick={() => claim(a.key)}
                          disabled={claiming === a.key}
                          className="font-game font-black text-xs px-4 py-1.5 rounded-lg transition-all hover:brightness-110 disabled:opacity-50"
                          style={{ background: color, color: '#fff' }}
                        >
                          {claiming === a.key ? '...' : `Claim +${a.reward}💎`}
                        </button>
                      ) : (
                        <span className="font-game text-[10px] text-gray-700">IN PROGRESS</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
