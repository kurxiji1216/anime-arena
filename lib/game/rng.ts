// ─── Seeded RNG ───────────────────────────────────────────────────────────────
//
// In plain English: when a battle plays out, we want it to be REPLAYABLE.
// If two players see the same battle log, that's because the same seed was used.
// This also makes battles auditable — we can re-run any battle from its seed if
// a player disputes a result.
//
// Math.random() can't do this because it's unseeded. Mulberry32 is a tiny PRNG
// that's good enough for game randomness (NOT for security/crypto).

export type Rng = () => number

export function seedRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Generate a fresh server-side seed (32-bit unsigned int).
// Uses Node's crypto when available, falls back to Math.random for tests.
export function newSeed(): number {
  try {
    // Web Crypto — available in Node 19+ and Edge runtime
    const arr = new Uint32Array(1)
    crypto.getRandomValues(arr)
    return arr[0]
  } catch {
    return Math.floor(Math.random() * 0xffffffff)
  }
}
