'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
  getArc,
  isStageUnlocked,
  isStageCleared,
  isArcComplete,
  stageGemReward,
  arcCompleteBonus,
  stageEnemyMultiplier,
  difficultyTier,
  recommendedLevel,
} from '@/lib/game/campaign'

const REPLAY_REWARD = 5

// Difficulty stars: Stage 1 = ★☆☆☆☆, Stage 5 = ★★★★★
function DifficultyStars({ stage, isBoss }: { stage: number; isBoss: boolean }) {
  return (
    <span className={`text-[10px] tracking-tighter ${isBoss ? 'text-red-400' : 'text-yellow-600'}`}>
      {'★'.repeat(stage)}{'☆'.repeat(5 - stage)}
    </span>
  )
}

export default function ArcPage() {
  const params    = useParams()
  const arcNumber = parseInt(params.arc as string)
  const arc       = getArc(arcNumber)

  const [cleared,      setCleared]      = useState<{ arc: number; stage: number }[]>([])
  const [enemyPortraits, setEnemyPortraits] = useState<Record<string, string | null>>({})
  const [loading,      setLoading]      = useState(true)
  const router  = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      if (!arc) { setLoading(false); return }

      // Fetch progress + enemy portraits in parallel
      const enemyNames = arc.stages.map(s => s.enemyName)
      const [progressRes, portraitsRes] = await Promise.all([
        supabase.from('campaign_progress').select('arc, stage').eq('user_id', user.id),
        supabase.from('characters').select('name, image_url').in('name', enemyNames),
      ])

      setCleared(progressRes.data ?? [])

      // Build name → image_url map
      const map: Record<string, string | null> = {}
      for (const row of portraitsRes.data ?? []) {
        map[row.name] = row.image_url
      }
      setEnemyPortraits(map)
      setLoading(false)
    }
    load()
  }, [arcNumber])

  if (!arc) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: '#06061a' }}>
        <div className="font-game text-gray-500">Arc not found</div>
      </main>
    )
  }

  const arcDone   = isArcComplete(arcNumber, cleared)
  const bonus     = arcCompleteBonus(arcNumber)
  const tier      = difficultyTier(arcNumber)
  const recLevel  = recommendedLevel(arcNumber)
  const arcMult   = stageEnemyMultiplier(arcNumber, 3) // mid-arc multiplier for display

  return (
    <main className="min-h-screen text-white pb-10" style={{
      background: 'radial-gradient(ellipse at 50% -5%, #0a1a30 0%, #06061a 60%)',
    }}>
      <div className="max-w-lg mx-auto px-4 pt-4">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <Link href="/battle/campaign" className="font-game text-gray-500 hover:text-gray-300 transition-colors text-sm">← Campaign</Link>
          <span className="font-game font-bold text-white text-sm">Arc {arcNumber}</span>
          <div className="w-16" />
        </div>

        {/* ── Arc header card ── */}
        <div className="relative rounded-2xl overflow-hidden p-5 mb-4" style={{
          background: `linear-gradient(135deg, ${tier.color}12 0%, rgba(6,6,26,0.98) 60%)`,
          border: `1px solid ${tier.color}33`,
        }}>
          <div className="absolute inset-0 pointer-events-none" style={{
            background: `radial-gradient(ellipse at 0% 50%, ${tier.color}18 0%, transparent 60%)`,
          }} />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-6xl opacity-10 select-none">{arc.emoji}</div>

          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{arc.emoji}</span>
              <span
                className="font-game font-bold text-[10px] px-2 py-0.5 rounded"
                style={{ background: `${tier.color}22`, border: `1px solid ${tier.color}55`, color: tier.color }}
              >
                {tier.label}
              </span>
              <span className="font-game text-[10px]" style={{ color: tier.color }}>Lv.{recLevel}+ recommended</span>
            </div>
            <h2 className="font-game font-black text-xl text-white mb-0.5">{arc.name}</h2>
            <p className="font-game text-gray-500 text-xs mb-3">{arc.anime}</p>
            <p className="text-gray-400 text-sm leading-relaxed">{arc.story}</p>
          </div>
        </div>

        {/* ── Arc completion banner ── */}
        {arcDone ? (
          <div className="rounded-xl px-4 py-3 mb-4 flex items-center gap-3" style={{
            background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
          }}>
            <span className="text-xl">🏆</span>
            <div>
              <p className="font-game font-bold text-green-400 text-sm">Arc Complete!</p>
              <p className="font-game text-gray-500 text-xs">All 5 stages cleared · bonus already claimed</p>
            </div>
          </div>
        ) : (
          <div className="rounded-xl px-4 py-3 mb-4 flex items-center gap-3" style={{
            background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)',
          }}>
            <span className="text-xl">⭐</span>
            <div>
              <p className="font-game font-bold text-yellow-400 text-sm">Arc Clear Bonus</p>
              <p className="font-game text-gray-500 text-xs">Complete all 5 stages: <span className="text-yellow-500">+{bonus} 💎</span></p>
            </div>
          </div>
        )}

        {/* ── Stages ── */}
        {loading ? (
          <div className="text-center py-10 font-game text-gray-700 animate-pulse">Loading...</div>
        ) : (
          <div className="flex flex-col gap-3">
            {arc.stages.map((stage) => {
              const unlocked = isStageUnlocked(arcNumber, stage.stage, cleared)
              const complete = isStageCleared(arcNumber, stage.stage, cleared)
              const isBoss   = stage.stage === 5
              const reward   = stageGemReward(arcNumber, stage.stage)
              const mult     = stageEnemyMultiplier(arcNumber, stage.stage)
              const portrait = enemyPortraits[stage.enemyName]

              return (
                <Link
                  key={stage.stage}
                  href={unlocked ? `/battle/fight?mode=campaign&arc=${arcNumber}&stage=${stage.stage}` : '#'}
                  onClick={e => !unlocked && e.preventDefault()}
                  className="flex items-center gap-3 rounded-2xl p-3 border transition-all duration-200"
                  style={{
                    background: complete
                      ? 'rgba(34,197,94,0.07)'
                      : isBoss && unlocked
                      ? 'rgba(239,68,68,0.07)'
                      : 'rgba(255,255,255,0.03)',
                    border: complete
                      ? '1px solid rgba(34,197,94,0.3)'
                      : isBoss && unlocked
                      ? '1px solid rgba(239,68,68,0.3)'
                      : unlocked
                      ? '1px solid rgba(255,255,255,0.09)'
                      : '1px solid rgba(255,255,255,0.04)',
                    opacity: unlocked ? 1 : 0.45,
                    cursor: unlocked ? 'pointer' : 'not-allowed',
                  }}
                >
                  {/* Stage number / status circle */}
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center font-game font-black text-base flex-shrink-0"
                    style={{
                      background: complete
                        ? 'rgba(34,197,94,0.2)'
                        : isBoss
                        ? 'rgba(239,68,68,0.2)'
                        : 'rgba(255,255,255,0.06)',
                      border: complete
                        ? '1px solid rgba(34,197,94,0.4)'
                        : isBoss
                        ? '1px solid rgba(239,68,68,0.4)'
                        : '1px solid rgba(255,255,255,0.1)',
                      color: complete ? '#4ade80' : isBoss ? '#f87171' : '#9ca3af',
                    }}
                  >
                    {complete ? '✓' : isBoss ? '👑' : stage.stage}
                  </div>

                  {/* Enemy portrait thumbnail */}
                  <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    {portrait ? (
                      <img src={portrait} alt={stage.enemyName} className="w-full h-full object-cover object-top" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-xl opacity-30">{isBoss ? '👑' : '👤'}</span>
                      </div>
                    )}
                  </div>

                  {/* Enemy info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {isBoss && <span className="font-game text-red-400 text-[10px] font-bold">BOSS</span>}
                      <p className="font-game font-bold text-white text-sm truncate">{stage.enemyName}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <DifficultyStars stage={stage.stage} isBoss={isBoss} />
                      <span className="font-game text-gray-600 text-[10px]">×{mult.toFixed(2)}</span>
                    </div>
                    <p className="font-game text-[10px] mt-0.5" style={{ color: complete ? '#4ade80' : '#6b7280' }}>
                      {complete
                        ? `Replay: +${REPLAY_REWARD} 💎`
                        : `First clear: +${reward} 💎`}
                    </p>
                  </div>

                  {/* Right side */}
                  <div className="shrink-0 text-right">
                    {!unlocked && <span className="text-gray-700 text-sm">🔒</span>}
                    {unlocked && complete && <span className="font-game text-green-500 text-xs">Done ✓</span>}
                    {unlocked && !complete && (
                      <span className="font-game text-gray-500 text-xs">Fight →</span>
                    )}
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
