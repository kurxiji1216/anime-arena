import type { Ability } from './abilities'
import { seedRng, newSeed, type Rng } from './rng'

// ─── Public types ─────────────────────────────────────────────────────────────

export type BattleFighter = {
  name:       string
  base_hp:    number
  base_atk:   number
  base_def:   number
  base_speed: number
  ability?:   Ability | null
}

export type BattleLogEntry = {
  message:  string
  playerHp: number
  enemyHp:  number
}

export type Winner = 'player' | 'enemy' | 'draw'

export type BattleResult = {
  winner:      Winner
  log:         BattleLogEntry[]
  playerMaxHp: number
  enemyMaxHp:  number
  playerName:  string
  enemyName:   string
  seed:        number   // server-generated seed — store this to replay the battle
}

// ─── Internal state ───────────────────────────────────────────────────────────

type FighterState = {
  // Identity
  name:    string
  ability: Ability | null
  isPlayer: boolean

  // Current mutable stats (computed each turn from base + buffs)
  hp:    number
  maxHp: number
  atk:   number
  def:   number
  speed: number

  // Base stats (immutable references for this battle)
  baseAtk:   number
  baseDef:   number
  baseSpeed: number

  // Persistent buff deltas (added on top of base, never wiped)
  persistentAtkBuff:   number   // flat ATK added by long-term buffs (Luffy turn-3, Kakashi copy, etc.)
  persistentDefBuff:   number
  persistentSpeedBuff: number

  // Temporary debuffs (subtracted, expire after N rounds)
  speedDebuffAmount: number
  speedDebuffRounds: number

  // Action counters
  ownAttackCount:   number
  hitsTakenCount:   number

  // Statuses
  stunnedAttacks:   number
  burning:          boolean
  burnPct:          number

  // First-strike flags
  firstStrike:         boolean

  // First-N-attacks defensive trackers
  firstNAttacksReductionRemaining: number
  firstNAttacksReductionPct:       number
  firstNAttacksDodgeRemaining:     number

  // One-time triggers (used flags)
  copyAtkUsed:            boolean
  reviveUsed:             boolean
  surviveFatalUsed:       boolean
  lowHpFired:             boolean
  tsunadeHealUsed:        boolean
  biscuitTransformUsed:   boolean
  patternRecogFired:      boolean

  // Active ability runtime state
  lifestealPct:           number
  passiveRegenPct:        number

  // Prevents extraAttackChance from recursing infinitely without mutating the
  // shared ability object (which would corrupt other concurrent battles).
  inExtraAttack:          boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initFighter(f: BattleFighter, isPlayer: boolean): FighterState {
  const ability = f.ability ?? null
  const eff = ability?.effect

  let hp    = f.base_hp
  let atk   = f.base_atk
  let def   = f.base_def
  let speed = f.base_speed

  if (eff?.statBuffPct) {
    if (eff.statBuffPct.hp)    hp    = Math.round(hp    * (1 + eff.statBuffPct.hp))
    if (eff.statBuffPct.atk)   atk   = Math.round(atk   * (1 + eff.statBuffPct.atk))
    if (eff.statBuffPct.def)   def   = Math.round(def   * (1 + eff.statBuffPct.def))
    if (eff.statBuffPct.speed) speed = Math.round(speed * (1 + eff.statBuffPct.speed))
  }

  return {
    name:    f.name,
    ability,
    isPlayer,
    hp,
    maxHp:   hp,
    atk,
    def,
    speed,
    baseAtk:   atk,
    baseDef:   def,
    baseSpeed: speed,

    persistentAtkBuff:   0,
    persistentDefBuff:   0,
    persistentSpeedBuff: 0,

    speedDebuffAmount: 0,
    speedDebuffRounds: 0,

    ownAttackCount: 0,
    hitsTakenCount: 0,

    stunnedAttacks:    0,
    burning:           false,
    burnPct:           0,

    firstStrike: eff?.firstStrike ?? false,

    firstNAttacksReductionRemaining: eff?.firstNAttacksReduction?.count ?? 0,
    firstNAttacksReductionPct:       eff?.firstNAttacksReduction?.pct   ?? 0,
    firstNAttacksDodgeRemaining:     eff?.firstNAttacksDodge ?? 0,

    copyAtkUsed:          false,
    reviveUsed:           false,
    surviveFatalUsed:     false,
    lowHpFired:           false,
    tsunadeHealUsed:      false,
    biscuitTransformUsed: false,
    patternRecogFired:    false,

    lifestealPct:    eff?.lifestealPct ?? 0,
    passiveRegenPct: 0,

    inExtraAttack: false,
  }
}

function pushLog(log: BattleLogEntry[], a: FighterState, b: FighterState, message: string) {
  log.push({
    message,
    playerHp: a.isPlayer ? a.hp : b.hp,
    enemyHp:  a.isPlayer ? b.hp : a.hp,
  })
}

function calcRawDamage(atk: number, def: number, ignoreDef: boolean): number {
  return Math.max(1, atk - (ignoreDef ? 0 : Math.floor(def / 2)))
}

function applyHeal(f: FighterState, pct: number): number {
  const heal = Math.floor(f.maxHp * pct)
  const before = f.hp
  f.hp = Math.min(f.maxHp, f.hp + heal)
  return f.hp - before
}

// ─── The unified damage gate ───────────────────────────────────────────────────
//
// Plain English: every time HP goes down — from a hit, a counter, a redirect,
// a burn, an instant-kill — we route it through this one function. That way
// every survive-fatal / revive ability gets its chance to fire, no matter how
// the damage was dealt. This is the fix for C11.
function applyDamageToHp(
  d: FighterState,
  dmg: number,
  source: FighterState,
  log: BattleLogEntry[],
) {
  d.hp = Math.max(0, d.hp - dmg)
  if (d.hp > 0 || !d.ability) return
  const de = d.ability.effect
  if (de.surviveFatalOnce && !d.surviveFatalUsed) {
    d.hp = 1
    d.surviveFatalUsed = true
    pushLog(log, d, source, `${d.ability.icon} ${d.name} survives with 1 HP!`)
  } else if (de.reviveOnce && !d.reviveUsed) {
    const reviveHp = Math.max(1, Math.round(d.maxHp * de.reviveOnce.hpPct))
    d.hp = reviveHp
    d.reviveUsed = true
    pushLog(log, d, source, `${d.ability.icon} ${d.name} reforms at ${reviveHp} HP!`)
  }
}

// ─── Recalculate displayed stats from base + persistent + temporary ───────────
//
// Plain English: instead of overwriting `f.speed` directly when a buff expires
// (which wipes any other buffs that stacked on top), we keep separate buckets
// for persistent buffs and temporary debuffs and re-derive the final stat.
// This fixes H1 (speed-debuff expiry wiping other buffs).
function recalcStats(f: FighterState) {
  f.atk   = Math.max(1, f.baseAtk   + f.persistentAtkBuff)
  f.def   = Math.max(1, f.baseDef   + f.persistentDefBuff)
  f.speed = Math.max(1, f.baseSpeed + f.persistentSpeedBuff - f.speedDebuffAmount)
}

// Apply a percentage buff that LASTS the rest of the fight (e.g., Luffy Gear Second).
function addPersistentBuffPct(f: FighterState, kind: 'atk' | 'def' | 'speed', pct: number) {
  if (kind === 'atk')   f.persistentAtkBuff   += Math.round(f.baseAtk   * pct)
  if (kind === 'def')   f.persistentDefBuff   += Math.round(f.baseDef   * pct)
  if (kind === 'speed') f.persistentSpeedBuff += Math.round(f.baseSpeed * pct)
  recalcStats(f)
}

// ─── Round-start phase ────────────────────────────────────────────────────────

function processRoundStart(
  f:    FighterState,
  opp:  FighterState,
  round: number,
  log:  BattleLogEntry[],
) {
  if (!f.ability) return
  const eff = f.ability.effect

  // Per-turn HP regen (passive)
  const regen = (eff.regenPct ?? 0) + f.passiveRegenPct
  if (regen > 0 && f.hp > 0 && f.hp < f.maxHp) {
    const healed = applyHeal(f, regen)
    if (healed > 0) {
      pushLog(log, f, opp, `${f.ability.icon} ${f.name}'s ${f.ability.name} restores ${healed} HP.`)
    }
  }

  // Every-N-turns heal (Historia)
  if (eff.regenEveryNTurns && round > 1 && (round - 1) % eff.regenEveryNTurns.turns === 0) {
    const healed = applyHeal(f, eff.regenEveryNTurns.pct)
    if (healed > 0) {
      pushLog(log, f, opp, `👑 ${f.name}'s ${f.ability.name} heals ${healed} HP.`)
    }
  }

  // Burn DoT — routed through applyDamageToHp so revive can save us
  if (f.burning && f.hp > 0) {
    const burnDmg = Math.max(1, Math.floor(f.maxHp * f.burnPct))
    applyDamageToHp(f, burnDmg, opp, log)
    pushLog(log, f, opp, `🔥 ${f.name} burns for ${burnDmg} dmg.`)
  }
  if (f.hp <= 0) return

  // ATK ramp — persistent buff (so a debuff later doesn't wipe it)
  if (eff.atkRampPct) {
    f.persistentAtkBuff = Math.round(
      (f.baseAtk + f.persistentAtkBuff) * eff.atkRampPct + f.persistentAtkBuff,
    )
    recalcStats(f)
  }

  // DEF ramp
  if (eff.defRampPct) {
    f.persistentDefBuff = Math.round(
      (f.baseDef + f.persistentDefBuff) * eff.defRampPct + f.persistentDefBuff,
    )
    recalcStats(f)
  }

  // Enemy ATK ramp-down (Eren Founding Titan)
  if (eff.enemyAtkRampDownPct) {
    opp.persistentAtkBuff -= Math.round((opp.baseAtk + opp.persistentAtkBuff) * eff.enemyAtkRampDownPct)
    recalcStats(opp)
  }

  // Alternating buff (Todoroki) — temporary, swaps each round
  if (eff.alternatingBuff) {
    // Reset, then apply just this round's flavor
    f.persistentAtkBuff = 0
    f.persistentDefBuff = 0
    if (round % 2 === 1) {
      f.persistentAtkBuff = Math.round(f.baseAtk * eff.alternatingBuff.atkPct)
    } else {
      f.persistentDefBuff = Math.round(f.baseDef * eff.alternatingBuff.defPct)
    }
    recalcStats(f)
  }

  // First-turn ATK boost (Maes Hughes) — apply on round 1, undo on round 2.
  // Using persistent-buff bucket so other buffs don't get clobbered when we revert.
  if (eff.firstTurnAtkBoost) {
    if (round === 1) {
      f.persistentAtkBuff += Math.round(f.baseAtk * eff.firstTurnAtkBoost)
      recalcStats(f)
    } else if (round === 2) {
      f.persistentAtkBuff -= Math.round(f.baseAtk * eff.firstTurnAtkBoost)
      recalcStats(f)
    }
  }

  // ─── Turn-X triggers ──────────────────────────────────────────────────────

  if (eff.turnXStun && eff.turnXStun.turn === round) {
    opp.stunnedAttacks += eff.turnXStun.turns
    pushLog(log, f, opp, `${f.ability.icon} ${f.name}'s ${f.ability.name}! ${opp.name} is stunned!`)
  }

  // Luffy: gain buff permanently after round X (persistent so debuffs don't wipe it)
  if (eff.turnXBuff && eff.turnXBuff.turn === round) {
    addPersistentBuffPct(f, 'atk', eff.turnXBuff.atkPct)
    if (eff.turnXBuff.speedPct) addPersistentBuffPct(f, 'speed', eff.turnXBuff.speedPct)
    pushLog(log, f, opp, `${f.ability.icon} ${f.name}'s ${f.ability.name}! ATK and Speed boosted!`)
  }

  // Eren transform
  if (eff.turnXTransform && eff.turnXTransform.turn === round) {
    const hpAdd = Math.round(f.maxHp * eff.turnXTransform.hpAddPct)
    f.maxHp += hpAdd
    f.hp += hpAdd
    addPersistentBuffPct(f, 'atk', eff.turnXTransform.atkPct)
    pushLog(log, f, opp, `${f.ability.icon} ${f.name} transforms! HP +${hpAdd}, ATK boosted!`)
  }

  // Law: swap ATK on round X if opponent's is higher
  if (eff.turnXSwapAtkIfEnemyHigher && eff.turnXSwapAtkIfEnemyHigher.turn === round) {
    if (opp.atk > f.atk) {
      const tmp = f.atk
      f.atk = opp.atk
      opp.atk = tmp
      // Snapshot the swapped values into the persistent bucket so re-calc preserves them
      f.persistentAtkBuff   = f.atk - f.baseAtk
      opp.persistentAtkBuff = opp.atk - opp.baseAtk
      pushLog(log, f, opp, `${f.ability.icon} ${f.name}'s ${f.ability.name}! ATK swapped with ${opp.name}!`)
    }
  }
}

// ─── HP threshold triggers (checked after damage) ─────────────────────────────

function checkHpTriggers(f: FighterState, log: BattleLogEntry[], opp: FighterState) {
  if (!f.ability || f.hp <= 0) return
  const eff = f.ability.effect
  const hpFrac = f.hp / f.maxHp

  if (eff.lowHpAtkBoost && !f.lowHpFired && hpFrac < eff.lowHpAtkBoost.threshold) {
    const lb = eff.lowHpAtkBoost
    addPersistentBuffPct(f, 'atk', lb.atkPct)
    if (lb.speedPct) addPersistentBuffPct(f, 'speed', lb.speedPct)
    if (lb.lifestealPct) f.lifestealPct = lb.lifestealPct
    if (lb.regenPct) f.passiveRegenPct = lb.regenPct
    if (lb.firstStrikeWhenTriggered) f.firstStrike = true
    f.lowHpFired = true
    pushLog(log, f, opp, `${f.ability.icon} ${f.name} unleashes ${f.ability.name}!`)
  }

  if (eff.lowHpHealOnce && !f.tsunadeHealUsed && hpFrac < eff.lowHpHealOnce.threshold) {
    const healed = applyHeal(f, eff.lowHpHealOnce.pct)
    f.tsunadeHealUsed = true
    pushLog(log, f, opp, `💯 ${f.name}'s ${f.ability.name}! Restored ${healed} HP!`)
  }

  if (eff.lowHpTransform && !f.biscuitTransformUsed && hpFrac < eff.lowHpTransform.threshold) {
    const hpAdd = Math.round(f.maxHp * eff.lowHpTransform.hpAddPct)
    f.maxHp += hpAdd
    f.hp += hpAdd
    addPersistentBuffPct(f, 'atk', eff.lowHpTransform.atkPct)
    f.biscuitTransformUsed = true
    pushLog(log, f, opp, `${f.ability.icon} ${f.name} reveals true form! HP +${hpAdd}, ATK up!`)
  }
}

// ─── Single hit application ───────────────────────────────────────────────────

function applyHit(
  a:        FighterState,
  d:        FighterState,
  rawDmg:   number,
  isFirstOfAttack: boolean,
  log:      BattleLogEntry[],
  rng:      Rng,
): number {
  let dmg = Math.max(1, Math.floor(rawDmg))

  // ─── Damage reduction (multiplicative stacking, with consumption only when applicable) ───
  // Plain English: instead of taking the single biggest reduction (which was the
  // old behavior — Math.max — and wasted Reiner charges), we multiply the
  // "kept" fraction across every active source. Floor at 5% kept so a stack of
  // reductions can never fully nullify damage.
  let keptFrac = 1.0
  const de = d.ability?.effect

  if (de?.firstAttackReductionPct && d.hitsTakenCount === 0) {
    keptFrac *= 1 - de.firstAttackReductionPct
  }
  if (d.firstNAttacksReductionRemaining > 0) {
    keptFrac *= 1 - d.firstNAttacksReductionPct
    d.firstNAttacksReductionRemaining--
  }
  if (de?.damageReductionPct) {
    keptFrac *= 1 - de.damageReductionPct
  }
  if (de?.lowHpDamageReduction && d.hp / d.maxHp < de.lowHpDamageReduction.threshold) {
    keptFrac *= 1 - de.lowHpDamageReduction.pct
  }
  keptFrac = Math.max(0.05, keptFrac)
  dmg = Math.max(1, Math.floor(dmg * keptFrac))

  // Mello: first hit taken deals extra
  if (de?.firstHitTakenBonusPct && d.hitsTakenCount === 0) {
    dmg = Math.floor(dmg * (1 + de.firstHitTakenBonusPct))
  }

  applyDamageToHp(d, dmg, a, log)
  d.hitsTakenCount++

  // ─── On-hit-taken effects on defender ────────────────────────────────────

  if (de?.copyAtkOnFirstHit && !d.copyAtkUsed) {
    const buff = Math.round(a.atk * de.copyAtkOnFirstHit)
    d.persistentAtkBuff += buff
    recalcStats(d)
    d.copyAtkUsed = true
    pushLog(log, d, a, `📖 ${d.name} copies ${buff} ATK!`)
  }

  if (de?.painPackerPct) {
    d.persistentAtkBuff += Math.round((d.baseAtk + d.persistentAtkBuff) * de.painPackerPct)
    recalcStats(d)
  }

  if (de?.absorbPct && d.hp > 0) {
    const heal = Math.floor(dmg * de.absorbPct)
    const before = d.hp
    d.hp = Math.min(d.maxHp, d.hp + heal)
    if (d.hp > before) {
      pushLog(log, d, a, `🔋 ${d.name} absorbs ${d.hp - before} HP!`)
    }
  }

  // Counter (Hisoka) — routes through applyDamageToHp so attacker can survive/revive
  if (de?.counterPct && a.hp > 0) {
    const counter = Math.max(1, Math.floor(dmg * de.counterPct))
    applyDamageToHp(a, counter, d, log)
    pushLog(log, d, a, `🃏 ${d.name}'s ${d.ability!.name} returns ${counter} dmg!`)
  }

  // ─── On-hit effects from attacker (apply to defender) ────────────────────
  const ae = a.ability?.effect

  if (ae?.burnOnHitChance && !d.burning && rng() < ae.burnOnHitChance.chance) {
    d.burning = true
    d.burnPct = ae.burnOnHitChance.pct
    pushLog(log, a, d, `🔥 ${a.name} sets ${d.name} ablaze!`)
  }

  if (ae?.enemyBurnPct && !d.burning && isFirstOfAttack) {
    d.burning = true
    d.burnPct = ae.enemyBurnPct
    pushLog(log, a, d, `🩸 ${a.name}'s ${a.ability!.name} ignites ${d.name}!`)
  }

  if (ae?.enemyDefDecayPct) {
    d.persistentDefBuff -= Math.round((d.baseDef + d.persistentDefBuff) * ae.enemyDefDecayPct)
    recalcStats(d)
  }

  if (ae?.stunChance && rng() < ae.stunChance.chance) {
    d.stunnedAttacks += ae.stunChance.turns
    pushLog(log, a, d, `${a.ability!.icon} ${a.name} stuns ${d.name} for ${ae.stunChance.turns} turn(s)!`)
  }

  if (a.lifestealPct > 0 && a.hp > 0) {
    const heal = Math.floor(dmg * a.lifestealPct)
    a.hp = Math.min(a.maxHp, a.hp + heal)
  }

  checkHpTriggers(d, log, a)

  return dmg
}

// ─── Attempt an attack ────────────────────────────────────────────────────────

function attemptAttack(
  a:    FighterState,
  d:    FighterState,
  round: number,
  log:  BattleLogEntry[],
  rng:  Rng,
) {
  if (a.stunnedAttacks > 0) {
    a.stunnedAttacks--
    pushLog(log, a, d, `💫 ${a.name} is stunned and can't move!`)
    return
  }

  a.ownAttackCount++
  const isFirstAttack = a.ownAttackCount === 1
  const ae = a.ability?.effect

  // Dodge rolls
  const dodgePct = d.ability?.effect.dodgeChance ?? 0
  if (dodgePct > 0 && rng() < dodgePct) {
    pushLog(log, a, d, `${d.ability!.icon} ${d.name} dodges ${a.name}'s attack!`)
    return
  }
  if (d.firstNAttacksDodgeRemaining > 0) {
    d.firstNAttacksDodgeRemaining--
    pushLog(log, a, d, `🍰 ${d.name} foresees and dodges!`)
    return
  }
  if (d.ability?.effect.redirectChance && rng() < d.ability.effect.redirectChance) {
    pushLog(log, a, d, `📍 ${d.name} redirects the attack back to ${a.name}!`)
    const rawDmg = calcRawDamage(a.atk, 0, true)
    applyDamageToHp(a, rawDmg, d, log)
    pushLog(log, a, d, `📍 ${a.name} takes ${rawDmg} dmg from their own attack!`)
    return
  }

  // Rem turn-X sacrifice — pay HP cost just before the attack
  if (ae?.turnXSacrifice && ae.turnXSacrifice.turn === round) {
    const cost = Math.floor(a.maxHp * ae.turnXSacrifice.selfHpPct)
    a.hp = Math.max(1, a.hp - cost)
    pushLog(log, a, d, `💀 ${a.name} sacrifices ${cost} HP for ${a.ability!.name}!`)
  }

  // ─── Determine hit configuration ──────────────────────────────────────────
  let hitCount = 1
  let damagePerHitPct = 1.0
  let attackFlavor = ''

  if (isFirstAttack && ae?.openerMultiHit) {
    hitCount = ae.openerMultiHit.count
    damagePerHitPct = ae.openerMultiHit.damagePct
    attackFlavor = `${a.ability!.icon} ${a.name}'s ${a.ability!.name}!`
  } else if (ae?.alwaysMultiHit) {
    hitCount = ae.alwaysMultiHit.count
    damagePerHitPct = ae.alwaysMultiHit.damagePct
    attackFlavor = `${a.ability!.icon} ${a.name} uses ${a.ability!.name}!`
  } else if (ae?.multiHitChance && rng() < ae.multiHitChance.chance) {
    hitCount = ae.multiHitChance.count
    damagePerHitPct = ae.multiHitChance.damagePct
    attackFlavor = `${a.ability!.icon} ${a.name}'s ${a.ability!.name}! ${hitCount}× attack!`
  }

  let dmgMult = 1.0
  let ignoreDef = false
  let bonusFlat = 0
  let critMult  = 1.0

  if (isFirstAttack && ae?.openerIgnoreDef) ignoreDef = true
  if (ae?.ignoreDefChance && rng() < ae.ignoreDefChance) ignoreDef = true

  if (ae?.turnXAttack && ae.turnXAttack.turn === round) {
    dmgMult *= ae.turnXAttack.mult
    if (ae.turnXAttack.ignoreDef) ignoreDef = true
    attackFlavor = `${a.ability!.icon} ${a.name}'s ${a.ability!.name}!`
  }

  if (ae?.turnXSacrifice && ae.turnXSacrifice.turn === round) {
    dmgMult *= ae.turnXSacrifice.damageMult
    attackFlavor = `💀 ${a.name}'s ${a.ability!.name}!`
  }

  if (ae?.turnXBonusEnemyMaxHp && ae.turnXBonusEnemyMaxHp.turn === round) {
    const bonus = Math.floor(d.maxHp * ae.turnXBonusEnemyMaxHp.enemyMaxHpPct)
    bonusFlat += bonus
    attackFlavor = `⚾ ${a.name}'s ${a.ability!.name}! Bonus ${bonus} dmg!`
  }

  if (ae?.chargeRelease) {
    if (a.ownAttackCount <= ae.chargeRelease.chargeTurns) {
      dmgMult *= ae.chargeRelease.chargePct
      attackFlavor = `✊ ${a.name} is charging Jajanken...`
    } else {
      dmgMult *= ae.chargeRelease.releaseMult
      attackFlavor = `✊ ${a.name}'s Jajanken unleashed!`
    }
  }

  if (ae?.bonusDamageFromOwnDefPct) {
    bonusFlat += Math.floor(a.def * ae.bonusDamageFromOwnDefPct)
  }
  if (ae?.bonusDamageFromEnemyMaxHpPct) {
    bonusFlat += Math.floor(d.maxHp * ae.bonusDamageFromEnemyMaxHpPct)
  }
  if (ae?.chanceMaxHpDmg && rng() < ae.chanceMaxHpDmg.chance) {
    const bonus = Math.floor(d.maxHp * ae.chanceMaxHpDmg.enemyMaxHpPct)
    bonusFlat += bonus
    pushLog(log, a, d, `⏳ ${a.name}'s ${a.ability!.name}! +${bonus} dmg!`)
  }

  if (isFirstAttack && ae?.openerCrit) {
    critMult = ae.openerCrit.mult
  } else if (ae?.critChance && rng() < ae.critChance) {
    critMult = ae.critMult ?? 2.0
    pushLog(log, a, d, `💥 ${a.name}'s ${a.ability!.name} crits!`)
  }

  if (ae?.everyNthDouble && a.ownAttackCount > 0 && a.ownAttackCount % ae.everyNthDouble === 0) {
    critMult = Math.max(critMult, 2.0)
    pushLog(log, a, d, `🦵 ${a.name}'s ${a.ability!.name}! Double damage!`)
  }

  if (ae?.aboveHpAtkBoost && a.hp / a.maxHp >= ae.aboveHpAtkBoost.threshold) {
    dmgMult *= (1 + ae.aboveHpAtkBoost.atkPct)
  }

  if (ae?.afterEnemyAttacksBuff && !a.patternRecogFired
      && d.ownAttackCount >= ae.afterEnemyAttacksBuff.count) {
    addPersistentBuffPct(a, 'atk', ae.afterEnemyAttacksBuff.atkPct)
    a.patternRecogFired = true
    pushLog(log, a, d, `♟️ ${a.name}'s ${a.ability!.name}! ATK +${Math.round(ae.afterEnemyAttacksBuff.atkPct * 100)}%!`)
  }

  // Instant-kill — now routed through applyDamageToHp so survive/revive can save the target
  if (ae?.instantKillPerTurnChance && rng() < ae.instantKillPerTurnChance) {
    pushLog(log, a, d, `${a.ability!.icon} ${a.name}'s ${a.ability!.name}! ${d.name} is instantly defeated!`)
    applyDamageToHp(d, d.hp, a, log)
    return
  }

  if (attackFlavor) pushLog(log, a, d, attackFlavor)

  const baseRaw = calcRawDamage(a.atk, d.def, ignoreDef)
  let totalDmgDealt = 0

  for (let i = 0; i < hitCount && d.hp > 0; i++) {
    let raw = Math.floor(baseRaw * damagePerHitPct * dmgMult)
    if (i === 0) {
      raw = Math.floor(raw * critMult)
      raw += bonusFlat
    }
    const dealt = applyHit(a, d, raw, i === 0, log, rng)
    totalDmgDealt += dealt
    if (a.hp <= 0) break
  }

  if (totalDmgDealt > 0) {
    if (d.hp <= 0) {
      pushLog(log, a, d, `💥 ${a.name} defeats ${d.name}!`)
    } else {
      pushLog(log, a, d, `⚔️ ${a.name} hits ${d.name} for ${totalDmgDealt} dmg. (${d.name}: ${d.hp} HP)`)
    }
  }

  if (isFirstAttack && ae?.openerSpeedDebuff) {
    const debuff = Math.round(d.baseSpeed * ae.openerSpeedDebuff.pct)
    d.speedDebuffAmount = Math.max(d.speedDebuffAmount, debuff)
    d.speedDebuffRounds = ae.openerSpeedDebuff.turns
    recalcStats(d)
    pushLog(log, a, d, `🟣 ${a.name}'s ${a.ability!.name}! ${d.name}'s speed dropped!`)
  }

  // Extra attack chance — uses a per-fighter flag (no shared-state mutation).
  // The follow-up is a "lite" attack: it goes through applyHit so on-hit effects
  // (lifesteal, stun chance, burn) still fire, but it doesn't roll multi-hit / crit
  // / charge-release procs again — that keeps balance predictable.
  if (!a.inExtraAttack && ae?.extraAttackChance && d.hp > 0 && a.hp > 0
      && rng() < ae.extraAttackChance) {
    pushLog(log, a, d, `⚡ ${a.name} strikes again!`)
    a.inExtraAttack = true
    try {
      const raw = calcRawDamage(a.atk, d.def, false)
      const dealt = applyHit(a, d, raw, false, log, rng)
      if (dealt > 0 && d.hp > 0) {
        pushLog(log, a, d, `⚔️ ${a.name} hits ${d.name} for ${dealt} dmg. (${d.name}: ${d.hp} HP)`)
      } else if (d.hp <= 0) {
        pushLog(log, a, d, `💥 ${a.name} defeats ${d.name}!`)
      }
    } finally {
      a.inExtraAttack = false
    }
  }
}

// ─── Decide turn order ────────────────────────────────────────────────────────

function decideOrder(p: FighterState, e: FighterState, round: number, rng: Rng): boolean {
  const pFirst = p.firstStrike || (round === 1 && (p.ability?.effect.firstStrikeRound1 ?? false))
  const eFirst = e.firstStrike || (round === 1 && (e.ability?.effect.firstStrikeRound1 ?? false))
  if (pFirst && !eFirst) return true
  if (eFirst && !pFirst) return false
  if (p.speed !== e.speed) return p.speed > e.speed
  // Tie: deterministic from the seeded RNG (no built-in player advantage). Fix for C4.
  return rng() < 0.5
}

// ─── Main battle loop ─────────────────────────────────────────────────────────

const MAX_ROUNDS = 50

export function runBattle(
  player: BattleFighter,
  enemy: BattleFighter,
  seed?: number,
): BattleResult {
  const battleSeed = seed ?? newSeed()
  const rng = seedRng(battleSeed)

  const p = initFighter(player, true)
  const e = initFighter(enemy, false)
  const log: BattleLogEntry[] = []

  const startsFirst = decideOrder(p, e, 1, rng)
  pushLog(log, p, e,
    `⚔️ ${p.name} vs ${e.name}! ${startsFirst ? p.name : e.name} moves first!`)

  if (p.ability) pushLog(log, p, e, `${p.ability.icon} ${p.name}'s ability: ${p.ability.name}`)
  if (e.ability) pushLog(log, p, e, `${e.ability.icon} ${e.name}'s ability: ${e.ability.name}`)

  let round = 1

  while (p.hp > 0 && e.hp > 0 && round <= MAX_ROUNDS) {
    // Round-start: process in speed order so neither side gets a structural advantage.
    const playerStartsFirst = decideOrder(p, e, round, rng)
    const [first, second] = playerStartsFirst ? [p, e] : [e, p]
    const [firstOpp, secondOpp] = playerStartsFirst ? [e, p] : [p, e]

    processRoundStart(first, firstOpp, round, log)
    if (p.hp <= 0 || e.hp <= 0) break
    processRoundStart(second, secondOpp, round, log)
    if (p.hp <= 0 || e.hp <= 0) break

    checkHpTriggers(p, log, e)
    checkHpTriggers(e, log, p)

    // Re-decide order in case a mid-fight trigger changed firstStrike
    const playerAttacksFirst = decideOrder(p, e, round, rng)

    if (playerAttacksFirst) {
      if (p.hp > 0 && e.hp > 0) attemptAttack(p, e, round, log, rng)
      if (p.hp > 0 && e.hp > 0) attemptAttack(e, p, round, log, rng)
    } else {
      if (p.hp > 0 && e.hp > 0) attemptAttack(e, p, round, log, rng)
      if (p.hp > 0 && e.hp > 0) attemptAttack(p, e, round, log, rng)
    }

    // Round-end: tick speed debuffs
    if (p.speedDebuffRounds > 0) {
      p.speedDebuffRounds--
      if (p.speedDebuffRounds === 0) {
        p.speedDebuffAmount = 0
        recalcStats(p)
      }
    }
    if (e.speedDebuffRounds > 0) {
      e.speedDebuffRounds--
      if (e.speedDebuffRounds === 0) {
        e.speedDebuffAmount = 0
        recalcStats(e)
      }
    }

    round++
  }

  // ─── Determine winner — explicit draw handling (fixes C3) ─────────────────
  let winner: Winner
  if (p.hp <= 0 && e.hp <= 0) {
    winner = 'draw'
    pushLog(log, p, e, `🤝 Both fighters fall — it's a draw!`)
  } else if (p.hp <= 0) {
    winner = 'enemy'
    pushLog(log, p, e, `💀 ${e.name} wins!`)
  } else if (e.hp <= 0) {
    winner = 'player'
    pushLog(log, p, e, `🏆 ${p.name} wins!`)
  } else {
    // Round cap — break by HP fraction, then by raw HP, then it's a draw
    pushLog(log, p, e, `⏱️ Time's up at round ${MAX_ROUNDS}!`)
    const pPct = p.hp / p.maxHp
    const ePct = e.hp / e.maxHp
    if (pPct > ePct + 0.001)      { winner = 'player'; pushLog(log, p, e, `🏆 ${p.name} wins on HP!`) }
    else if (ePct > pPct + 0.001) { winner = 'enemy';  pushLog(log, p, e, `💀 ${e.name} wins on HP!`) }
    else                          { winner = 'draw';   pushLog(log, p, e, `🤝 Draw — equal HP!`) }
  }

  return {
    winner,
    log,
    playerMaxHp: p.maxHp,
    enemyMaxHp:  e.maxHp,
    playerName:  p.name,
    enemyName:   e.name,
    seed:        battleSeed,
  }
}
