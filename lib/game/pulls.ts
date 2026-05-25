// ─── Gacha pull RNG ───────────────────────────────────────────────────────────
//
// Plain English: this is the math that decides what rarity you pull. Single
// pulls and multi pulls both use this so they behave consistently.
//
// Why crypto.randomInt() instead of Math.random()? Math.random in Node uses
// V8's PRNG, which is unseeded and predictable from observed outputs. For
// gacha — where every roll changes the player's account — using crypto is
// safer and prevents a sophisticated player from exploiting the PRNG.

import { randomInt } from 'node:crypto'

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary'

export const PULL_COST       = 10
export const MULTI_COST      = 100
export const MULTI_COUNT     = 10
export const HARD_PITY       = 90
export const PULL_HISTORY_MAX = 20

// Roll one rarity, with hard pity applied when the counter hits HARD_PITY.
export function pickRarity(pityCounter: number): Rarity {
  if (pityCounter >= HARD_PITY) return 'legendary'
  // 0–9999 → 0.00%–99.99%
  const roll = randomInt(0, 10000) / 100
  if (roll < 2)  return 'legendary'
  if (roll < 10) return 'epic'
  if (roll < 40) return 'rare'
  return 'common'
}

// Roll N rarities starting from `startingPity`, applying hard pity within the
// batch (so multi-pulls honor the same guarantee as singles — fixes C7).
//
// Returns the rarities rolled, the ending pity counter, and a SOFT-PITY flag
// so the caller can upgrade the worst result if no rare+ landed.
export function rollBatchWithPity(
  startingPity: number,
  count: number,
): { rarities: Rarity[]; endPity: number } {
  let pity = startingPity
  const rarities: Rarity[] = []
  for (let i = 0; i < count; i++) {
    const r = pickRarity(pity)
    rarities.push(r)
    pity = r === 'legendary' ? 0 : pity + 1
  }
  return { rarities, endPity: pity }
}

// Apply the "guaranteed rare-or-better per batch" soft pity by upgrading the
// last common to rare if the whole batch came up common.
export function applySoftPity(rarities: Rarity[]): Rarity[] {
  if (rarities.some(r => r !== 'common')) return rarities
  const out = [...rarities]
  out[out.length - 1] = 'rare'
  return out
}
