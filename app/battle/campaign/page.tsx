'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CAMPAIGN, isArcUnlocked, isArcComplete, arcCompleteBonus, recommendedLevel, difficultyTier } from '@/lib/game/campaign'

export default function CampaignPage() {
  const [cleared, setCleared] = useState<{ arc: number; stage: number }[]>([])
  const [loading, setLoading] = useState(true)
  const router  = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data } = await supabase.from('campaign_progress').select('arc, stage').eq('user_id', user.id)
      setCleared(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const totalCleared = cleared.length

  return (
    <main className="min-h-screen text-white pb-10" style={{
      background: 'radial-gradient(ellipse at 50% -5%, #0a1a30 0%, #06061a 60%)',
    }}>
      <div className="max-w-2xl mx-auto px-4 pt-4">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/battle" className="font-game text-gray-500 hover:text-gray-300 transition-colors text-sm">← Battle</Link>
          <span className="font-game font-bold text-white tracking-widest text-sm">CAMPAIGN</span>
          <span className="font-game text-gray-500 text-sm">{totalCleared}/100</span>
        </div>

        {/* Progress summary */}
        <div className="rounded-2xl p-4 mb-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex justify-between font-game text-xs mb-2">
            <span className="text-gray-500">Total Progress</span>
            <span className="text-blue-400">{totalCleared} / 100 stages</span>
          </div>
          <div className="w-full rounded-full h-2" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div className="h-2 rounded-full transition-all" style={{
              width: `${(totalCleared / 100) * 100}%`,
              background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
            }} />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 font-game text-gray-700 animate-pulse">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {CAMPAIGN.map(arc => {
              const unlocked  = isArcUnlocked(arc.arc, cleared)
              const complete  = isArcComplete(arc.arc, cleared)
              const done      = cleared.filter(c => c.arc === arc.arc).length
              const tier      = difficultyTier(arc.arc)
              const recLevel  = recommendedLevel(arc.arc)
              const bonus     = arcCompleteBonus(arc.arc)

              return (
                <Link
                  key={arc.arc}
                  href={unlocked ? `/battle/campaign/${arc.arc}` : '#'}
                  onClick={e => !unlocked && e.preventDefault()}
                  className="relative rounded-2xl overflow-hidden p-4 block transition-all duration-200"
                  style={{
                    background: complete
                      ? 'linear-gradient(135deg, rgba(34,197,94,0.1), rgba(6,6,26,0.95))'
                      : unlocked
                      ? 'rgba(255,255,255,0.04)'
                      : 'rgba(255,255,255,0.02)',
                    border: complete
                      ? '1px solid rgba(34,197,94,0.35)'
                      : unlocked
                      ? '1px solid rgba(255,255,255,0.1)'
                      : '1px solid rgba(255,255,255,0.05)',
                    opacity: unlocked ? 1 : 0.5,
                    cursor: unlocked ? 'pointer' : 'not-allowed',
                  }}
                >
                  {/* Hover glow for unlocked incomplete arcs */}
                  {unlocked && !complete && (
                    <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity pointer-events-none rounded-2xl" style={{
                      background: 'rgba(139,92,246,0.06)',
                    }} />
                  )}

                  <div className="relative z-10">
                    {/* Top row: emoji + difficulty + lock/done */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{arc.emoji}</span>
                        <span
                          className="font-game font-bold text-[10px] px-2 py-0.5 rounded"
                          style={{ background: `${tier.color}22`, border: `1px solid ${tier.color}44`, color: tier.color }}
                        >
                          {tier.label}
                        </span>
                      </div>
                      {!unlocked && <span className="text-gray-700">🔒</span>}
                      {complete && <span className="text-green-400 font-game font-bold text-xs">✓ DONE</span>}
                    </div>

                    {/* Arc name + anime */}
                    <p className="font-game font-black text-white text-sm leading-tight mb-0.5">{arc.name}</p>
                    <p className="font-game text-gray-600 text-xs mb-2">{arc.anime}</p>

                    {/* Story teaser */}
                    <p className="text-gray-500 text-xs leading-relaxed mb-3 line-clamp-2">{arc.story}</p>

                    {/* Progress bar */}
                    <div className="w-full rounded-full h-1.5 mb-1.5" style={{ background: 'rgba(255,255,255,0.07)' }}>
                      <div
                        className="h-1.5 rounded-full transition-all"
                        style={{
                          width: `${(done / 5) * 100}%`,
                          background: complete ? '#22c55e' : '#8b5cf6',
                        }}
                      />
                    </div>

                    {/* Bottom row: stage count + rec level + arc bonus */}
                    <div className="flex items-center justify-between">
                      <span className="font-game text-gray-600 text-[10px]">{done}/5 stages</span>
                      <div className="flex items-center gap-2">
                        <span className="font-game text-[10px]" style={{ color: tier.color }}>Lv.{recLevel}+</span>
                        {!complete && (
                          <span className="font-game text-yellow-700 text-[10px]">Clear: +{bonus}💎</span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
