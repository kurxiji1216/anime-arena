'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { getArc, isStageUnlocked, isStageCleared } from '@/lib/game/campaign'

const STAGE_REWARDS = [5, 5, 10, 10, 25]

export default function ArcPage() {
  const params = useParams()
  const arcNumber = parseInt(params.arc as string)
  const arc = getArc(arcNumber)

  const [cleared, setCleared] = useState<{ arc: number; stage: number }[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data } = await supabase
        .from('campaign_progress')
        .select('arc, stage')
        .eq('user_id', user.id)

      setCleared(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  if (!arc) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-500">Arc not found</div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-lg mx-auto">

        <div className="flex items-center justify-between mb-6">
          <Link href="/battle/campaign" className="text-gray-500 hover:text-gray-300 transition-colors">← Campaign</Link>
          <h1 className="text-xl font-black">Arc {arcNumber}</h1>
          <div className="w-16" />
        </div>

        {/* Arc header */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6 text-center">
          <div className="text-5xl mb-2">{arc.emoji}</div>
          <h2 className="text-2xl font-black text-white mb-1">{arc.name}</h2>
          <p className="text-gray-500 text-sm">{arc.anime}</p>
        </div>

        {/* Stages */}
        {loading ? (
          <div className="text-center py-10 text-gray-500 animate-pulse">Loading...</div>
        ) : (
          <div className="flex flex-col gap-3">
            {arc.stages.map((stage, i) => {
              const unlocked = isStageUnlocked(arcNumber, stage.stage, cleared)
              const complete = isStageCleared(arcNumber, stage.stage, cleared)
              const isBoss = stage.stage === 5

              return (
                <Link
                  key={stage.stage}
                  href={unlocked ? `/battle/fight?mode=campaign&arc=${arcNumber}&stage=${stage.stage}` : '#'}
                  onClick={e => !unlocked && e.preventDefault()}
                  className={`flex items-center justify-between rounded-2xl p-4 border transition-all ${
                    !unlocked
                      ? 'bg-gray-900/40 border-gray-800 opacity-50 cursor-not-allowed'
                      : complete
                      ? 'bg-green-950 border-green-700 hover:border-green-500'
                      : isBoss
                      ? 'bg-red-950 border-red-700 hover:border-red-500'
                      : 'bg-gray-900 border-gray-800 hover:border-violet-600'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-lg ${
                      complete ? 'bg-green-800 text-green-300' :
                      isBoss ? 'bg-red-800 text-red-300' :
                      'bg-gray-800 text-gray-400'
                    }`}>
                      {complete ? '✓' : isBoss ? '👑' : stage.stage}
                    </div>
                    <div>
                      <p className="font-bold text-white text-sm">
                        {isBoss ? '⚡ BOSS — ' : ''}{stage.enemyName}
                      </p>
                      <p className="text-gray-500 text-xs">
                        {complete ? 'Cleared · replay for +5 💎' : `First clear: +${STAGE_REWARDS[i]} 💎`}
                      </p>
                    </div>
                  </div>

                  {!unlocked && <span className="text-gray-600">🔒</span>}
                  {unlocked && !complete && <span className="text-gray-500 text-sm">Fight →</span>}
                  {complete && <span className="text-green-400 text-sm">Done ✓</span>}
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
