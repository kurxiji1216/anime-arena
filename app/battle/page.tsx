'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function BattleHubPage() {
  const [towerFloor, setTowerFloor] = useState<number>(1)
  const [bestFloor, setBestFloor] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data } = await supabase
        .from('profiles')
        .select('tower_floor, tower_best_floor')
        .eq('user_id', user.id)
        .single()

      if (data) {
        setTowerFloor(data.tower_floor ?? 1)
        setBestFloor(data.tower_best_floor ?? 0)
      }
      setLoading(false)
    }
    load()
  }, [])

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-lg mx-auto">

        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="text-gray-500 hover:text-gray-300 transition-colors">← Home</Link>
          <h1 className="text-xl font-black">Battle</h1>
          <div className="w-16" />
        </div>

        <div className="flex flex-col gap-4">

          {/* Campaign */}
          <Link
            href="/battle/campaign"
            className="relative bg-gradient-to-br from-blue-900 to-violet-900 hover:from-blue-800 hover:to-violet-800 border border-blue-700 rounded-2xl p-7 block overflow-hidden transition-colors"
          >
            <div className="relative z-10">
              <div className="text-4xl mb-3">📖</div>
              <p className="font-black text-white text-2xl mb-1">Campaign</p>
              <p className="text-blue-300 text-sm">24 arcs · 120 stages · story progression</p>
              <div className="mt-4 inline-flex items-center gap-2 bg-blue-900/60 border border-blue-700 rounded-full px-3 py-1 text-xs text-blue-300 font-semibold">
                12 anime worlds to conquer
              </div>
            </div>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-8xl opacity-10">🗺️</div>
          </Link>

          {/* Infinite Tower */}
          <Link
            href="/battle/fight?mode=tower"
            className="relative bg-gradient-to-br from-orange-900 to-red-900 hover:from-orange-800 hover:to-red-800 border border-orange-700 rounded-2xl p-7 block overflow-hidden transition-colors"
          >
            <div className="relative z-10">
              <div className="text-4xl mb-3">🗼</div>
              <p className="font-black text-white text-2xl mb-1">Infinite Tower</p>
              <p className="text-orange-300 text-sm">Climb as high as you can · lose = start over</p>
              {!loading && (
                <div className="mt-4 flex gap-3">
                  <div className="inline-flex items-center gap-1.5 bg-orange-900/60 border border-orange-700 rounded-full px-3 py-1 text-xs text-orange-300 font-semibold">
                    📍 Floor {towerFloor}
                  </div>
                  {bestFloor > 0 && (
                    <div className="inline-flex items-center gap-1.5 bg-yellow-900/60 border border-yellow-700 rounded-full px-3 py-1 text-xs text-yellow-300 font-semibold">
                      🏆 Best: {bestFloor}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-8xl opacity-10">⬆️</div>
          </Link>

        </div>
      </div>
    </main>
  )
}
