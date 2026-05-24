// ─── Character Abilities ──────────────────────────────────────────────────────
//
// Each character has ONE signature passive ability that triggers automatically
// during battle. Abilities are keyed by exact character name and read by the
// battle engine in lib/game/battle.ts.
//
// All percentages are decimals (0.30 = 30%). All HP thresholds are fractions
// of max HP (0.30 = "when HP drops below 30%").

// ─── Effect schema ────────────────────────────────────────────────────────────
//
// Every field is optional. An ability composes one or more of these effects.
// The battle engine reads each field independently in the appropriate hook.

export type AbilityEffect = {
  // ─── Persistent passives (every turn / always-on) ───────────────────────────
  regenPct?:               number   // heal X% max HP per turn
  regenEveryNTurns?:       { turns: number; pct: number }
  atkRampPct?:             number   // +X% ATK every turn (compounding)
  defRampPct?:             number   // +X% DEF every turn (compounding)
  enemyBurnPct?:           number   // enemy loses X% max HP per turn after first hit
  enemyAtkRampDownPct?:    number   // -X% enemy ATK per turn (Founding Titan)
  damageReductionPct?:     number   // takes X% less damage from every attack
  dodgeChance?:            number   // X% chance to fully dodge any attack
  redirectChance?:         number   // X% chance to redirect enemy attack to themselves
  absorbPct?:              number   // heals X% of damage taken
  counterPct?:             number   // returns X% of damage taken to attacker
  painPackerPct?:          number   // +X% ATK each time hit (stacking)

  // ─── Pre-battle / first-attack modifiers ────────────────────────────────────
  firstStrike?:            boolean  // always attacks first regardless of speed
  statBuffPct?:            { hp?: number; atk?: number; def?: number; speed?: number }
  openerCrit?:             { mult: number }     // first own attack is a guaranteed crit
  openerMultiHit?:         { count: number; damagePct: number }
  openerIgnoreDef?:        boolean              // first own attack ignores enemy DEF
  openerSpeedDebuff?:      { turns: number; pct: number }  // slow enemy at battle start
  firstAttackReductionPct?: number              // first INCOMING attack reduced by X%
  firstNAttacksReduction?: { count: number; pct: number }
  firstNAttacksDodge?:     number               // dodge the first N incoming attacks
  firstHitTakenBonusPct?:  number               // first hit taken deals +X% extra damage
  copyAtkOnFirstHit?:      number               // after taking first hit, gain X% of enemy ATK
  firstTurnAtkBoost?:      number               // +X% ATK on turn 1 only

  // ─── On-attack modifiers ────────────────────────────────────────────────────
  multiHitChance?:              { chance: number; count: number; damagePct: number }
  alwaysMultiHit?:              { count: number; damagePct: number }
  critChance?:                  number
  critMult?:                    number   // default 2.0
  extraAttackChance?:           number   // X% chance to get a second attack after primary
  everyNthDouble?:              number   // every Nth own turn, attack does 2x damage
  bonusDamageFromOwnDefPct?:    number   // adds X% of own DEF to damage
  bonusDamageFromEnemyMaxHpPct?: number  // adds X% of enemy max HP to damage
  chanceMaxHpDmg?:              { chance: number; enemyMaxHpPct: number }
  stunChance?:                  { chance: number; turns: number }
  burnOnHitChance?:             { chance: number; pct: number }
  enemyDefDecayPct?:            number   // each hit permanently reduces enemy DEF by X%
  lifestealPct?:                number   // heals X% of damage dealt
  instantKillPerTurnChance?:    number   // X% chance per turn to instantly defeat enemy

  // ─── HP threshold triggers ──────────────────────────────────────────────────
  lowHpAtkBoost?: {
    threshold:                  number
    atkPct:                     number
    speedPct?:                  number
    lifestealPct?:              number
    regenPct?:                  number   // ongoing regen after triggering (Kaido)
    firstStrikeWhenTriggered?:  boolean  // also start striking first (Zenitsu)
    onceOnly?:                  boolean
  }
  lowHpHealOnce?:               { threshold: number; pct: number }
  lowHpDamageReduction?:        { threshold: number; pct: number }
  lowHpTransform?:              { threshold: number; hpAddPct: number; atkPct: number }
  aboveHpAtkBoost?:             { threshold: number; atkPct: number }
  reviveOnce?:                  { hpPct: number }
  surviveFatalOnce?:            boolean

  // ─── Turn-X conditional triggers ────────────────────────────────────────────
  turnXStun?:                   { turn: number; turns: number }
  turnXAttack?:                 { turn: number; mult: number; ignoreDef?: boolean }
  turnXTransform?:              { turn: number; hpAddPct: number; atkPct: number }
  turnXBuff?:                   { turn: number; atkPct: number; speedPct?: number }
  turnXBonusEnemyMaxHp?:        { turn: number; enemyMaxHpPct: number }
  turnXSacrifice?:              { turn: number; selfHpPct: number; damageMult: number }
  turnXSwapAtkIfEnemyHigher?:   { turn: number }
  chargeRelease?:               { chargeTurns: number; chargePct: number; releaseMult: number }

  // ─── Other ──────────────────────────────────────────────────────────────────
  afterEnemyAttacksBuff?:       { count: number; atkPct: number }  // Near
  alternatingBuff?:             { atkPct: number; defPct: number } // Todoroki

  // ─── Equipment-granted (also reusable by abilities) ─────────────────────────
  ignoreDefChance?:             number   // chance per attack to ignore enemy DEF (Thunder Spear, Inverted Spear)
  firstStrikeRound1?:           boolean  // strikes first on round 1 only (Den Den Mushi)
}

export type Ability = {
  name:         string
  icon:         string
  description:  string
  effect:       AbilityEffect
}

// ─── Ability roster (100 characters) ──────────────────────────────────────────

export const ABILITIES: Record<string, Ability> = {

  // ════════ Arc 1 — Naruto: Part 1 ═══════════════════════════════════════════
  'Sakura Haruno': {
    name: 'Medical Ninjutsu',
    icon: '🩹',
    description: 'Heals 6% max HP per turn.',
    effect: { regenPct: 0.06 },
  },
  'Naruto Uzumaki': {
    name: 'Shadow Clones',
    icon: '🌀',
    description: '30% chance to attack twice per turn.',
    effect: { multiHitChance: { chance: 0.30, count: 2, damagePct: 1.0 } },
  },
  'Sasuke Uchiha': {
    name: 'Sharingan',
    icon: '👁️',
    description: '25% chance to dodge any incoming attack.',
    effect: { dodgeChance: 0.25 },
  },
  'Kakashi Hatake': {
    name: 'Copy Ninja',
    icon: '📖',
    description: 'After taking the first hit, gains 30% of the enemy\'s ATK as a permanent buff.',
    effect: { copyAtkOnFirstHit: 0.30 },
  },
  'Itachi Uchiha': {
    name: 'Tsukuyomi',
    icon: '🌙',
    description: 'On turn 1, the enemy is stunned and skips their next turn.',
    effect: { turnXStun: { turn: 1, turns: 1 } },
  },

  // ════════ Arc 2 — Naruto: Shippuden ════════════════════════════════════════
  'Rock Lee': {
    name: 'Eight Gates',
    icon: '🟢',
    description: '+6% ATK every turn, stacking.',
    effect: { atkRampPct: 0.06 },
  },
  'Gaara': {
    name: 'Sand Shield',
    icon: '🏜️',
    description: 'First incoming attack is reduced by 75%.',
    effect: { firstAttackReductionPct: 0.75 },
  },
  'Tsunade': {
    name: 'Hundred Healings',
    icon: '💯',
    description: 'When HP first drops below 30%, restores 35% max HP (once per fight).',
    effect: { lowHpHealOnce: { threshold: 0.30, pct: 0.35 } },
  },
  'Obito Uchiha': {
    name: 'Kamui',
    icon: '👻',
    description: '25% chance to phase through any attack (full dodge).',
    effect: { dodgeChance: 0.25 },
  },
  'Minato Namikaze': {
    name: 'Flying Thunder God',
    icon: '⚡',
    description: 'Always attacks first; 20% chance for an instant second attack.',
    effect: { firstStrike: true, extraAttackChance: 0.20 },
  },

  // ════════ Arc 3 — Dragon Ball Z: Saiyan Saga ═══════════════════════════════
  'Piccolo': {
    name: 'Special Beam Cannon',
    icon: '🔫',
    description: 'On turn 4, fires a piercing shot that ignores enemy DEF.',
    effect: { turnXAttack: { turn: 4, mult: 1, ignoreDef: true } },
  },
  'Gohan': {
    name: 'Hidden Potential',
    icon: '💢',
    description: 'When HP first drops below 40%, ATK +80% (once per fight).',
    effect: { lowHpAtkBoost: { threshold: 0.40, atkPct: 0.80, onceOnly: true } },
  },
  'Frieza': {
    name: 'Death Beam',
    icon: '☠️',
    description: 'First attack ignores enemy DEF entirely.',
    effect: { openerIgnoreDef: true },
  },
  'Vegeta': {
    name: 'Saiyan Pride',
    icon: '👑',
    description: '+8% ATK every time damage is taken, stacking.',
    effect: { painPackerPct: 0.08 },
  },
  'Goku': {
    name: 'Super Saiyan',
    icon: '🟡',
    description: 'Below 30% HP: ATK +60% and Speed +30%.',
    effect: { lowHpAtkBoost: { threshold: 0.30, atkPct: 0.60, speedPct: 0.30 } },
  },

  // ════════ Arc 4 — Dragon Ball Z: Super ═════════════════════════════════════
  'Yamcha': {
    name: 'Wolf Fang Fist',
    icon: '🐺',
    description: 'First attack hits 3 times at 40% damage each.',
    effect: { openerMultiHit: { count: 3, damagePct: 0.40 } },
  },
  'Future Trunks': {
    name: 'Heat Dome Attack',
    icon: '⚔️',
    description: '25% chance for double damage on any attack.',
    effect: { critChance: 0.25, critMult: 2.0 },
  },
  'Android 18': {
    name: 'Energy Absorption',
    icon: '🔋',
    description: 'Heals for 25% of damage taken.',
    effect: { absorbPct: 0.25 },
  },
  'Cell': {
    name: 'Regeneration',
    icon: '🦗',
    description: 'Heals 12% max HP per turn.',
    effect: { regenPct: 0.12 },
  },
  'Majin Buu': {
    name: 'Reform',
    icon: '🍭',
    description: 'First time HP reaches 0, revives at 40% HP (once per fight).',
    effect: { reviveOnce: { hpPct: 0.40 } },
  },

  // ════════ Arc 5 — One Piece: East Blue ═════════════════════════════════════
  'Nami': {
    name: 'Thunderbolt Tempo',
    icon: '⚡',
    description: '20% chance per attack to stun enemy (skip 1 turn).',
    effect: { stunChance: { chance: 0.20, turns: 1 } },
  },
  'Sanji': {
    name: 'Diable Jambe',
    icon: '🦵',
    description: 'Every 3rd attack deals double damage.',
    effect: { everyNthDouble: 3 },
  },
  'Portgas D. Ace': {
    name: 'Mera Mera Body',
    icon: '🔥',
    description: 'Takes 50% less damage from the first 3 attacks (logia immunity).',
    effect: { firstNAttacksReduction: { count: 3, pct: 0.50 } },
  },
  'Roronoa Zoro': {
    name: 'Three Sword Style',
    icon: '⚔️',
    description: 'Every attack hits 3 times at 45% damage each.',
    effect: { alwaysMultiHit: { count: 3, damagePct: 0.45 } },
  },
  'Monkey D. Luffy': {
    name: 'Gear Second',
    icon: '🔴',
    description: 'After turn 3: ATK +35% and Speed +35% permanently.',
    effect: { turnXBuff: { turn: 3, atkPct: 0.35, speedPct: 0.35 } },
  },

  // ════════ Arc 6 — One Piece: New World ═════════════════════════════════════
  'Usopp': {
    name: 'Sniper Shot',
    icon: '🎯',
    description: '20% chance to crit for 2× damage.',
    effect: { critChance: 0.20, critMult: 2.0 },
  },
  'Nico Robin': {
    name: 'Cien Fleur',
    icon: '🌸',
    description: 'Every attack hits twice at 60% damage each.',
    effect: { alwaysMultiHit: { count: 2, damagePct: 0.60 } },
  },
  'Trafalgar Law': {
    name: 'Room: Shambles',
    icon: '🏠',
    description: 'On turn 1, swaps ATK with the enemy if theirs is higher.',
    effect: { turnXSwapAtkIfEnemyHigher: { turn: 1 } },
  },
  'Boa Hancock': {
    name: 'Mero Mero Mellow',
    icon: '💘',
    description: '22% chance per attack to petrify the enemy (skip 2 turns).',
    effect: { stunChance: { chance: 0.22, turns: 2 } },
  },
  'Kaido': {
    name: 'Hybrid Form',
    icon: '🐉',
    description: 'Below 50% HP: ATK +30% and regenerates 8% HP per turn.',
    effect: { lowHpAtkBoost: { threshold: 0.50, atkPct: 0.30, regenPct: 0.08 } },
  },

  // ════════ Arc 7 — Attack on Titan: Survey Corps ════════════════════════════
  'Armin Arlert': {
    name: 'Strategist',
    icon: '🧠',
    description: 'Survives the first fatal blow with 1 HP (once per fight).',
    effect: { surviveFatalOnce: true },
  },
  'Historia Reiss': {
    name: 'Queen\'s Resolve',
    icon: '👑',
    description: 'Heals 10% max HP every 3 turns.',
    effect: { regenEveryNTurns: { turns: 3, pct: 0.10 } },
  },
  'Eren Yeager': {
    name: 'Titan Shift',
    icon: '🦴',
    description: 'After turn 4: gains +40% HP and +25% ATK.',
    effect: { turnXTransform: { turn: 4, hpAddPct: 0.40, atkPct: 0.25 } },
  },
  'Mikasa Ackerman': {
    name: 'Ackerman Bloodline',
    icon: '🩸',
    description: 'First attack is a guaranteed 2× crit.',
    effect: { openerCrit: { mult: 2.0 } },
  },
  'Levi Ackerman': {
    name: 'Humanity\'s Strongest',
    icon: '🗡️',
    description: 'Always attacks first; 30% chance for an extra turn.',
    effect: { firstStrike: true, extraAttackChance: 0.30 },
  },

  // ════════ Arc 8 — Attack on Titan: Final Season ════════════════════════════
  'Connie Springer': {
    name: 'Quick Footed',
    icon: '🏃',
    description: '+8% to all stats.',
    effect: { statBuffPct: { hp: 0.08, atk: 0.08, def: 0.08, speed: 0.08 } },
  },
  'Sasha Blouse': {
    name: 'Hunter\'s Instinct',
    icon: '🏹',
    description: '20% chance to dodge any incoming attack.',
    effect: { dodgeChance: 0.20 },
  },
  'Reiner Braun': {
    name: 'Armored Titan',
    icon: '🛡️',
    description: 'Takes 50% less damage from the first 3 attacks against him.',
    effect: { firstNAttacksReduction: { count: 3, pct: 0.50 } },
  },
  'Zeke Yeager': {
    name: 'Beast Titan Throw',
    icon: '⚾',
    description: 'On turn 1, hurls a projectile dealing 15% of enemy max HP as bonus damage.',
    effect: { turnXBonusEnemyMaxHp: { turn: 1, enemyMaxHpPct: 0.15 } },
  },
  'Eren (Founding Titan)': {
    name: 'Founding Titan',
    icon: '🌍',
    description: 'Each turn, enemy ATK is reduced by 6% (stacking down).',
    effect: { enemyAtkRampDownPct: 0.06 },
  },

  // ════════ Arc 9 — My Hero Academia: UA High ════════════════════════════════
  'Ochaco Uraraka': {
    name: 'Zero Gravity',
    icon: '🎈',
    description: '20% chance to negate any enemy attack.',
    effect: { dodgeChance: 0.20 },
  },
  'Izuku Midoriya': {
    name: 'One For All',
    icon: '✨',
    description: '+7% ATK every turn, stacking.',
    effect: { atkRampPct: 0.07 },
  },
  'Katsuki Bakugo': {
    name: 'Explosion',
    icon: '💥',
    description: '25% chance to crit for 2× damage.',
    effect: { critChance: 0.25, critMult: 2.0 },
  },
  'Shoto Todoroki': {
    name: 'Half Cold Half Hot',
    icon: '🧊',
    description: 'Odd turns: +25% ATK. Even turns: +25% DEF.',
    effect: { alternatingBuff: { atkPct: 0.25, defPct: 0.25 } },
  },
  'All Might': {
    name: 'Symbol of Peace',
    icon: '💪',
    description: 'Below 50% HP: ATK +50% and gains 10% lifesteal.',
    effect: { lowHpAtkBoost: { threshold: 0.50, atkPct: 0.50, lifestealPct: 0.10 } },
  },

  // ════════ Arc 10 — My Hero Academia: Sports Festival ═══════════════════════
  'Minoru Mineta': {
    name: 'Pop Off',
    icon: '🟣',
    description: 'First attack reduces enemy speed by 40% for 2 turns.',
    effect: { openerSpeedDebuff: { turns: 2, pct: 0.40 } },
  },
  'Eijiro Kirishima': {
    name: 'Unbreakable',
    icon: '🪨',
    description: 'Below 50% HP, takes 40% less damage.',
    effect: { lowHpDamageReduction: { threshold: 0.50, pct: 0.40 } },
  },
  'Momo Yaoyorozu': {
    name: 'Creation',
    icon: '🧪',
    description: 'Heals 8% max HP per turn.',
    effect: { regenPct: 0.08 },
  },
  'Hawks': {
    name: 'Wings of Glory',
    icon: '🪶',
    description: 'Always attacks first; 35% chance for a follow-up attack each turn.',
    effect: { firstStrike: true, extraAttackChance: 0.35 },
  },
  'Tomura Shigaraki': {
    name: 'Decay',
    icon: '🖐️',
    description: 'Each attack permanently reduces enemy DEF by 12% (stacking).',
    effect: { enemyDefDecayPct: 0.12 },
  },

  // ════════ Arc 11 — Demon Slayer: Tanjiro's Journey ═════════════════════════
  'Zenitsu Agatsuma': {
    name: 'Thunderclap & Flash',
    icon: '⚡',
    description: 'Below 30% HP: always attacks first AND ATK +80%.',
    effect: { lowHpAtkBoost: { threshold: 0.30, atkPct: 0.80, firstStrikeWhenTriggered: true } },
  },
  'Inosuke Hashibira': {
    name: 'Beast Breathing',
    icon: '🐗',
    description: '35% chance to attack twice (dual-blade chaos).',
    effect: { multiHitChance: { chance: 0.35, count: 2, damagePct: 1.0 } },
  },
  'Nezuko Kamado': {
    name: 'Blood Demon Art',
    icon: '🩸',
    description: 'Enemy burns for 6% max HP every turn after the first hit.',
    effect: { enemyBurnPct: 0.06 },
  },
  'Tanjiro Kamado': {
    name: 'Water Breathing',
    icon: '💧',
    description: 'Heals 5% max HP per turn; first attack always crits for 2×.',
    effect: { regenPct: 0.05, openerCrit: { mult: 2.0 } },
  },
  'Kyojuro Rengoku': {
    name: 'Flame Breathing',
    icon: '🔥',
    description: '+10% ATK every turn, stacking.',
    effect: { atkRampPct: 0.10 },
  },

  // ════════ Arc 12 — Demon Slayer: Upper Moon ════════════════════════════════
  'Genya Shinazugawa': {
    name: 'Demon Transformation',
    icon: '👹',
    description: 'Below 50% HP: ATK +40%.',
    effect: { lowHpAtkBoost: { threshold: 0.50, atkPct: 0.40 } },
  },
  'Mitsuri Kanroji': {
    name: 'Love Breathing',
    icon: '💖',
    description: 'Every attack hits 4 times at 35% damage each.',
    effect: { alwaysMultiHit: { count: 4, damagePct: 0.35 } },
  },
  'Gyomei Himejima': {
    name: 'Stone Breathing',
    icon: '🗿',
    description: 'Takes 25% less damage from every attack.',
    effect: { damageReductionPct: 0.25 },
  },
  'Doma': {
    name: 'Frozen Lotus',
    icon: '❄️',
    description: '25% chance per attack to freeze enemy (skip 1 turn).',
    effect: { stunChance: { chance: 0.25, turns: 1 } },
  },
  'Muzan Kibutsuji': {
    name: 'Demon King',
    icon: '👁️',
    description: 'Regenerates 10% HP per turn; revives once at 50% HP.',
    effect: { regenPct: 0.10, reviveOnce: { hpPct: 0.50 } },
  },

  // ════════ Arc 13 — Death Note: Kira Investigation ══════════════════════════
  'Misa Amane': {
    name: 'Shinigami Eyes',
    icon: '👀',
    description: '4% chance per turn to instantly defeat the enemy.',
    effect: { instantKillPerTurnChance: 0.04 },
  },
  'Near': {
    name: 'Pattern Recognition',
    icon: '♟️',
    description: 'After the enemy attacks 3 times, ATK +60% for the rest of the fight.',
    effect: { afterEnemyAttacksBuff: { count: 3, atkPct: 0.60 } },
  },
  'Ryuk': {
    name: 'Shinigami',
    icon: '🍎',
    description: 'Cannot die in a single hit (survives the first fatal blow at 1 HP).',
    effect: { surviveFatalOnce: true },
  },
  'Light Yagami': {
    name: 'Death Note',
    icon: '📓',
    description: '7% chance per turn to write the enemy\'s name (instant defeat).',
    effect: { instantKillPerTurnChance: 0.07 },
  },
  'L Lawliet': {
    name: 'The Detective',
    icon: '🍰',
    description: 'Dodges the first 2 incoming attacks; +25% ATK while above 70% HP.',
    effect: { firstNAttacksDodge: 2, aboveHpAtkBoost: { threshold: 0.70, atkPct: 0.25 } },
  },

  // ════════ Arc 14 — Death Note: Wammy's House ═══════════════════════════════
  'Matsuda': {
    name: 'Lucky Shot',
    icon: '🚓',
    description: 'First attack is a guaranteed 2× crit.',
    effect: { openerCrit: { mult: 2.0 } },
  },
  'Mello': {
    name: 'Reckless',
    icon: '💣',
    description: 'First attack crits for 2.5×, but the first hit taken deals +30% damage.',
    effect: { openerCrit: { mult: 2.5 }, firstHitTakenBonusPct: 0.30 },
  },
  'Matt': {
    name: 'Tactician',
    icon: '🎮',
    description: '+5% ATK every turn, stacking.',
    effect: { atkRampPct: 0.05 },
  },
  'Rem': {
    name: 'Shinigami\'s Love',
    icon: '💀',
    description: 'On turn 1, sacrifices 25% own HP to deal massive damage to the enemy.',
    effect: { turnXSacrifice: { turn: 1, selfHpPct: 0.25, damageMult: 5 } },
  },
  'Light Yagami (Kira)': {
    name: 'Final Notebook',
    icon: '📕',
    description: '10% chance per turn for instant defeat; +20% ATK while above 50% HP.',
    effect: { instantKillPerTurnChance: 0.10, aboveHpAtkBoost: { threshold: 0.50, atkPct: 0.20 } },
  },

  // ════════ Arc 15 — Fullmetal Alchemist: Brother's Journey ══════════════════
  'Winry Rockbell': {
    name: 'Mechanic\'s Care',
    icon: '🔧',
    description: 'Heals 7% max HP per turn.',
    effect: { regenPct: 0.07 },
  },
  'Alphonse Elric': {
    name: 'Soul-Bound Armor',
    icon: '🛡️',
    description: 'Survives the first fatal blow with 1 HP (once per fight).',
    effect: { surviveFatalOnce: true },
  },
  'Edward Elric': {
    name: 'Alchemy',
    icon: '⚗️',
    description: 'Each attack deals bonus damage equal to 15% of own DEF.',
    effect: { bonusDamageFromOwnDefPct: 0.15 },
  },
  'Scar': {
    name: 'Destructive Alchemy',
    icon: '💥',
    description: 'Each attack deals additional damage equal to 8% of enemy max HP.',
    effect: { bonusDamageFromEnemyMaxHpPct: 0.08 },
  },
  'Roy Mustang': {
    name: 'Flame Alchemy',
    icon: '🔥',
    description: '35% chance per attack to burn enemy (6% max HP per turn for rest of fight).',
    effect: { burnOnHitChance: { chance: 0.35, pct: 0.06 } },
  },

  // ════════ Arc 16 — Fullmetal Alchemist: Brotherhood ════════════════════════
  'Maes Hughes': {
    name: 'Family Man',
    icon: '👨‍👧',
    description: '+25% ATK on turn 1 only.',
    effect: { firstTurnAtkBoost: 0.25 },
  },
  'Greed': {
    name: 'Ultimate Shield',
    icon: '💎',
    description: 'First 3 attacks against him deal only 40% damage (60% reduction).',
    effect: { firstNAttacksReduction: { count: 3, pct: 0.60 } },
  },
  'Olivier Armstrong': {
    name: 'Iron Will',
    icon: '❄️',
    description: 'Below 30% HP: ATK +40%.',
    effect: { lowHpAtkBoost: { threshold: 0.30, atkPct: 0.40 } },
  },
  'Pride': {
    name: 'Shadow',
    icon: '🌑',
    description: '30% chance to dodge any attack.',
    effect: { dodgeChance: 0.30 },
  },
  'Father': {
    name: 'Philosopher\'s Stone',
    icon: '🌐',
    description: 'Regenerates 14% max HP per turn.',
    effect: { regenPct: 0.14 },
  },

  // ════════ Arc 17 — Hunter x Hunter: Hunter Exam ════════════════════════════
  'Leorio Paradinight': {
    name: 'Doctor',
    icon: '💊',
    description: 'Heals 8% max HP per turn.',
    effect: { regenPct: 0.08 },
  },
  'Kurapika': {
    name: 'Chain Jail',
    icon: '⛓️',
    description: '25% chance per attack to bind enemy (skip 1 turn).',
    effect: { stunChance: { chance: 0.25, turns: 1 } },
  },
  'Gon Freecss': {
    name: 'Jajanken',
    icon: '✊',
    description: 'Charges turns 1–3 (50% damage), then unleashes 3× damage from turn 4 onward.',
    effect: { chargeRelease: { chargeTurns: 3, chargePct: 0.50, releaseMult: 3.0 } },
  },
  'Killua Zoldyck': {
    name: 'Godspeed',
    icon: '⚡',
    description: 'Always attacks first; 30% chance to attack twice each turn.',
    effect: { firstStrike: true, extraAttackChance: 0.30 },
  },
  'Hisoka Morow': {
    name: 'Bungee Gum',
    icon: '🃏',
    description: 'Returns 35% of damage taken back to the attacker.',
    effect: { counterPct: 0.35 },
  },

  // ════════ Arc 18 — Hunter x Hunter: Chimera Ant ════════════════════════════
  'Biscuit Krueger': {
    name: 'True Form',
    icon: '💪',
    description: 'Below 50% HP, transforms: HP +30%, ATK +40%.',
    effect: { lowHpTransform: { threshold: 0.50, hpAddPct: 0.30, atkPct: 0.40 } },
  },
  'Feitan': {
    name: 'Pain Packer',
    icon: '🔥',
    description: '+12% ATK each time damage is taken, stacking.',
    effect: { painPackerPct: 0.12 },
  },
  'Neferpitou': {
    name: 'Doctor Blythe',
    icon: '🐈',
    description: 'Heals 11% max HP per turn.',
    effect: { regenPct: 0.11 },
  },
  'Illumi Zoldyck': {
    name: 'Needle Manipulation',
    icon: '📍',
    description: '25% chance to redirect enemy attack back to themselves.',
    effect: { redirectChance: 0.25 },
  },
  'Meruem': {
    name: 'King\'s Evolution',
    icon: '👑',
    description: '+6% ATK and +6% DEF every turn, stacking forever.',
    effect: { atkRampPct: 0.06, defRampPct: 0.06 },
  },

  // ════════ Arc 19 — Sword Art Online: Aincrad ═══════════════════════════════
  'Klein': {
    name: 'Katana Style',
    icon: '🗾',
    description: '+10% to all stats.',
    effect: { statBuffPct: { hp: 0.10, atk: 0.10, def: 0.10, speed: 0.10 } },
  },
  'Sinon': {
    name: 'Hecate Sniper',
    icon: '🎯',
    description: '30% chance to crit for 2.5× damage.',
    effect: { critChance: 0.30, critMult: 2.5 },
  },
  'Asuna': {
    name: 'Lightning Flash',
    icon: '⚡',
    description: 'Always attacks first; +30% Speed.',
    effect: { firstStrike: true, statBuffPct: { speed: 0.30 } },
  },
  'Alice': {
    name: 'Integrity Knight',
    icon: '🌹',
    description: 'Takes 35% less damage from the first 4 attacks against her.',
    effect: { firstNAttacksReduction: { count: 4, pct: 0.35 } },
  },
  'Kirito': {
    name: 'Dual Wielding',
    icon: '⚔️',
    description: 'Every attack hits twice at 70% damage each.',
    effect: { alwaysMultiHit: { count: 2, damagePct: 0.70 } },
  },

  // ════════ Arc 20 — Sword Art Online: Alicization ═══════════════════════════
  'Leafa': {
    name: 'Wind Magic',
    icon: '🍃',
    description: 'Heals 9% max HP per turn.',
    effect: { regenPct: 0.09 },
  },
  'Eugeo': {
    name: 'Blue Rose Sword',
    icon: '🌹',
    description: '25% chance per attack to freeze enemy (skip 1 turn).',
    effect: { stunChance: { chance: 0.25, turns: 1 } },
  },
  'Bercouli': {
    name: 'Time-Splitting Sword',
    icon: '⏳',
    description: '15% chance per attack to deal bonus damage equal to 25% of enemy max HP.',
    effect: { chanceMaxHpDmg: { chance: 0.15, enemyMaxHpPct: 0.25 } },
  },
  'Cardinal': {
    name: 'Sacred Arts',
    icon: '📜',
    description: 'Heals 10% max HP per turn and 15% of all damage taken.',
    effect: { regenPct: 0.10, absorbPct: 0.15 },
  },
  'Administrator': {
    name: 'Stacia',
    icon: '🌌',
    description: 'Revives once at 60% HP; first 2 attacks against her deal 50% damage.',
    effect: { reviveOnce: { hpPct: 0.60 }, firstNAttacksReduction: { count: 2, pct: 0.50 } },
  },

  // ════════ Arc 21 — Jujutsu Kaisen: Tokyo Jujutsu High ══════════════════════
  'Nobara Kugisaki': {
    name: 'Resonance',
    icon: '🔨',
    description: '18% chance per attack to inflict a hammer-and-nail bleed (3% max HP per turn).',
    effect: { burnOnHitChance: { chance: 0.18, pct: 0.03 } },
  },
  'Maki Zenin': {
    name: 'Cursed Tools',
    icon: '⚔️',
    description: 'Every attack hits twice at 55% damage each (dual weapons).',
    effect: { alwaysMultiHit: { count: 2, damagePct: 0.55 } },
  },
  'Megumi Fushiguro': {
    name: 'Divine Dogs',
    icon: '🐺',
    description: '25% chance to attack twice (shadow hounds).',
    effect: { multiHitChance: { chance: 0.25, count: 2, damagePct: 1.0 } },
  },
  'Yuji Itadori': {
    name: 'Divergent Fist',
    icon: '👊',
    description: 'First attack hits twice at 75% damage each (instant follow-up punch).',
    effect: { openerMultiHit: { count: 2, damagePct: 0.75 } },
  },
  'Satoru Gojo': {
    name: 'Infinity',
    icon: '👁️',
    description: 'Takes 60% less damage from every attack (limitless barrier).',
    effect: { damageReductionPct: 0.60 },
  },

  // ════════ Arc 22 — Jujutsu Kaisen: Shibuya Incident ════════════════════════
  'Inumaki Toge': {
    name: 'Cursed Speech',
    icon: '🍙',
    description: '12% chance per attack to stun enemy with a cursed command.',
    effect: { stunChance: { chance: 0.12, turns: 1 } },
  },
  'Aoi Todo': {
    name: 'Boogie Woogie',
    icon: '💪',
    description: 'Every attack hits twice at 65% damage each (clap-and-strike combo).',
    effect: { alwaysMultiHit: { count: 2, damagePct: 0.65 } },
  },
  'Kento Nanami': {
    name: 'Ratio Technique',
    icon: '🔪',
    description: '30% chance to strike a weak point for 2× damage.',
    effect: { critChance: 0.30, critMult: 2.0 },
  },
  'Sukuna': {
    name: 'Cleave',
    icon: '🩸',
    description: 'Each attack deals additional damage equal to 12% of enemy max HP.',
    effect: { bonusDamageFromEnemyMaxHpPct: 0.12 },
  },
  'Mahito': {
    name: 'Idle Transfiguration',
    icon: '👻',
    description: 'Heals 12% max HP per turn (reshapes own body); ATK +30% below 50% HP.',
    effect: { regenPct: 0.12, lowHpAtkBoost: { threshold: 0.50, atkPct: 0.30 } },
  },

  // ════════ Arc 23 — Bleach: Soul Society ════════════════════════════════════
  'Hanataro Yamada': {
    name: '4th Squad Healer',
    icon: '💊',
    description: 'Heals 4% max HP per turn.',
    effect: { regenPct: 0.04 },
  },
  'Rukia Kuchiki': {
    name: 'Some no Mai',
    icon: '❄️',
    description: '20% chance per attack to freeze enemy for 2 turns.',
    effect: { stunChance: { chance: 0.20, turns: 2 } },
  },
  'Renji Abarai': {
    name: 'Hikotsu Taiho',
    icon: '🐍',
    description: 'On turn 3, fires a baboon-king blast dealing 3× damage.',
    effect: { turnXAttack: { turn: 3, mult: 3 } },
  },
  'Byakuya Kuchiki': {
    name: 'Senka',
    icon: '🌸',
    description: 'Always strikes first; first attack ignores enemy DEF (flash step behind).',
    effect: { firstStrike: true, openerIgnoreDef: true },
  },
  'Ichigo Kurosaki': {
    name: 'Bankai: Tensa Zangetsu',
    icon: '⚔️',
    description: 'Below 30% HP: ATK +60% and Speed +50% (final getsuga).',
    effect: { lowHpAtkBoost: { threshold: 0.30, atkPct: 0.60, speedPct: 0.50 } },
  },

  // ════════ Arc 24 — Bleach: Hueco Mundo ═════════════════════════════════════
  'Don Kanonji': {
    name: 'BOHAHAHA',
    icon: '🎤',
    description: '+12% to all stats (overflowing confidence).',
    effect: { statBuffPct: { hp: 0.12, atk: 0.12, def: 0.12, speed: 0.12 } },
  },
  'Grimmjow Jaegerjaquez': {
    name: 'Pantera',
    icon: '🐆',
    description: '30% chance for an extra attack each turn (panther savagery).',
    effect: { extraAttackChance: 0.30 },
  },
  'Ulquiorra Cifer': {
    name: 'Lanza del Relampago',
    icon: '🦇',
    description: 'On turn 4, fires a lightning lance dealing 20% of enemy max HP as bonus damage.',
    effect: { turnXBonusEnemyMaxHp: { turn: 4, enemyMaxHpPct: 0.20 } },
  },
  'Coyote Starrk': {
    name: 'Los Lobos',
    icon: '🐺',
    description: '25% chance to attack 3 times (wolf-pack pistols).',
    effect: { multiHitChance: { chance: 0.25, count: 3, damagePct: 0.70 } },
  },
  'Sosuke Aizen': {
    name: 'Kyoka Suigetsu',
    icon: '🦋',
    description: 'Always strikes first; 25% chance to dodge any attack (complete hypnosis).',
    effect: { firstStrike: true, dodgeChance: 0.25 },
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getAbility(characterName: string): Ability | null {
  return ABILITIES[characterName] ?? null
}

export function hasAbility(characterName: string): boolean {
  return characterName in ABILITIES
}
