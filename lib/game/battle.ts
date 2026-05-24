import type { Ability } from './abilities'

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

export type BattleResult = {
  winner:      'player' | 'enemy'
  log:         BattleLogEntry[]
  playerMaxHp: number
  enemyMaxHp:  number
  playerName:  string
  enemyName:   string
}

// ─── Internal state ───────────────────────────────────────────────────────────

type FighterState = {
  // Identity
  name:    string
  ability: Ability | null
  isPlayer: boolean

  // Current mutable stats
  hp:    number
  maxHp: number
  atk:   number
  def:   number
  speed: number

  // Base stats (immutable references)
  baseAtk:   number
  baseDef:   number
  baseSpeed: number

  // Action counters
  ownAttackCount:   number  // how many own attacks this fighter has made
  hitsTakenCount:   number  // how many incoming hits absorbed

  // Statuses (typically inflicted by opponent)
  stunnedAttacks:      number   // skip this many of own upcoming attacks
  speedDebuffRounds:   number
  burning:             boolean
  burnPct:             number   // % max HP lost per turn if burning
  defDecayMult:        number   // current DEF multiplier from accumulated decay (Shigaraki)

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
  lowHpFired:             boolean  // any lowHp trigger fired
  tsunadeHealUsed:        boolean
  gohanRageUsed:          boolean
  biscuitTransformUsed:   boolean
  patternRecogFired:      boolean
  zenitsuTriggered:       boolean

  // Active ability runtime state
  lifestealPct:           number    // active lifesteal % (e.g., All Might after low HP)
  passiveRegenPct:        number    // ongoing regen pct (e.g., Kaido after low HP)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initFighter(f: BattleFighter, isPlayer: boolean): FighterState {
  const ability = f.ability ?? null
  const eff = ability?.effect

  let hp    = f.base_hp
  let atk   = f.base_atk
  let def   = f.base_def
  let speed = f.base_speed

  // Apply flat stat buffs from statBuffPct
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

    ownAttackCount: 0,
    hitsTakenCount: 0,

    stunnedAttacks:    0,
    speedDebuffRounds: 0,
    burning:           false,
    burnPct:           0,
    defDecayMult:      1.0,

    firstStrike: eff?.firstStrike ?? false,

    firstNAttacksReductionRemaining: eff?.firstNAttacksReduction?.count ?? 0,
    firstNAttacksReductionPct:       eff?.firstNAttacksReduction?.pct   ?? 0,
    firstNAttacksDodgeRemaining:     eff?.firstNAttacksDodge ?? 0,

    copyAtkUsed:          false,
    reviveUsed:           false,
    surviveFatalUsed:     false,
    lowHpFired:           false,
    tsunadeHealUsed:      false,
    gohanRageUsed:        false,
    biscuitTransformUsed: false,
    patternRecogFired:    false,
    zenitsuTriggered:     false,

    lifestealPct:    eff?.lifestealPct ?? 0,
    passiveRegenPct: 0,
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

  // Burn DoT (applied to self by opponent's ability)
  if (f.burning && f.hp > 0) {
    const burnDmg = Math.max(1, Math.floor(f.maxHp * f.burnPct))
    f.hp = Math.max(0, f.hp - burnDmg)
    pushLog(log, f, opp, `🔥 ${f.name} burns for ${burnDmg} dmg.`)
  }

  // ATK ramp (Rock Lee, Midoriya, Rengoku, Matt, Meruem)
  if (eff.atkRampPct) {
    f.atk = Math.round(f.atk * (1 + eff.atkRampPct))
  }

  // DEF ramp (Meruem)
  if (eff.defRampPct) {
    f.def = Math.round(f.def * (1 + eff.defRampPct))
  }

  // Enemy ATK ramp-down (Eren Founding Titan)
  if (eff.enemyAtkRampDownPct) {
    opp.atk = Math.max(1, Math.round(opp.atk * (1 - eff.enemyAtkRampDownPct)))
  }

  // Alternating buff (Todoroki) — apply ATK on odd rounds, DEF on even
  if (eff.alternatingBuff) {
    if (round % 2 === 1) {
      // odd: atk
      f.atk = Math.round(f.baseAtk * (1 + eff.alternatingBuff.atkPct))
      f.def = f.baseDef
    } else {
      // even: def
      f.atk = f.baseAtk
      f.def = Math.round(f.baseDef * (1 + eff.alternatingBuff.defPct))
    }
  }

  // First-turn ATK boost (Maes Hughes) — applies on round 1 only, reverts on round 2
  if (eff.firstTurnAtkBoost) {
    if (round === 1) {
      f.atk = Math.round(f.baseAtk * (1 + eff.firstTurnAtkBoost))
    } else if (round === 2) {
      f.atk = f.baseAtk
    }
  }

  // ─── Turn-X triggers ──────────────────────────────────────────────────────

  // Itachi: stun opponent on round X
  if (eff.turnXStun && eff.turnXStun.turn === round) {
    opp.stunnedAttacks += eff.turnXStun.turns
    pushLog(log, f, opp, `${f.ability.icon} ${f.name}'s ${f.ability.name}! ${opp.name} is stunned!`)
  }

  // Luffy: gain buff permanently after round X
  if (eff.turnXBuff && eff.turnXBuff.turn === round) {
    f.atk = Math.round(f.atk * (1 + eff.turnXBuff.atkPct))
    if (eff.turnXBuff.speedPct) {
      f.speed = Math.round(f.speed * (1 + eff.turnXBuff.speedPct))
    }
    pushLog(log, f, opp, `${f.ability.icon} ${f.name}'s ${f.ability.name}! ATK and Speed boosted!`)
  }

  // Eren: transform with HP and ATK gain on round X
  if (eff.turnXTransform && eff.turnXTransform.turn === round) {
    const hpAdd = Math.round(f.maxHp * eff.turnXTransform.hpAddPct)
    f.maxHp += hpAdd
    f.hp += hpAdd
    f.atk = Math.round(f.atk * (1 + eff.turnXTransform.atkPct))
    pushLog(log, f, opp, `${f.ability.icon} ${f.name} transforms! HP +${hpAdd}, ATK boosted!`)
  }

  // Law: swap ATK on round X if opponent's is higher
  if (eff.turnXSwapAtkIfEnemyHigher && eff.turnXSwapAtkIfEnemyHigher.turn === round) {
    if (opp.atk > f.atk) {
      const tmp = f.atk
      f.atk = opp.atk
      opp.atk = tmp
      pushLog(log, f, opp, `${f.ability.icon} ${f.name}'s ${f.ability.name}! ATK swapped with ${opp.name}!`)
    }
  }

  // Rem: sacrifice HP on round X
  if (eff.turnXSacrifice && eff.turnXSacrifice.turn === round) {
    const cost = Math.floor(f.maxHp * eff.turnXSacrifice.selfHpPct)
    f.hp = Math.max(1, f.hp - cost)
    pushLog(log, f, opp, `${f.ability.icon} ${f.name} sacrifices ${cost} HP for ${f.ability.name}!`)
  }
}

// ─── HP threshold triggers (checked after damage) ─────────────────────────────

function checkHpTriggers(f: FighterState, log: BattleLogEntry[], opp: FighterState) {
  if (!f.ability || f.hp <= 0) return
  const eff = f.ability.effect
  const hpFrac = f.hp / f.maxHp

  // lowHpAtkBoost — once when threshold is crossed
  if (eff.lowHpAtkBoost && !f.lowHpFired && hpFrac < eff.lowHpAtkBoost.threshold) {
    const lb = eff.lowHpAtkBoost
    f.atk = Math.round(f.atk * (1 + lb.atkPct))
    if (lb.speedPct) f.speed = Math.round(f.speed * (1 + lb.speedPct))
    if (lb.lifestealPct) f.lifestealPct = lb.lifestealPct
    if (lb.regenPct) f.passiveRegenPct = lb.regenPct
    if (lb.firstStrikeWhenTriggered) {
      f.firstStrike = true
      f.zenitsuTriggered = true
    }
    f.lowHpFired = true
    pushLog(log, f, opp, `${f.ability.icon} ${f.name} unleashes ${f.ability.name}!`)
  }

  // Tsunade: heal once when below threshold
  if (eff.lowHpHealOnce && !f.tsunadeHealUsed && hpFrac < eff.lowHpHealOnce.threshold) {
    const healed = applyHeal(f, eff.lowHpHealOnce.pct)
    f.tsunadeHealUsed = true
    pushLog(log, f, opp, `💯 ${f.name}'s ${f.ability.name}! Restored ${healed} HP!`)
  }

  // Biscuit: transform once when below threshold
  if (eff.lowHpTransform && !f.biscuitTransformUsed && hpFrac < eff.lowHpTransform.threshold) {
    const hpAdd = Math.round(f.maxHp * eff.lowHpTransform.hpAddPct)
    f.maxHp += hpAdd
    f.hp += hpAdd
    f.atk = Math.round(f.atk * (1 + eff.lowHpTransform.atkPct))
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
): number {
  let dmg = Math.max(1, Math.floor(rawDmg))

  // Defender reductions
  let reduction = 0

  // Gaara: first incoming attack reduced (uses hitsTakenCount === 0 BEFORE we increment)
  if (d.ability?.effect.firstAttackReductionPct && d.hitsTakenCount === 0) {
    reduction = Math.max(reduction, d.ability.effect.firstAttackReductionPct)
  }

  // First-N attacks reduction (Reiner, Greed, Ace, Alice, Admin)
  if (d.firstNAttacksReductionRemaining > 0) {
    reduction = Math.max(reduction, d.firstNAttacksReductionPct)
    d.firstNAttacksReductionRemaining--
  }

  // Persistent damage reduction (Gyomei)
  if (d.ability?.effect.damageReductionPct) {
    reduction = Math.max(reduction, d.ability.effect.damageReductionPct)
  }

  // Low HP damage reduction (Kirishima)
  if (d.ability?.effect.lowHpDamageReduction) {
    const lh = d.ability.effect.lowHpDamageReduction
    if (d.hp / d.maxHp < lh.threshold) {
      reduction = Math.max(reduction, lh.pct)
    }
  }

  dmg = Math.max(1, Math.floor(dmg * (1 - reduction)))

  // Mello: first hit taken deals extra
  if (d.ability?.effect.firstHitTakenBonusPct && d.hitsTakenCount === 0) {
    dmg = Math.floor(dmg * (1 + d.ability.effect.firstHitTakenBonusPct))
  }

  // Deal damage
  d.hp = Math.max(0, d.hp - dmg)
  d.hitsTakenCount++

  // ─── On-hit-taken effects on defender ────────────────────────────────────
  const de = d.ability?.effect

  // Kakashi: copy ATK from first hit
  if (de?.copyAtkOnFirstHit && !d.copyAtkUsed) {
    const buff = Math.round(a.atk * de.copyAtkOnFirstHit)
    d.atk += buff
    d.copyAtkUsed = true
    pushLog(log, d, a, `📖 ${d.name} copies ${buff} ATK!`)
  }

  // Pain packer (Vegeta, Feitan)
  if (de?.painPackerPct) {
    d.atk = Math.round(d.atk * (1 + de.painPackerPct))
  }

  // Android 18 absorb / Cardinal absorb
  if (de?.absorbPct && d.hp > 0) {
    const heal = Math.floor(dmg * de.absorbPct)
    const before = d.hp
    d.hp = Math.min(d.maxHp, d.hp + heal)
    if (d.hp > before) {
      pushLog(log, d, a, `🔋 ${d.name} absorbs ${d.hp - before} HP!`)
    }
  }

  // Counter (Hisoka)
  if (de?.counterPct && a.hp > 0) {
    const counter = Math.max(1, Math.floor(dmg * de.counterPct))
    a.hp = Math.max(0, a.hp - counter)
    pushLog(log, d, a, `🃏 ${d.name}'s ${d.ability!.name} returns ${counter} dmg!`)
  }

  // ─── On-hit effects from attacker (apply to defender) ────────────────────
  const ae = a.ability?.effect

  // Mustang burn proc
  if (ae?.burnOnHitChance && !d.burning && Math.random() < ae.burnOnHitChance.chance) {
    d.burning = true
    d.burnPct = ae.burnOnHitChance.pct
    pushLog(log, a, d, `🔥 ${a.name} sets ${d.name} ablaze!`)
  }

  // Nezuko burn (always applies after first hit)
  if (ae?.enemyBurnPct && !d.burning && isFirstOfAttack) {
    d.burning = true
    d.burnPct = ae.enemyBurnPct
    pushLog(log, a, d, `🩸 ${a.name}'s ${a.ability!.name} ignites ${d.name}!`)
  }

  // Shigaraki: enemy DEF decay
  if (ae?.enemyDefDecayPct) {
    d.def = Math.max(1, Math.round(d.def * (1 - ae.enemyDefDecayPct)))
  }

  // Stun chance (Hancock, Doma, Eugeo, Kurapika, Nami)
  if (ae?.stunChance && Math.random() < ae.stunChance.chance) {
    d.stunnedAttacks += ae.stunChance.turns
    pushLog(log, a, d, `${a.ability!.icon} ${a.name} stuns ${d.name} for ${ae.stunChance.turns} turn(s)!`)
  }

  // Lifesteal (active when triggered, e.g., All Might)
  if (a.lifestealPct > 0 && a.hp > 0) {
    const heal = Math.floor(dmg * a.lifestealPct)
    a.hp = Math.min(a.maxHp, a.hp + heal)
  }

  // ─── HP threshold triggers on defender ───────────────────────────────────
  checkHpTriggers(d, log, a)

  // ─── Defeat / revive / survive ───────────────────────────────────────────
  if (d.hp <= 0) {
    if (de?.surviveFatalOnce && !d.surviveFatalUsed) {
      d.hp = 1
      d.surviveFatalUsed = true
      pushLog(log, d, a, `${d.ability!.icon} ${d.name} survives with 1 HP!`)
    } else if (de?.reviveOnce && !d.reviveUsed) {
      const reviveHp = Math.max(1, Math.round(d.maxHp * de.reviveOnce.hpPct))
      d.hp = reviveHp
      d.reviveUsed = true
      pushLog(log, d, a, `${d.ability!.icon} ${d.name} reforms at ${reviveHp} HP!`)
    }
  }

  return dmg
}

// ─── Attempt an attack ────────────────────────────────────────────────────────

function attemptAttack(
  a:    FighterState,
  d:    FighterState,
  round: number,
  log:  BattleLogEntry[],
) {
  // Stunned? Skip and consume one stun stack.
  if (a.stunnedAttacks > 0) {
    a.stunnedAttacks--
    pushLog(log, a, d, `💫 ${a.name} is stunned and can't move!`)
    return
  }

  a.ownAttackCount++
  const isFirstAttack = a.ownAttackCount === 1
  const ae = a.ability?.effect

  // Dodge rolls (defender)
  // 1. Persistent dodge chance
  const dodgePct = d.ability?.effect.dodgeChance ?? 0
  if (dodgePct > 0 && Math.random() < dodgePct) {
    pushLog(log, a, d, `${d.ability!.icon} ${d.name} dodges ${a.name}'s attack!`)
    return
  }
  // 2. First-N attacks dodge (L Lawliet)
  if (d.firstNAttacksDodgeRemaining > 0) {
    d.firstNAttacksDodgeRemaining--
    pushLog(log, a, d, `🍰 ${d.name} foresees and dodges!`)
    return
  }
  // 3. Redirect chance (Illumi) — counts as a dodge but damage hits self
  if (d.ability?.effect.redirectChance && Math.random() < d.ability.effect.redirectChance) {
    pushLog(log, a, d, `📍 ${d.name} redirects the attack back to ${a.name}!`)
    const rawDmg = calcRawDamage(a.atk, 0, true)  // self-damage ignores def
    a.hp = Math.max(0, a.hp - rawDmg)
    pushLog(log, a, d, `📍 ${a.name} takes ${rawDmg} dmg from their own attack!`)
    return
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
  } else if (ae?.multiHitChance && Math.random() < ae.multiHitChance.chance) {
    hitCount = ae.multiHitChance.count
    damagePerHitPct = ae.multiHitChance.damagePct
    attackFlavor = `${a.ability!.icon} ${a.name}'s ${a.ability!.name}! ${hitCount}× attack!`
  }

  // ─── Damage modifiers ─────────────────────────────────────────────────────
  let dmgMult = 1.0
  let ignoreDef = false
  let bonusFlat = 0
  let critMult  = 1.0

  // Frieza opener ignore DEF
  if (isFirstAttack && ae?.openerIgnoreDef) {
    ignoreDef = true
  }

  // Thunder Spear / Inverted Spear — chance per attack to ignore DEF
  if (ae?.ignoreDefChance && Math.random() < ae.ignoreDefChance) {
    ignoreDef = true
  }

  // Piccolo / turn-X attack
  if (ae?.turnXAttack && ae.turnXAttack.turn === round) {
    dmgMult *= ae.turnXAttack.mult
    if (ae.turnXAttack.ignoreDef) ignoreDef = true
    attackFlavor = `${a.ability!.icon} ${a.name}'s ${a.ability!.name}!`
  }

  // Rem turn-X sacrifice damage mult
  if (ae?.turnXSacrifice && ae.turnXSacrifice.turn === round) {
    dmgMult *= ae.turnXSacrifice.damageMult
    attackFlavor = `💀 ${a.name}'s ${a.ability!.name}!`
  }

  // Zeke turn-X bonus enemy max HP
  if (ae?.turnXBonusEnemyMaxHp && ae.turnXBonusEnemyMaxHp.turn === round) {
    bonusFlat += Math.floor(d.maxHp * ae.turnXBonusEnemyMaxHp.enemyMaxHpPct)
    attackFlavor = `⚾ ${a.name}'s ${a.ability!.name}! Bonus ${Math.floor(d.maxHp * ae.turnXBonusEnemyMaxHp.enemyMaxHpPct)} dmg!`
  }

  // Gon chargeRelease
  if (ae?.chargeRelease) {
    if (a.ownAttackCount <= ae.chargeRelease.chargeTurns) {
      dmgMult *= ae.chargeRelease.chargePct
      attackFlavor = `✊ ${a.name} is charging Jajanken...`
    } else {
      dmgMult *= ae.chargeRelease.releaseMult
      attackFlavor = `✊ ${a.name}'s Jajanken unleashed!`
    }
  }

  // Bonus damage from own DEF (Edward)
  if (ae?.bonusDamageFromOwnDefPct) {
    bonusFlat += Math.floor(a.def * ae.bonusDamageFromOwnDefPct)
  }

  // Bonus damage from enemy max HP (Scar)
  if (ae?.bonusDamageFromEnemyMaxHpPct) {
    bonusFlat += Math.floor(d.maxHp * ae.bonusDamageFromEnemyMaxHpPct)
  }

  // Bercouli's chance for bonus enemy-max-HP damage
  if (ae?.chanceMaxHpDmg && Math.random() < ae.chanceMaxHpDmg.chance) {
    const bonus = Math.floor(d.maxHp * ae.chanceMaxHpDmg.enemyMaxHpPct)
    bonusFlat += bonus
    pushLog(log, a, d, `⏳ ${a.name}'s ${a.ability!.name}! +${bonus} dmg!`)
  }

  // Crit roll
  if (isFirstAttack && ae?.openerCrit) {
    critMult = ae.openerCrit.mult
  } else if (ae?.critChance && Math.random() < ae.critChance) {
    critMult = ae.critMult ?? 2.0
    pushLog(log, a, d, `💥 ${a.name}'s ${a.ability!.name} crits!`)
  }

  // Sanji every-Nth double damage
  if (ae?.everyNthDouble && a.ownAttackCount > 0 && a.ownAttackCount % ae.everyNthDouble === 0) {
    critMult = Math.max(critMult, 2.0)
    pushLog(log, a, d, `🦵 ${a.name}'s ${a.ability!.name}! Double damage!`)
  }

  // aboveHpAtkBoost (L Lawliet, Kira)
  if (ae?.aboveHpAtkBoost && a.hp / a.maxHp >= ae.aboveHpAtkBoost.threshold) {
    dmgMult *= (1 + ae.aboveHpAtkBoost.atkPct)
  }

  // Pattern Recognition: Near's buff after enemy attacks N times
  if (ae?.afterEnemyAttacksBuff && !a.patternRecogFired
      && d.ownAttackCount >= ae.afterEnemyAttacksBuff.count) {
    a.atk = Math.round(a.atk * (1 + ae.afterEnemyAttacksBuff.atkPct))
    a.patternRecogFired = true
    pushLog(log, a, d, `♟️ ${a.name}'s ${a.ability!.name}! ATK +${Math.round(ae.afterEnemyAttacksBuff.atkPct * 100)}%!`)
  }

  // ─── Instant-kill chance (Misa, Light, Kira) ─────────────────────────────
  if (ae?.instantKillPerTurnChance && Math.random() < ae.instantKillPerTurnChance) {
    pushLog(log, a, d, `${a.ability!.icon} ${a.name}'s ${a.ability!.name}! ${d.name} is instantly defeated!`)
    d.hp = 0
    return
  }

  // ─── Compute base damage and execute hits ────────────────────────────────
  if (attackFlavor) {
    pushLog(log, a, d, attackFlavor)
  }

  const baseRaw = calcRawDamage(a.atk, d.def, ignoreDef)
  let totalDmgDealt = 0

  for (let i = 0; i < hitCount && d.hp > 0; i++) {
    let raw = Math.floor(baseRaw * damagePerHitPct * dmgMult)
    if (i === 0) {
      raw = Math.floor(raw * critMult)
      raw += bonusFlat
    }
    const dealt = applyHit(a, d, raw, i === 0, log)
    totalDmgDealt += dealt
    if (a.hp <= 0) break  // counter could kill the attacker
  }

  // Emit a damage summary if there wasn't already a flavor line
  if (totalDmgDealt > 0) {
    if (d.hp <= 0) {
      pushLog(log, a, d, `💥 ${a.name} defeats ${d.name}!`)
    } else {
      pushLog(log, a, d, `⚔️ ${a.name} hits ${d.name} for ${totalDmgDealt} dmg. (${d.name}: ${d.hp} HP)`)
    }
  }

  // ─── Mineta opener speed debuff ──────────────────────────────────────────
  if (isFirstAttack && ae?.openerSpeedDebuff) {
    d.speed = Math.max(1, Math.round(d.speed * (1 - ae.openerSpeedDebuff.pct)))
    d.speedDebuffRounds = ae.openerSpeedDebuff.turns
    pushLog(log, a, d, `🟣 ${a.name}'s ${a.ability!.name}! ${d.name}'s speed dropped!`)
  }

  // ─── Extra attack chance (Minato, Levi, Hawks, Killua) ───────────────────
  if (ae?.extraAttackChance && d.hp > 0 && a.hp > 0 && Math.random() < ae.extraAttackChance) {
    pushLog(log, a, d, `⚡ ${a.name} strikes again!`)
    // Recursive-ish, but flag so we don't infinitely chain: temporarily clear extraAttackChance
    const saved = ae.extraAttackChance
    // Mutate effect to prevent cascade
    ;(a.ability!.effect as { extraAttackChance?: number }).extraAttackChance = 0
    attemptAttack(a, d, round, log)
    ;(a.ability!.effect as { extraAttackChance?: number }).extraAttackChance = saved
  }
}

// ─── Decide turn order ────────────────────────────────────────────────────────

function decideOrder(p: FighterState, e: FighterState, round: number = 1): boolean {
  // Round-1-only first strike (e.g. Den Den Mushi) counts ONLY on round 1
  const pFirst = p.firstStrike || (round === 1 && (p.ability?.effect.firstStrikeRound1 ?? false))
  const eFirst = e.firstStrike || (round === 1 && (e.ability?.effect.firstStrikeRound1 ?? false))
  if (pFirst && !eFirst) return true
  if (eFirst && !pFirst) return false
  // Both or neither: compare speed; ties go to player
  return p.speed >= e.speed
}

// ─── Main battle loop ─────────────────────────────────────────────────────────

const MAX_ROUNDS = 50

export function runBattle(player: BattleFighter, enemy: BattleFighter): BattleResult {
  const p = initFighter(player, true)
  const e = initFighter(enemy, false)
  const log: BattleLogEntry[] = []

  const startsFirst = decideOrder(p, e, 1)
  pushLog(log, p, e,
    `⚔️ ${p.name} vs ${e.name}! ${startsFirst ? p.name : e.name} moves first!`)

  // Announce starting abilities (one log line each if present)
  if (p.ability) {
    pushLog(log, p, e, `${p.ability.icon} ${p.name}'s ability: ${p.ability.name}`)
  }
  if (e.ability) {
    pushLog(log, p, e, `${e.ability.icon} ${e.name}'s ability: ${e.ability.name}`)
  }

  let round = 1

  while (p.hp > 0 && e.hp > 0 && round <= MAX_ROUNDS) {
    // Round-start (player first, then enemy — order doesn't matter much here)
    processRoundStart(p, e, round, log)
    if (p.hp <= 0 || e.hp <= 0) break
    processRoundStart(e, p, round, log)
    if (p.hp <= 0 || e.hp <= 0) break

    // Re-check threshold triggers from start-of-round effects (e.g., burn)
    checkHpTriggers(p, log, e)
    checkHpTriggers(e, log, p)

    // Re-decide order in case a mid-fight trigger changed firstStrike
    const playerFirst = decideOrder(p, e, round)

    // Attack phase: both fighters get one attack opportunity per round
    if (playerFirst) {
      if (p.hp > 0 && e.hp > 0) attemptAttack(p, e, round, log)
      if (p.hp > 0 && e.hp > 0) attemptAttack(e, p, round, log)
    } else {
      if (p.hp > 0 && e.hp > 0) attemptAttack(e, p, round, log)
      if (p.hp > 0 && e.hp > 0) attemptAttack(p, e, round, log)
    }

    // Round-end: tick speed debuffs
    if (p.speedDebuffRounds > 0) {
      p.speedDebuffRounds--
      if (p.speedDebuffRounds === 0) p.speed = p.baseSpeed
    }
    if (e.speedDebuffRounds > 0) {
      e.speedDebuffRounds--
      if (e.speedDebuffRounds === 0) e.speed = e.baseSpeed
    }

    round++
  }

  const winner: 'player' | 'enemy' = p.hp > 0 ? 'player' : 'enemy'

  pushLog(log, p, e, winner === 'player'
    ? `🏆 ${p.name} wins!`
    : `💀 ${e.name} wins!`)

  return {
    winner,
    log,
    playerMaxHp: p.maxHp,
    enemyMaxHp:  e.maxHp,
    playerName:  p.name,
    enemyName:   e.name,
  }
}
