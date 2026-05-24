'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { calcEffectiveStats, levelUpCost, maxLevelForStars, minCountForStarUp, starUpCopiesNeeded, trainerXpYield, xpToNextLevel } from '@/lib/game/stats'
import { AbilityBadge } from '@/components/AbilityBadge'
import type { Equipment, EquipmentSlot } from '@/lib/game/equipment'

type EquipmentRow = {
  id:                       string
  equipment_key:            string
  equipped_on_character_id: string | null
  item:                     Equipment
}

const SLOT_ORDER: EquipmentSlot[] = ['weapon', 'armor', 'accessory']
const SLOT_LABELS: Record<EquipmentSlot, { label: string; icon: string }> = {
  weapon:    { label: 'Weapon',    icon: '⚔️' },
  armor:     { label: 'Armor',     icon: '🛡️' },
  accessory: { label: 'Accessory', icon: '💎' },
}
const EQ_RARITY_COLOR: Record<Equipment['rarity'], string> = {
  common:    '#9ca3af',
  rare:      '#60a5fa',
  epic:      '#a78bfa',
  legendary: '#facc15',
}

type OwnedCharacter = {
  id: string        // user_characters row id (not used directly)
  count: number
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

const RARITY_STYLES = {
  common:    { border: 'border-gray-700',   badge: 'bg-gray-800 text-gray-400',     label: 'Common',    glow: '',                shimmer: '' },
  rare:      { border: 'border-blue-500',   badge: 'bg-blue-950 text-blue-300',     label: 'Rare',      glow: 'glow-rare',       shimmer: 'card-shimmer' },
  epic:      { border: 'border-violet-500', badge: 'bg-violet-950 text-violet-300', label: 'Epic',      glow: 'glow-epic',       shimmer: 'card-shimmer' },
  legendary: { border: 'border-yellow-400', badge: 'bg-yellow-950 text-yellow-300', label: 'Legendary', glow: 'glow-legendary',  shimmer: 'card-shimmer-legendary' },
}

const RARITY_ORDER = { legendary: 0, epic: 1, rare: 2, common: 3 }
type FilterRarity = 'all' | 'common' | 'rare' | 'epic' | 'legendary'

function StarDisplay({ stars }: { stars: number }) {
  return (
    <span className="text-yellow-400 text-xs tracking-tight">
      {'★'.repeat(stars)}{'☆'.repeat(5 - stars)}
    </span>
  )
}

export default function CollectionPage() {
  const [owned, setOwned] = useState<OwnedCharacter[]>([])
  const [gems, setGems] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterRarity>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<OwnedCharacter | null>(null)
  const [upgrading, setUpgrading] = useState(false)
  const [upgradeMsg, setUpgradeMsg] = useState('')
  // Equipment state
  const [allEquipment, setAllEquipment] = useState<EquipmentRow[]>([])
  const [pickerSlot, setPickerSlot] = useState<EquipmentSlot | null>(null)
  const [equipBusy, setEquipBusy] = useState<string | null>(null)
  // Training state
  const [showTrainPicker, setShowTrainPicker] = useState(false)
  const [selectedTrainers, setSelectedTrainers] = useState<Set<string>>(new Set())
  const [training, setTraining] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const [cardsRes, profileRes, equipRes] = await Promise.all([
      supabase
        .from('user_characters')
        .select('count, level, stars, xp, character:characters(id, name, source_anime, rarity, image_url, base_hp, base_atk, base_def, base_speed)')
        .eq('user_id', user.id),
      supabase.from('profiles').select('gems').eq('user_id', user.id).single(),
      fetch('/api/equipment').then(r => r.ok ? r.json() : { inventory: [] }),
    ])

    setAllEquipment(equipRes.inventory ?? [])

    if (cardsRes.data) {
      const sorted = (cardsRes.data as unknown as OwnedCharacter[]).sort(
        (a, b) => RARITY_ORDER[a.character.rarity] - RARITY_ORDER[b.character.rarity]
      )
      setOwned(sorted)
    }

    if (profileRes.data) setGems(profileRes.data.gems)
    setLoading(false)
  }

  async function levelUp() {
    if (!selected) return
    setUpgrading(true)
    setUpgradeMsg('')

    const res = await fetch('/api/upgrade/level', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterId: selected.character.id }),
    })
    const data = await res.json()

    if (!res.ok) {
      setUpgradeMsg(data.error)
    } else {
      setGems(data.gemsRemaining)
      // Update local state — xp resets to 0 on gem level-up
      const updated = { ...selected, level: data.newLevel, xp: 0 }
      setSelected(updated)
      setOwned(prev => prev.map(o =>
        o.character.id === selected.character.id ? { ...o, level: data.newLevel, xp: 0 } : o
      ))
      const milestoneNote = data.milestoneGems > 0 ? ` 🎯 +${data.milestoneGems}💎 milestone!` : ''
      setUpgradeMsg(`⬆️ Now Level ${data.newLevel}! (−${data.gemsSpent} 💎)${milestoneNote}`)
    }
    setUpgrading(false)
  }

  async function xpLevelUp() {
    if (!selected) return
    setUpgrading(true)
    setUpgradeMsg('')

    const res = await fetch('/api/upgrade/xp-level', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterId: selected.character.id }),
    })
    const data = await res.json()

    if (!res.ok) {
      setUpgradeMsg(data.error)
    } else {
      // Update local state — preserve leftover xp
      const updated = { ...selected, level: data.newLevel, xp: data.newXp }
      setSelected(updated)
      setOwned(prev => prev.map(o =>
        o.character.id === selected.character.id ? { ...o, level: data.newLevel, xp: data.newXp } : o
      ))
      if (data.milestoneGems > 0) {
        setGems(data.gemsTotal)
        setUpgradeMsg(`⬆️ Level ${data.newLevel}! 🎯 Milestone: +${data.milestoneGems} 💎 bonus!`)
      } else {
        setUpgradeMsg(`⬆️ Now Level ${data.newLevel}! (XP used)`)
      }
    }
    setUpgrading(false)
  }

  async function starUp() {
    if (!selected) return
    setUpgrading(true)
    setUpgradeMsg('')

    const res = await fetch('/api/upgrade/star', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterId: selected.character.id }),
    })
    const data = await res.json()

    if (!res.ok) {
      setUpgradeMsg(data.error)
    } else {
      const updated = { ...selected, stars: data.newStars, count: data.countRemaining }
      setSelected(updated)
      setOwned(prev => prev.map(o =>
        o.character.id === selected.character.id
          ? { ...o, stars: data.newStars, count: data.countRemaining }
          : o
      ))
      setUpgradeMsg(`✨ Starred up to ${data.newStars}★! (−${data.copiesConsumed} copies)`)
    }
    setUpgrading(false)
  }

  async function train() {
    if (!selected || selectedTrainers.size === 0) return

    // Safety: confirm before consuming any Epic / Legendary trainer
    const valuable = Array.from(selectedTrainers)
      .map(id => owned.find(o => o.character.id === id))
      .filter((o): o is OwnedCharacter => !!o && (o.character.rarity === 'epic' || o.character.rarity === 'legendary'))
    if (valuable.length > 0) {
      const lines = valuable.map(o => {
        const remaining = (o.count ?? 1) - 1
        const willDelete = remaining < 1
        return `• ${o.character.name} (${o.character.rarity.toUpperCase()}) — ${willDelete ? '🚨 LAST COPY — will be deleted!' : `you'll have ${remaining} left`}`
      }).join('\n')
      const ok = window.confirm(
        `You're about to consume valuable cards:\n\n${lines}\n\nProceed?`,
      )
      if (!ok) return
    }

    setTraining(true); setUpgradeMsg('')
    const res = await fetch('/api/upgrade/train', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetCharacterId:   selected.character.id,
        trainerCharacterIds: Array.from(selectedTrainers),
      }),
    })
    const data = await res.json()
    if (res.ok) {
      // Update target character locally; decrement or remove trainers
      setOwned(prev => prev.flatMap(o => {
        if (o.character.id === selected.character.id) {
          return [{ ...o, level: data.newLevel, xp: data.newXp }]
        }
        if (selectedTrainers.has(o.character.id)) {
          const next = (o.count ?? 1) - 1
          if (next < 1) return []   // last copy consumed → drop from collection
          return [{ ...o, count: next }]
        }
        return [o]
      }))
      setSelected({ ...selected, level: data.newLevel, xp: data.newXp })
      setGems(data.gemsTotal ?? gems)
      const milestoneNote = data.milestoneGems > 0 ? ` 🎯 +${data.milestoneGems}💎 milestone!` : ''
      setUpgradeMsg(`⚡ Trained! +${data.xpGained} XP${data.levelsGained > 0 ? ` (${data.levelsGained} level${data.levelsGained === 1 ? '' : 's'})` : ''}${milestoneNote}`)
      setSelectedTrainers(new Set())
      setShowTrainPicker(false)
    } else {
      setUpgradeMsg(data.error ?? 'Training failed')
    }
    setTraining(false)
  }

  // ─── Equipment handlers ────────────────────────────────────────────────────

  async function equip(equipmentId: string, characterId: string) {
    setEquipBusy(equipmentId)
    const res = await fetch('/api/equipment/equip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ equipmentId, characterId }),
    })
    const data = await res.json()
    if (res.ok) {
      setAllEquipment(prev => prev.map(row => {
        if (row.id === equipmentId) return { ...row, equipped_on_character_id: characterId }
        if (data.unequipped && row.id === data.unequipped.id) return { ...row, equipped_on_character_id: null }
        return row
      }))
      setPickerSlot(null)
    } else {
      setUpgradeMsg(data.error ?? 'Failed to equip')
    }
    setEquipBusy(null)
  }

  async function unequipItem(equipmentId: string) {
    setEquipBusy(equipmentId)
    const res = await fetch('/api/equipment/unequip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ equipmentId }),
    })
    if (res.ok) {
      setAllEquipment(prev => prev.map(row =>
        row.id === equipmentId ? { ...row, equipped_on_character_id: null } : row
      ))
    }
    setEquipBusy(null)
  }

  const filtered = owned.filter(o => {
    const matchRarity = filter === 'all' || o.character.rarity === filter
    const matchSearch = o.character.name.toLowerCase().includes(search.toLowerCase()) ||
                        o.character.source_anime.toLowerCase().includes(search.toLowerCase())
    return matchRarity && matchSearch
  })

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-500 animate-pulse">Loading collection...</div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="text-gray-500 hover:text-gray-300 transition-colors">← Home</Link>
          <h1 className="text-xl font-black">My Collection</h1>
          <span className="text-gray-500 text-sm">{owned.length} cards</span>
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search by name or anime..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-gray-900 text-white placeholder-gray-600 border border-gray-800 rounded-xl px-4 py-3 mb-4 focus:outline-none focus:border-violet-500 transition-colors"
        />

        {/* Rarity filter */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {(['all', 'legendary', 'epic', 'rare', 'common'] as FilterRarity[]).map(r => (
            <button
              key={r}
              onClick={() => setFilter(r)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors capitalize ${
                filter === r
                  ? 'bg-violet-600 text-white'
                  : 'bg-gray-900 text-gray-400 hover:text-white border border-gray-800'
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🎴</div>
            <p className="text-gray-400 font-semibold mb-2">
              {owned.length === 0 ? 'No cards yet' : 'No cards match your filter'}
            </p>
            {owned.length === 0 && (
              <Link href="/pull" className="bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-xl px-6 py-3 transition-colors">
                Pull now →
              </Link>
            )}
          </div>
        )}

        {/* Card grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {filtered.map(o => {
            const style = RARITY_STYLES[o.character.rarity]
            return (
              <button
                key={o.character.id}
                onClick={() => { setSelected(o); setUpgradeMsg('') }}
                className={`relative overflow-hidden bg-gray-900 border-2 ${style.border} ${style.glow} ${style.shimmer} rounded-xl p-3 text-left hover:scale-[1.03] hover:brightness-110 transition-all duration-200`}
              >
                {/* Portrait */}
                <div className="w-full h-28 rounded-lg overflow-hidden mb-2 bg-gray-800">
                  {o.character.image_url ? (
                    <img
                      src={o.character.image_url}
                      alt={o.character.name}
                      className="w-full h-full object-cover face-anchor"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-4xl opacity-30">👤</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between mb-0.5">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${style.badge}`}>{style.label}</span>
                  <StarDisplay stars={o.stars ?? 1} />
                </div>
                <p className="text-white font-bold text-sm mt-1 leading-tight">{o.character.name}</p>
                <p className="text-gray-500 text-xs">{o.character.source_anime}</p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-gray-600 text-xs">Lv {o.level ?? 1}</p>
                  {(o.count ?? 1) > 1 && <p className="text-yellow-600 text-xs font-semibold">×{o.count}</p>}
                </div>
              </button>
            )
          })}
        </div>

      </div>

      {/* Character detail + upgrade modal */}
      {selected && (() => {
        const s = selected
        const style = RARITY_STYLES[s.character.rarity]
        const level = s.level ?? 1
        const stars = s.stars ?? 1
        const count = s.count ?? 1
        const maxLv = maxLevelForStars(stars)
        const lvCost = levelUpCost(level)
        const xp = s.xp ?? 0
        const xpNeeded = xpToNextLevel(level)
        const xpReady = level < maxLv && xp >= xpNeeded
        const canLevel = level < maxLv && gems >= lvCost
        const copiesForStar = starUpCopiesNeeded(stars)
        const minForStar = minCountForStarUp(stars)
        const canStar = stars < 5 && count >= minForStar
        const eff = calcEffectiveStats(s.character, level, stars)

        return (
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 z-50"
            onClick={() => { setSelected(null); setPickerSlot(null); setShowTrainPicker(false); setSelectedTrainers(new Set()) }}
          >
            <div
              className={`bg-gray-900 border-2 ${style.border} rounded-2xl p-5 w-full max-w-sm max-h-[90vh] overflow-y-auto`}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${style.badge}`}>{style.label}</span>
                <button onClick={() => { setSelected(null); setPickerSlot(null); setShowTrainPicker(false); setSelectedTrainers(new Set()) }} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
              </div>

              {/* Portrait */}
              <div className={`relative w-full h-44 rounded-xl overflow-hidden border-2 ${style.border} ${style.glow} ${style.shimmer} mb-4`}>
                {s.character.image_url ? (
                  <img
                    src={s.character.image_url}
                    alt={s.character.name}
                    className="w-full h-full object-cover face-anchor"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                    <span className="text-6xl opacity-20">👤</span>
                  </div>
                )}
              </div>

              {/* Name + stars */}
              <div className="flex items-start justify-between mb-0.5">
                <h2 className="text-xl font-black text-white">{s.character.name}</h2>
                <StarDisplay stars={stars} />
              </div>
              <p className="text-gray-400 text-sm mb-1">{s.character.source_anime}</p>
              <p className="text-gray-600 text-xs mb-3">
                Level {level}/{maxLv} · {count} {count === 1 ? 'copy' : 'copies'}
              </p>

              {/* Signature ability */}
              <div className="mb-4">
                <AbilityBadge characterName={s.character.name} variant="full" />
              </div>

              {/* Equipment slots */}
              {(() => {
                const myEquipped = allEquipment.filter(r => r.equipped_on_character_id === s.character.id)
                const equippedBySlot: Partial<Record<EquipmentSlot, EquipmentRow>> = {}
                for (const row of myEquipped) equippedBySlot[row.item.slot] = row

                return (
                  <div className="mb-4">
                    <p className="font-game text-gray-500 text-[10px] tracking-widest mb-1.5">EQUIPMENT</p>
                    <div className="grid grid-cols-3 gap-2">
                      {SLOT_ORDER.map(slot => {
                        const row = equippedBySlot[slot]
                        const slotMeta = SLOT_LABELS[slot]
                        if (row) {
                          const color = EQ_RARITY_COLOR[row.item.rarity]
                          return (
                            <button
                              key={slot}
                              onClick={() => unequipItem(row.id)}
                              disabled={equipBusy === row.id}
                              title={`${row.item.name} — ${row.item.description}\nClick to unequip.`}
                              className="rounded-lg p-2 text-left transition-all hover:brightness-110 disabled:opacity-50"
                              style={{ background: `${color}15`, border: `1px solid ${color}55` }}
                            >
                              <p className="font-game text-[9px] tracking-widest" style={{ color: '#6b7280' }}>{slotMeta.label.toUpperCase()}</p>
                              <div className="flex items-center gap-1 mt-0.5">
                                <span className="text-base">{row.item.icon}</span>
                                <span className="font-game text-[10px] font-bold truncate" style={{ color }}>{row.item.name}</span>
                              </div>
                            </button>
                          )
                        }
                        return (
                          <button
                            key={slot}
                            onClick={() => setPickerSlot(slot)}
                            className="rounded-lg p-2 text-left transition-colors hover:bg-gray-700"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.15)' }}
                          >
                            <p className="font-game text-[9px] tracking-widest text-gray-600">{slotMeta.label.toUpperCase()}</p>
                            <p className="font-game text-[10px] text-gray-500 mt-0.5">{slotMeta.icon} + Equip</p>
                          </button>
                        )
                      })}
                    </div>

                    {/* Item picker */}
                    {pickerSlot && (
                      <div className="mt-2 rounded-lg p-2" style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.3)' }}>
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="font-game text-[10px] text-purple-300">Choose a {SLOT_LABELS[pickerSlot].label} from {s.character.source_anime}:</p>
                          <button onClick={() => setPickerSlot(null)} className="text-gray-500 hover:text-white text-sm">×</button>
                        </div>
                        {(() => {
                          const eligible = allEquipment.filter(row =>
                            row.item.slot   === pickerSlot &&
                            row.item.anime  === s.character.source_anime &&
                            row.equipped_on_character_id !== s.character.id
                          )
                          if (eligible.length === 0) {
                            return (
                              <p className="font-game text-[10px] text-gray-500 py-2 text-center">No eligible items. Win {s.character.source_anime} battles or buy in shop.</p>
                            )
                          }
                          return (
                            <div className="space-y-1.5">
                              {eligible.map(row => {
                                const color = EQ_RARITY_COLOR[row.item.rarity]
                                const equippedElsewhere = row.equipped_on_character_id && row.equipped_on_character_id !== s.character.id
                                return (
                                  <button
                                    key={row.id}
                                    onClick={() => equip(row.id, s.character.id)}
                                    disabled={equipBusy === row.id}
                                    className="w-full flex items-center gap-2 p-1.5 rounded transition-colors hover:bg-white/10 disabled:opacity-50 text-left"
                                  >
                                    <span className="text-lg">{row.item.icon}</span>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-game text-[11px] font-bold truncate" style={{ color }}>{row.item.name}</p>
                                      <p className="font-game text-[9px] text-gray-500 truncate">{row.item.description}</p>
                                    </div>
                                    {equippedElsewhere && <span className="font-game text-[8px] text-yellow-500">⚠ moves</span>}
                                  </button>
                                )
                              })}
                            </div>
                          )
                        })()}
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Effective stats */}
              <div className="grid grid-cols-4 gap-2 mb-5">
                {[
                  { label: 'HP',  value: eff.hp,    color: 'text-red-400' },
                  { label: 'ATK', value: eff.atk,   color: 'text-orange-400' },
                  { label: 'DEF', value: eff.def,   color: 'text-blue-400' },
                  { label: 'SPD', value: eff.speed, color: 'text-green-400' },
                ].map(stat => (
                  <div key={stat.label} className="bg-gray-800 rounded-xl p-2 text-center">
                    <p className="text-gray-500 text-xs mb-0.5">{stat.label}</p>
                    <p className={`font-black ${stat.color}`}>{stat.value}</p>
                  </div>
                ))}
              </div>

              {/* Upgrade message */}
              {upgradeMsg && (
                <p className={`text-sm mb-3 text-center font-medium ${upgradeMsg.startsWith('⬆️') || upgradeMsg.startsWith('✨') ? 'text-green-400' : 'text-red-400'}`}>
                  {upgradeMsg}
                </p>
              )}

              {/* Level Up */}
              <div className="bg-gray-800 rounded-xl p-3 mb-2">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-white font-bold text-sm">Level Up</p>
                  <p className="text-gray-500 text-xs">Lv {level} / {maxLv}</p>
                </div>

                {/* XP Bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-400">Battle XP</span>
                    <span className={xpReady ? 'text-yellow-400 font-bold animate-pulse' : 'text-gray-500'}>
                      {xp} / {level < maxLv ? xpNeeded : '—'}
                      {xpReady && ' ✦ READY'}
                    </span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${xpReady ? 'bg-yellow-400' : 'bg-emerald-500'}`}
                      style={{ width: level >= maxLv ? '100%' : `${Math.min((xp / xpNeeded) * 100, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Level progress bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-400">Progress</span>
                    <span className="text-gray-600">{level} / {maxLv}</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-violet-500 h-1.5 rounded-full transition-all" style={{ width: `${(level / maxLv) * 100}%` }} />
                  </div>
                </div>

                {/* Buttons */}
                {level >= maxLv ? (
                  <p className="text-gray-500 text-xs text-center py-1">
                    Max level for {stars}★ — star up to continue
                  </p>
                ) : (
                  <div className="flex gap-2">
                    {xpReady && (
                      <button
                        onClick={xpLevelUp}
                        disabled={upgrading}
                        className="flex-1 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-black rounded-lg px-3 py-2 text-sm transition-colors"
                      >
                        {upgrading ? '...' : '⚡ Level Up FREE'}
                      </button>
                    )}
                    <button
                      onClick={levelUp}
                      disabled={!canLevel || upgrading}
                      className={`${xpReady ? '' : 'w-full'} flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-lg px-3 py-2 text-sm transition-colors`}
                    >
                      {upgrading ? '...' : `Fast (${lvCost}💎)`}
                    </button>
                  </div>
                )}
              </div>

              {/* Train — feed any card for XP (with confirmation on epic/legendary) */}
              {level < maxLv && (() => {
                const trainers = owned.filter(o => o.character.id !== s.character.id)
                const previewXp = Array.from(selectedTrainers).reduce((sum, id) => {
                  const t = trainers.find(o => o.character.id === id)
                  if (!t) return sum
                  return sum + trainerXpYield(t.character.rarity, t.level ?? 1)
                }, 0)
                const hasValuableSelected = Array.from(selectedTrainers).some(id => {
                  const t = trainers.find(o => o.character.id === id)
                  return t && (t.character.rarity === 'epic' || t.character.rarity === 'legendary')
                })

                return (
                  <div className="bg-gray-800 rounded-xl p-3 mb-2">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-white font-bold text-sm">🍙 Train</p>
                      <p className="text-gray-500 text-xs">Feed any card for XP</p>
                    </div>

                    {!showTrainPicker ? (
                      <button
                        onClick={() => { setShowTrainPicker(true); setSelectedTrainers(new Set()) }}
                        disabled={trainers.length === 0}
                        className="w-full font-game font-bold text-sm rounded-lg py-2 transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ background: 'rgba(34,197,94,0.18)', border: '1px solid rgba(34,197,94,0.4)', color: '#86efac' }}
                      >
                        {trainers.length === 0
                          ? 'No other cards to train with'
                          : `+ Pick trainer cards (${trainers.length} available)`}
                      </button>
                    ) : (
                      <div>
                        <p className="font-game text-[10px] text-gray-500 mb-2">
                          Select cards to feed (preview: <span className="text-emerald-400 font-bold">+{previewXp} XP</span>):
                        </p>
                        <div className="max-h-44 overflow-y-auto space-y-1 pr-1 mb-2">
                          {trainers.map(t => {
                            const xp = trainerXpYield(t.character.rarity, t.level ?? 1)
                            const isSel = selectedTrainers.has(t.character.id)
                            const isLastCopy = (t.count ?? 1) <= 1
                            const isValuable = t.character.rarity === 'epic' || t.character.rarity === 'legendary'
                            const rarColor = RARITY_STYLES[t.character.rarity].badge.includes('yellow') ? '#facc15'
                                           : RARITY_STYLES[t.character.rarity].badge.includes('violet') ? '#a78bfa'
                                           : RARITY_STYLES[t.character.rarity].badge.includes('blue')   ? '#60a5fa'
                                           :                                                              '#9ca3af'
                            return (
                              <button
                                key={t.character.id}
                                onClick={() => {
                                  const next = new Set(selectedTrainers)
                                  if (next.has(t.character.id)) next.delete(t.character.id)
                                  else next.add(t.character.id)
                                  setSelectedTrainers(next)
                                }}
                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors"
                                style={{
                                  background: isSel ? `${rarColor}22` : 'rgba(255,255,255,0.04)',
                                  border:     isSel ? `1px solid ${rarColor}80` : '1px solid transparent',
                                }}
                              >
                                <div className="w-7 h-7 rounded overflow-hidden bg-gray-900 flex-shrink-0">
                                  {t.character.image_url
                                    ? <img src={t.character.image_url} alt={t.character.name} className="w-full h-full object-cover face-anchor" />
                                    : <span className="block text-center text-lg opacity-40">👤</span>}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-game text-xs font-bold truncate flex items-center gap-1" style={{ color: rarColor }}>
                                    {t.character.name}
                                    {isValuable && <span className="text-[8px]" title="Confirm prompt before consuming">⚠</span>}
                                  </p>
                                  <p className="font-game text-[9px]" style={{ color: isLastCopy ? '#f87171' : '#6b7280' }}>
                                    Lv.{t.level ?? 1} · ×{t.count} {isLastCopy ? '(last copy!)' : 'copies'}
                                  </p>
                                </div>
                                <span className="font-game text-[10px] font-bold text-emerald-400">+{xp} XP</span>
                              </button>
                            )
                          })}
                        </div>
                        {hasValuableSelected && (
                          <p className="font-game text-[10px] text-amber-300 mb-2">
                            ⚠ Selection includes epic/legendary cards. You'll be asked to confirm.
                          </p>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setShowTrainPicker(false); setSelectedTrainers(new Set()) }}
                            disabled={training}
                            className="flex-1 font-game font-bold text-xs rounded-lg py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors disabled:opacity-40"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={train}
                            disabled={training || selectedTrainers.size === 0}
                            className="flex-2 flex-1 font-game font-bold text-xs rounded-lg py-2 transition-all hover:brightness-110 disabled:opacity-40"
                            style={{ background: 'rgba(34,197,94,0.25)', border: '1px solid rgba(34,197,94,0.55)', color: '#86efac' }}
                          >
                            {training ? 'Training...' : `Train (+${previewXp} XP, ${selectedTrainers.size} card${selectedTrainers.size === 1 ? '' : 's'})`}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Star Up */}
              <div className="bg-gray-800 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-bold text-sm">Star Up</p>
                    <p className="text-gray-500 text-xs">
                      {stars >= 5
                        ? 'Already at max stars ★★★★★'
                        : `${stars}★ → ${stars + 1}★ · need ${minForStar} copies (you have ${count})`}
                    </p>
                    {stars < 5 && !canStar && (
                      <p className="text-yellow-700 text-xs mt-0.5">
                        Need {minForStar - count} more {s.character.name} copies
                      </p>
                    )}
                  </div>
                  <button
                    onClick={starUp}
                    disabled={!canStar || upgrading}
                    className="bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-lg px-4 py-2 text-sm transition-colors"
                  >
                    {upgrading ? '...' : `${stars}→${stars + 1}★`}
                  </button>
                </div>
              </div>

            </div>
          </div>
        )
      })()}
    </main>
  )
}
