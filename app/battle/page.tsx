'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Rarity = 'common' | 'rare' | 'epic' | 'legendary'

type OwnedCharacter = {
  level: number
  stars: number
  character: {
    id: string
    name: string
    source_anime: string
    rarity: Rarity
    image_url: string | null
  }
}

const RARITY_STYLES: Record<Rarity, { border: string; glow: string; badge: string }> = {
  common:    { border: 'border-gray-700',   glow: '',               badge: 'bg-gray-800 text-gray-400' },
  rare:      { border: 'border-blue-500',   glow: 'glow-rare',      badge: 'bg-blue-950 text-blue-300' },
  epic:      { border: 'border-violet-500', glow: 'glow-epic',      badge: 'bg-violet-950 text-violet-300' },
  legendary: { border: 'border-yellow-400', glow: 'glow-legendary', badge: 'bg-yellow-950 text-yellow-300' },
}

const RARITY_ORDER: Record<Rarity, number> = { legendary: 0, epic: 1, rare: 2, common: 3 }

function StarDisplay({ stars }: { stars: number }) {
  return (
    <span className="text-yellow-400 text-xs tracking-tight">
      {'★'.repeat(stars)}{'☆'.repeat(5 - stars)}
    </span>
  )
}

export default function BattleHubPage() {
  const [towerFloor, setTowerFloor] = useState<number>(1)
  const [bestFloor, setBestFloor] = useState<number>(0)
  const [mainId, setMainId] = useState<string | null>(null)
  const [owned, setOwned] = useState<OwnedCharacter[]>([])
  const [loading, setLoading] = useState(true)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const [profileRes, ownedRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('tower_floor, tower_best_floor, main_character_id')
          .eq('user_id', user.id)
          .single(),
        supabase
          .from('user_characters')
          .select('level, stars, character:characters(id, name, source_anime, rarity, image_url)')
          .eq('user_id', user.id),
      ])

      if (profileRes.data) {
        setTowerFloor(profileRes.data.tower_floor ?? 1)
        setBestFloor(profileRes.data.tower_best_floor ?? 0)
        setMainId((profileRes.data as { main_character_id: string | null }).main_character_id ?? null)
      }

      if (ownedRes.data) {
        setOwned(
          (ownedRes.data as unknown as OwnedCharacter[]).sort(
            (a, b) => RARITY_ORDER[a.character.rarity] - RARITY_ORDER[b.character.rarity]
          )
        )
      }
      setLoading(false)
    }
    load()
  }, [])

  async function setMain(characterId: string) {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const { error } = await supabase
      .from('profiles')
      .update({ main_character_id: characterId })
      .eq('user_id', user.id)

    if (!error) setMainId(characterId)
    setSaving(false)
    setPickerOpen(false)
  }

  const mainCard = mainId ? owned.find(o => o.character.id === mainId) ?? null : null

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-lg mx-auto">

        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="text-gray-500 hover:text-gray-300 transition-colors">← Home</Link>
          <h1 className="text-xl font-black">Battle</h1>
          <div className="w-16" />
        </div>

        {/* Main Card widget */}
        {!loading && (
          <div className="mb-5">
            <p className="font-game text-gray-500 text-[10px] tracking-widest mb-2">★ MAIN CARD</p>
            <button
              onClick={() => setPickerOpen(true)}
              className="w-full bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 rounded-2xl p-3 flex items-center gap-3 transition-colors text-left"
            >
              {mainCard ? (
                <>
                  <div className={`relative w-16 h-16 rounded-xl overflow-hidden border-2 ${RARITY_STYLES[mainCard.character.rarity].border} ${RARITY_STYLES[mainCard.character.rarity].glow} flex-shrink-0`}>
                    {mainCard.character.image_url ? (
                      <img src={mainCard.character.image_url} alt={mainCard.character.name} className="w-full h-full object-cover face-anchor" />
                    ) : (
                      <div className="w-full h-full bg-gray-800 flex items-center justify-center text-2xl opacity-25">👤</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-sm truncate">{mainCard.character.name}</p>
                    <p className="text-gray-500 text-xs truncate">{mainCard.character.source_anime}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-game text-[10px] text-gray-400">Lv.{mainCard.level ?? 1}</span>
                      <StarDisplay stars={mainCard.stars ?? 1} />
                    </div>
                  </div>
                  <span className="text-gray-600 text-xs font-game">SWAP →</span>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-700 flex items-center justify-center flex-shrink-0">
                    <span className="text-3xl opacity-40">★</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-bold text-sm">Pick your main card</p>
                    <p className="text-gray-500 text-xs">Auto-used in every battle</p>
                  </div>
                  <span className="text-violet-400 text-xs font-game">PICK →</span>
                </>
              )}
            </button>
          </div>
        )}

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

      {/* Main card picker modal */}
      {pickerOpen && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 z-50"
          onClick={() => setPickerOpen(false)}
        >
          <div
            className="bg-gray-900 border border-gray-800 rounded-2xl p-5 w-full max-w-sm max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-black text-lg">Pick your main</h2>
              <button onClick={() => setPickerOpen(false)} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
            </div>

            {owned.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-5xl mb-3">🎴</p>
                <p className="text-gray-400 mb-4 font-game text-sm">No characters yet!</p>
                <Link href="/pull" className="bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-xl px-6 py-3 transition-colors font-game text-sm">
                  Pull some cards →
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {owned.map(o => {
                  const style = RARITY_STYLES[o.character.rarity]
                  const isMain = o.character.id === mainId
                  return (
                    <button
                      key={o.character.id}
                      disabled={saving}
                      onClick={() => setMain(o.character.id)}
                      className={`relative overflow-hidden rounded-xl border-2 text-left transition-all duration-200 disabled:opacity-50 ${
                        isMain
                          ? `${style.border} ${style.glow} scale-[1.05]`
                          : 'border-gray-800 hover:border-gray-700 hover:scale-[1.02]'
                      }`}
                      style={{ background: isMain ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)' }}
                    >
                      {isMain && (
                        <div className="absolute top-1 right-1 z-10 bg-yellow-500 text-black text-[9px] font-bold rounded-full px-1.5 py-0.5 leading-none">
                          ★ MAIN
                        </div>
                      )}
                      <div className="relative w-full h-20 overflow-hidden bg-gray-900">
                        {o.character.image_url ? (
                          <img src={o.character.image_url} alt={o.character.name} className="w-full h-full object-cover face-anchor" />
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
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
