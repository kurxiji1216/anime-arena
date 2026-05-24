'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  EQUIPMENT_CATALOG,
  SPARKS_BUY,
  type Equipment,
  type EquipmentRarity,
  type EquipmentSlot,
} from '@/lib/game/equipment'

// ─── Types ────────────────────────────────────────────────────────────────────

type InventoryRow = {
  id:                       string
  equipment_key:            string
  equipped_on_character_id: string | null
  acquired_at:              string
  item:                     Equipment
}

type CharacterLookup = Record<string, { name: string; source_anime: string }>

type Tab     = 'inventory' | 'shop'
type SlotFilter = 'all' | EquipmentSlot

// ─── Styling ──────────────────────────────────────────────────────────────────

const RARITY_STYLES: Record<EquipmentRarity, { color: string; border: string; bg: string; label: string }> = {
  common:    { color: '#9ca3af', border: 'rgba(156,163,175,0.4)', bg: 'rgba(156,163,175,0.06)', label: 'Common' },
  rare:      { color: '#60a5fa', border: 'rgba(96,165,250,0.5)',  bg: 'rgba(59,130,246,0.07)',  label: 'Rare' },
  epic:      { color: '#a78bfa', border: 'rgba(167,139,250,0.5)', bg: 'rgba(139,92,246,0.08)',  label: 'Epic' },
  legendary: { color: '#facc15', border: 'rgba(250,204,21,0.55)', bg: 'rgba(234,179,8,0.10)',   label: 'Legendary' },
}

const RARITY_ORDER: EquipmentRarity[] = ['legendary', 'epic', 'rare', 'common']
const SLOT_LABELS: Record<EquipmentSlot, string> = { weapon: '⚔️ Weapon', armor: '🛡️ Armor', accessory: '💎 Accessory' }

const ANIMES = Array.from(new Set(Object.values(EQUIPMENT_CATALOG).map(e => e.anime))).sort()

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EquipmentPage() {
  const [tab,       setTab]       = useState<Tab>('inventory')
  const [sparks,    setSparks]    = useState(0)
  const [inventory, setInventory] = useState<InventoryRow[]>([])
  const [chars,     setChars]     = useState<CharacterLookup>({})
  const [loading,   setLoading]   = useState(true)
  const [busy,      setBusy]      = useState<string | null>(null)
  const [msg,       setMsg]       = useState('')
  const [slotFilter, setSlotFilter] = useState<SlotFilter>('all')
  const [animeFilter, setAnimeFilter] = useState<string>('all')
  const router = useRouter()

  useEffect(() => { load() }, [])

  async function load() {
    const res = await fetch('/api/equipment')
    if (!res.ok) {
      router.push('/login')
      return
    }
    const data = await res.json()
    setSparks(data.sparks)
    setInventory(data.inventory)

    // Hydrate character lookup so we can show "Equipped on X"
    const ids = Array.from(new Set(
      data.inventory.map((r: InventoryRow) => r.equipped_on_character_id).filter(Boolean)
    )) as string[]
    if (ids.length > 0) {
      const charsRes = await fetch(`/api/characters?ids=${ids.join(',')}`)
      if (charsRes.ok) {
        const charsData = await charsRes.json()
        setChars(charsData.characters)
      }
    }

    setLoading(false)
  }

  async function salvage(equipmentId: string, itemName: string) {
    setBusy(equipmentId); setMsg('')
    const res = await fetch('/api/equipment/salvage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ equipmentId }),
    })
    const data = await res.json()
    if (res.ok) {
      setSparks(data.sparksTotal)
      setInventory(prev => prev.filter(r => r.id !== equipmentId))
      setMsg(`+${data.sparksGained} ✦ from ${itemName}`)
    } else {
      setMsg(data.error)
    }
    setBusy(null)
  }

  async function unequip(equipmentId: string) {
    setBusy(equipmentId); setMsg('')
    const res = await fetch('/api/equipment/unequip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ equipmentId }),
    })
    if (res.ok) {
      setInventory(prev => prev.map(r => r.id === equipmentId ? { ...r, equipped_on_character_id: null } : r))
      setMsg('Unequipped')
    }
    setBusy(null)
  }

  async function buy(equipmentKey: string, itemName: string, cost: number) {
    setBusy(equipmentKey); setMsg('')
    const res = await fetch('/api/equipment/buy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ equipmentKey }),
    })
    const data = await res.json()
    if (res.ok) {
      setSparks(data.sparksTotal)
      setMsg(`Bought ${itemName} (−${cost} ✦)`)
      // Refetch inventory
      const invRes = await fetch('/api/equipment')
      if (invRes.ok) {
        const invData = await invRes.json()
        setInventory(invData.inventory)
      }
    } else {
      setMsg(data.error)
    }
    setBusy(null)
  }

  // ─── Derived inventory view ────────────────────────────────────────────────
  const filteredInventory = inventory
    .filter(r => slotFilter === 'all' || r.item.slot === slotFilter)
    .filter(r => animeFilter === 'all' || r.item.anime === animeFilter)
    .sort((a, b) =>
      RARITY_ORDER.indexOf(a.item.rarity) - RARITY_ORDER.indexOf(b.item.rarity)
    )

  // ─── Shop view: catalog grouped by anime, then rarity ──────────────────────
  const shopItems = Object.values(EQUIPMENT_CATALOG)
    .filter(eq => animeFilter === 'all' || eq.anime === animeFilter)
    .filter(eq => slotFilter === 'all' || eq.slot === slotFilter)
    .sort((a, b) =>
      a.anime.localeCompare(b.anime) ||
      RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity)
    )

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: '#06061a' }}>
        <div className="font-game text-purple-400 text-sm animate-pulse tracking-widest">LOADING...</div>
      </main>
    )
  }

  return (
    <main className="min-h-screen text-white pb-10" style={{
      background: 'radial-gradient(ellipse at 50% -5%, #1a0a30 0%, #06061a 60%)',
    }}>
      <div className="max-w-lg mx-auto px-4 pt-4">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <Link href="/" className="font-game text-gray-500 hover:text-gray-300 transition-colors text-sm">← Home</Link>
          <span className="font-game font-bold text-white tracking-widest text-sm">⚙️ EQUIPMENT</span>
          <div className="font-game text-xs flex items-center gap-1">
            <span className="text-purple-400">✦</span>
            <span className="font-bold text-purple-200">{sparks}</span>
          </div>
        </div>

        {/* Tab toggle */}
        <div className="grid grid-cols-2 gap-1 rounded-xl p-1 mb-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          {(['inventory', 'shop'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setMsg('') }}
              className="rounded-lg py-2 font-game text-xs font-bold transition-all uppercase"
              style={{
                background: tab === t ? 'rgba(255,255,255,0.10)' : 'transparent',
                color:      tab === t ? '#fff' : '#6b7280',
                border:     tab === t ? '1px solid rgba(255,255,255,0.12)' : '1px solid transparent',
              }}
            >
              {t === 'inventory' ? `My Items (${inventory.length})` : 'Shop'}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
          {(['all', 'weapon', 'armor', 'accessory'] as SlotFilter[]).map(s => (
            <button
              key={s}
              onClick={() => setSlotFilter(s)}
              className="font-game text-[10px] px-2.5 py-1 rounded-full whitespace-nowrap transition-colors"
              style={{
                background: slotFilter === s ? 'rgba(168,85,247,0.18)' : 'rgba(255,255,255,0.04)',
                border:     slotFilter === s ? '1px solid rgba(168,85,247,0.5)' : '1px solid rgba(255,255,255,0.08)',
                color:      slotFilter === s ? '#e9d5ff' : '#9ca3af',
              }}
            >
              {s === 'all' ? 'ALL' : SLOT_LABELS[s as EquipmentSlot]}
            </button>
          ))}
          <select
            value={animeFilter}
            onChange={e => setAnimeFilter(e.target.value)}
            className="font-game text-[10px] px-2.5 py-1 rounded-full bg-gray-900 border border-gray-700 text-gray-300 outline-none"
          >
            <option value="all">All Anime</option>
            {ANIMES.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        {/* Status message */}
        {msg && (
          <p className="font-game text-xs text-center mb-3 px-3 py-2 rounded-lg" style={{
            background: msg.startsWith('+') || msg.startsWith('Bought') ? 'rgba(34,197,94,0.10)' : 'rgba(239,68,68,0.10)',
            color: msg.startsWith('+') || msg.startsWith('Bought') ? '#86efac' : '#fca5a5',
          }}>
            {msg}
          </p>
        )}

        {/* ── Inventory tab ── */}
        {tab === 'inventory' && (
          <>
            {filteredInventory.length === 0 ? (
              <div className="text-center py-16 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-5xl mb-3">🪶</p>
                <p className="font-game text-gray-500 text-sm mb-2">No items match your filters.</p>
                <p className="font-game text-gray-700 text-xs">Win PvE battles to find equipment.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredInventory.map(row => {
                  const style = RARITY_STYLES[row.item.rarity]
                  const equippedChar = row.equipped_on_character_id ? chars[row.equipped_on_character_id] : null
                  return (
                    <div key={row.id} className="rounded-xl p-3" style={{ background: style.bg, border: `1px solid ${style.border}` }}>
                      <div className="flex items-start gap-3">
                        <div className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 text-2xl" style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${style.border}` }}>
                          {row.item.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <p className="font-game font-bold text-sm" style={{ color: style.color }}>{row.item.name}</p>
                            <span className="font-game text-[9px] tracking-widest" style={{ color: style.color }}>{style.label}</span>
                          </div>
                          <p className="font-game text-[10px] text-gray-500 mb-1">{row.item.anime} · {SLOT_LABELS[row.item.slot]}</p>
                          <p className="font-game text-xs text-gray-400">{row.item.description}</p>
                          {equippedChar && (
                            <p className="font-game text-[10px] mt-1.5" style={{ color: style.color }}>
                              ✓ Equipped on {equippedChar.name}
                            </p>
                          )}
                          <div className="flex gap-2 mt-2">
                            {row.equipped_on_character_id ? (
                              <button
                                onClick={() => unequip(row.id)}
                                disabled={busy === row.id}
                                className="font-game text-[10px] px-3 py-1 rounded-lg transition-all hover:brightness-110 disabled:opacity-40"
                                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#d1d5db' }}
                              >
                                {busy === row.id ? '...' : 'Unequip'}
                              </button>
                            ) : (
                              <span className="font-game text-[10px] px-3 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', color: '#6b7280' }}>
                                Equip via character card
                              </span>
                            )}
                            <button
                              onClick={() => salvage(row.id, row.item.name)}
                              disabled={busy === row.id || !!row.equipped_on_character_id}
                              className="font-game text-[10px] px-3 py-1 rounded-lg transition-all hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed"
                              style={{ background: 'rgba(168,85,247,0.18)', border: '1px solid rgba(168,85,247,0.4)', color: '#e9d5ff' }}
                            >
                              {busy === row.id ? '...' : `Salvage`}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ── Shop tab ── */}
        {tab === 'shop' && (
          <div className="space-y-2">
            <p className="font-game text-[10px] text-gray-600 tracking-widest mb-2">SPEND ✦ SPARKS · SALVAGE ITEMS TO EARN</p>
            {shopItems.map(item => {
              const style = RARITY_STYLES[item.rarity]
              const cost  = SPARKS_BUY[item.rarity]
              const canAfford = sparks >= cost
              return (
                <div key={item.key} className="rounded-xl p-3" style={{ background: style.bg, border: `1px solid ${style.border}` }}>
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 text-2xl" style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${style.border}` }}>
                      {item.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <p className="font-game font-bold text-sm" style={{ color: style.color }}>{item.name}</p>
                        <span className="font-game text-[9px] tracking-widest" style={{ color: style.color }}>{style.label}</span>
                      </div>
                      <p className="font-game text-[10px] text-gray-500 mb-1">{item.anime} · {SLOT_LABELS[item.slot]}</p>
                      <p className="font-game text-xs text-gray-400 mb-2">{item.description}</p>
                      <button
                        onClick={() => buy(item.key, item.name, cost)}
                        disabled={busy === item.key || !canAfford}
                        className="font-game text-[10px] px-3 py-1.5 rounded-lg font-bold transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{
                          background: canAfford ? 'rgba(168,85,247,0.25)' : 'rgba(255,255,255,0.05)',
                          border:     canAfford ? '1px solid rgba(168,85,247,0.55)' : '1px solid rgba(255,255,255,0.08)',
                          color:      canAfford ? '#e9d5ff' : '#6b7280',
                        }}
                      >
                        {busy === item.key ? '...' : `Buy · ${cost} ✦`}
                      </button>
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
