'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CAMPAIGN, isArcUnlocked } from '@/lib/game/campaign'

export default function CampaignPage() {
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

  function arcProgress(arcNumber: number) {
    const done = cleared.filter(c => c.arc === arcNumber).length
    return { done, total: 5 }
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-2xl mx-auto">

        <div className="flex items-center justify-between mb-8">
          <Link href="/battle" className="text-gray-500 hover:text-gray-300 transition-colors">← Battle</Link>
          <h1 className="text-xl font-black">Campaign</h1>
          <p className="text-gray-500 text-sm">
            {cleared.length}/100
          </p>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-500 animate-pulse">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {CAMPAIGN.map(arc => {
              const unlocked = isArcUnlocked(arc.arc, cleared)
              const { done, total } = arcProgress(arc.arc)
              const complete = done === total

              return (
                <Link
                  key={arc.arc}
                  href={unlocked ? `/battle/campaign/${arc.arc}` : '#'}
                  className={`relative rounded-2xl p-5 border transition-all block ${
                    !unlocked
                      ? 'bg-gray-900/40 border-gray-800 opacity-50 cursor-not-allowed'
                      : complete
                      ? 'bg-green-950 border-green-700 hover:border-green-500'
                      : 'bg-gray-900 border-gray-800 hover:border-violet-600'
                  }`}
                  onClick={e => !unlocked && e.preventDefault()}
                >
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-3xl">{arc.emoji}</span>
                    {!unlocked && <span className="text-gray-600 text-lg">🔒</span>}
                    {complete && <span className="text-green-400 text-sm font-bold">✓ Done</span>}
                  </div>

                  <p className="font-black text-white text-base leading-tight mb-0.5">{arc.name}</p>
                  <p className="text-gray-500 text-xs mb-3">{arc.anime}</p>

                  {/* Progress bar */}
                  <div className="w-full bg-gray-800 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${complete ? 'bg-green-500' : 'bg-violet-500'}`}
                      style={{ width: `${(done / total) * 100}%` }}
                    />
                  </div>
                  <p className="text-gray-600 text-xs mt-1">{done}/{total} stages</p>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
