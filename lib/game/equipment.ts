// ─── Equipment Catalog ────────────────────────────────────────────────────────
//
// Anime-themed gear for the 12 anime in the game. Each anime gets 6 items
// (2 commons, 2 rares, 1 epic, 1 legendary) across 3 slots (weapon/armor/accessory).
//
// Equipment is keyed by a unique string (e.g., 'naruto_kunai'). The key is
// referenced in user_equipment.equipment_key in the database.
//
// Items can only be equipped on characters from the matching anime (strict lock).

import type { Ability, AbilityEffect } from './abilities'
import { getAbility } from './abilities'

// ─── Types ────────────────────────────────────────────────────────────────────

export type EquipmentSlot   = 'weapon' | 'armor' | 'accessory'
export type EquipmentRarity = 'common' | 'rare' | 'epic' | 'legendary'

export type EquipmentEffect = {
  // Flat percentage stat boosts (multiplied on top of base/level/star/rank stats)
  hpPct?:    number
  atkPct?:   number
  defPct?:   number
  speedPct?: number
} & AbilityEffect   // can also grant any ability-style effect

export type Equipment = {
  key:         string             // unique id used in DB
  name:        string
  icon:        string
  anime:       string             // matches characters.source_anime exactly
  slot:        EquipmentSlot
  rarity:      EquipmentRarity
  description: string
  effect:      EquipmentEffect
}

// ─── Catalog ──────────────────────────────────────────────────────────────────

export const EQUIPMENT_CATALOG: Record<string, Equipment> = {

  // ════════ Naruto — ninja kit (stealth + speed) ═════════════════════════════
  'naruto_kunai': {
    key: 'naruto_kunai', name: 'Kunai', icon: '🗡️', anime: 'Naruto',
    slot: 'weapon', rarity: 'common',
    description: '+8% ATK',
    effect: { atkPct: 0.08 },
  },
  'naruto_forehead_protector': {
    key: 'naruto_forehead_protector', name: 'Forehead Protector', icon: '🎽', anime: 'Naruto',
    slot: 'armor', rarity: 'common',
    description: '+6% DEF, +4% HP',
    effect: { defPct: 0.06, hpPct: 0.04 },
  },
  'naruto_summoning_scroll': {
    key: 'naruto_summoning_scroll', name: 'Summoning Scroll', icon: '📜', anime: 'Naruto',
    slot: 'accessory', rarity: 'rare',
    description: '+10% Speed',
    effect: { speedPct: 0.10 },
  },
  'naruto_sage_cloak': {
    key: 'naruto_sage_cloak', name: 'Sage Cloak', icon: '🧥', anime: 'Naruto',
    slot: 'armor', rarity: 'rare',
    description: '+12% HP, +6% DEF',
    effect: { hpPct: 0.12, defPct: 0.06 },
  },
  'naruto_sharingan_eye': {
    key: 'naruto_sharingan_eye', name: 'Sharingan Eye', icon: '👁️', anime: 'Naruto',
    slot: 'accessory', rarity: 'epic',
    description: '+10% Speed, 12% chance to dodge attacks.',
    effect: { speedPct: 0.10, dodgeChance: 0.12 },
  },
  'naruto_hokage_hat': {
    key: 'naruto_hokage_hat', name: "Hokage's Hat", icon: '👒', anime: 'Naruto',
    slot: 'armor', rarity: 'legendary',
    description: '+18% HP, +12% DEF, regen 4% max HP per turn.',
    effect: { hpPct: 0.18, defPct: 0.12, regenPct: 0.04 },
  },

  // ════════ Dragon Ball Z — raw power kit ════════════════════════════════════
  'dbz_scouter': {
    key: 'dbz_scouter', name: 'Scouter', icon: '🕶️', anime: 'Dragon Ball Z',
    slot: 'accessory', rarity: 'common',
    description: '+6% Speed',
    effect: { speedPct: 0.06 },
  },
  'dbz_battle_gi': {
    key: 'dbz_battle_gi', name: 'Battle Gi', icon: '🥋', anime: 'Dragon Ball Z',
    slot: 'armor', rarity: 'common',
    description: '+8% HP',
    effect: { hpPct: 0.08 },
  },
  'dbz_power_pole': {
    key: 'dbz_power_pole', name: 'Power Pole', icon: '🥢', anime: 'Dragon Ball Z',
    slot: 'weapon', rarity: 'rare',
    description: '+12% ATK',
    effect: { atkPct: 0.12 },
  },
  'dbz_saiyan_armor': {
    key: 'dbz_saiyan_armor', name: 'Saiyan Armor', icon: '🛡️', anime: 'Dragon Ball Z',
    slot: 'armor', rarity: 'rare',
    description: '+12% DEF, +6% HP',
    effect: { defPct: 0.12, hpPct: 0.06 },
  },
  'dbz_senzu_bean': {
    key: 'dbz_senzu_bean', name: 'Senzu Bean Pouch', icon: '🫛', anime: 'Dragon Ball Z',
    slot: 'accessory', rarity: 'epic',
    description: '+8% HP, regen 5% max HP per turn.',
    effect: { hpPct: 0.08, regenPct: 0.05 },
  },
  'dbz_potara_earrings': {
    key: 'dbz_potara_earrings', name: 'Potara Earrings', icon: '💍', anime: 'Dragon Ball Z',
    slot: 'accessory', rarity: 'legendary',
    description: '+20% ATK, +15% Speed.',
    effect: { atkPct: 0.20, speedPct: 0.15 },
  },

  // ════════ One Piece — pirate kit ═══════════════════════════════════════════
  'op_cutlass': {
    key: 'op_cutlass', name: 'Cutlass', icon: '⚔️', anime: 'One Piece',
    slot: 'weapon', rarity: 'common',
    description: '+8% ATK',
    effect: { atkPct: 0.08 },
  },
  'op_sailors_bandana': {
    key: 'op_sailors_bandana', name: "Sailor's Bandana", icon: '🎽', anime: 'One Piece',
    slot: 'armor', rarity: 'common',
    description: '+8% HP',
    effect: { hpPct: 0.08 },
  },
  'op_marine_coat': {
    key: 'op_marine_coat', name: 'Marine Coat', icon: '🧥', anime: 'One Piece',
    slot: 'armor', rarity: 'rare',
    description: '+12% DEF',
    effect: { defPct: 0.12 },
  },
  'op_eternal_pose': {
    key: 'op_eternal_pose', name: 'Eternal Pose', icon: '🧭', anime: 'One Piece',
    slot: 'accessory', rarity: 'rare',
    description: '+10% Speed',
    effect: { speedPct: 0.10 },
  },
  'op_den_den_mushi': {
    key: 'op_den_den_mushi', name: 'Den Den Mushi', icon: '🐌', anime: 'One Piece',
    slot: 'accessory', rarity: 'epic',
    description: '+6% to all stats.',
    effect: { hpPct: 0.06, atkPct: 0.06, defPct: 0.06, speedPct: 0.06 },
  },
  'op_devil_fruit': {
    key: 'op_devil_fruit', name: 'A Devil Fruit', icon: '🍎', anime: 'One Piece',
    slot: 'accessory', rarity: 'legendary',
    description: '+15% ATK, +15% Speed, 8% chance to dodge attacks.',
    effect: { atkPct: 0.15, speedPct: 0.15, dodgeChance: 0.08 },
  },

  // ════════ Attack on Titan — military gear ══════════════════════════════════
  'aot_maneuver_blade': {
    key: 'aot_maneuver_blade', name: 'Maneuver Blade', icon: '🗡️', anime: 'Attack on Titan',
    slot: 'weapon', rarity: 'common',
    description: '+8% ATK',
    effect: { atkPct: 0.08 },
  },
  'aot_cadet_uniform': {
    key: 'aot_cadet_uniform', name: 'Cadet Uniform', icon: '🎽', anime: 'Attack on Titan',
    slot: 'armor', rarity: 'common',
    description: '+8% HP',
    effect: { hpPct: 0.08 },
  },
  'aot_survey_cloak': {
    key: 'aot_survey_cloak', name: 'Survey Corps Cloak', icon: '🧥', anime: 'Attack on Titan',
    slot: 'armor', rarity: 'rare',
    description: '+10% DEF, +5% HP',
    effect: { defPct: 0.10, hpPct: 0.05 },
  },
  'aot_odm_gear': {
    key: 'aot_odm_gear', name: 'ODM Gear', icon: '⚙️', anime: 'Attack on Titan',
    slot: 'accessory', rarity: 'rare',
    description: '+15% Speed',
    effect: { speedPct: 0.15 },
  },
  'aot_thunder_spear': {
    key: 'aot_thunder_spear', name: 'Thunder Spear', icon: '⚡', anime: 'Attack on Titan',
    slot: 'weapon', rarity: 'epic',
    description: '+15% ATK, 10% chance per attack to ignore enemy DEF.',
    effect: { atkPct: 0.15, ignoreDefChance: 0.10 },
  },
  'aot_titan_serum': {
    key: 'aot_titan_serum', name: 'Titan Serum', icon: '💉', anime: 'Attack on Titan',
    slot: 'accessory', rarity: 'legendary',
    description: '+20% HP, +15% ATK.',
    effect: { hpPct: 0.20, atkPct: 0.15 },
  },

  // ════════ My Hero Academia — hero gear ═════════════════════════════════════
  'mha_hero_mask': {
    key: 'mha_hero_mask', name: 'Hero Mask', icon: '🎭', anime: 'My Hero Academia',
    slot: 'accessory', rarity: 'common',
    description: '+6% Speed',
    effect: { speedPct: 0.06 },
  },
  'mha_hero_costume': {
    key: 'mha_hero_costume', name: 'Hero Costume', icon: '🦸', anime: 'My Hero Academia',
    slot: 'armor', rarity: 'common',
    description: '+8% HP',
    effect: { hpPct: 0.08 },
  },
  'mha_support_belt': {
    key: 'mha_support_belt', name: 'Support Belt', icon: '🎒', anime: 'My Hero Academia',
    slot: 'accessory', rarity: 'rare',
    description: '+10% DEF',
    effect: { defPct: 0.10 },
  },
  'mha_quirk_boots': {
    key: 'mha_quirk_boots', name: 'Quirk Boots', icon: '🥾', anime: 'My Hero Academia',
    slot: 'accessory', rarity: 'rare',
    description: '+12% Speed',
    effect: { speedPct: 0.12 },
  },
  'mha_iida_greaves': {
    key: 'mha_iida_greaves', name: 'Iida Engine Greaves', icon: '🦿', anime: 'My Hero Academia',
    slot: 'accessory', rarity: 'epic',
    description: '+18% Speed, strikes first on round 1.',
    effect: { speedPct: 0.18, firstStrikeRound1: true },
  },
  'mha_allmight_belt': {
    key: 'mha_allmight_belt', name: "All Might's Belt", icon: '💪', anime: 'My Hero Academia',
    slot: 'armor', rarity: 'legendary',
    description: '+18% HP, +15% ATK, 8% lifesteal.',
    effect: { hpPct: 0.18, atkPct: 0.15, lifestealPct: 0.08 },
  },

  // ════════ Demon Slayer — swords + breathing ════════════════════════════════
  'ds_practice_sword': {
    key: 'ds_practice_sword', name: 'Practice Sword', icon: '🪵', anime: 'Demon Slayer',
    slot: 'weapon', rarity: 'common',
    description: '+6% ATK',
    effect: { atkPct: 0.06 },
  },
  'ds_hashira_uniform': {
    key: 'ds_hashira_uniform', name: 'Hashira Uniform', icon: '🎽', anime: 'Demon Slayer',
    slot: 'armor', rarity: 'common',
    description: '+8% HP',
    effect: { hpPct: 0.08 },
  },
  'ds_wisteria_beads': {
    key: 'ds_wisteria_beads', name: 'Wisteria Beads', icon: '💜', anime: 'Demon Slayer',
    slot: 'accessory', rarity: 'rare',
    description: '+10% DEF',
    effect: { defPct: 0.10 },
  },
  'ds_hashira_haori': {
    key: 'ds_hashira_haori', name: 'Hashira Haori', icon: '🧥', anime: 'Demon Slayer',
    slot: 'armor', rarity: 'rare',
    description: '+12% HP, +5% DEF',
    effect: { hpPct: 0.12, defPct: 0.05 },
  },
  'ds_demon_slayer_mark': {
    key: 'ds_demon_slayer_mark', name: 'Demon Slayer Mark', icon: '🔥', anime: 'Demon Slayer',
    slot: 'accessory', rarity: 'epic',
    description: '+12% ATK, +8% Speed.',
    effect: { atkPct: 0.12, speedPct: 0.08 },
  },
  'ds_nichirin_sword': {
    key: 'ds_nichirin_sword', name: 'Nichirin Sword', icon: '🗡️', anime: 'Demon Slayer',
    slot: 'weapon', rarity: 'legendary',
    description: '+20% ATK, 15% crit chance for 2× damage.',
    effect: { atkPct: 0.20, critChance: 0.15, critMult: 2.0 },
  },

  // ════════ Death Note — mind game kit ═══════════════════════════════════════
  'dn_notebook_page': {
    key: 'dn_notebook_page', name: 'Notebook Page', icon: '📄', anime: 'Death Note',
    slot: 'accessory', rarity: 'common',
    description: '+6% to all stats.',
    effect: { hpPct: 0.06, atkPct: 0.06, defPct: 0.06, speedPct: 0.06 },
  },
  'dn_detective_coat': {
    key: 'dn_detective_coat', name: "Detective's Coat", icon: '🧥', anime: 'Death Note',
    slot: 'armor', rarity: 'common',
    description: '+8% DEF',
    effect: { defPct: 0.08 },
  },
  'dn_shinigami_apple': {
    key: 'dn_shinigami_apple', name: 'Shinigami Apple', icon: '🍎', anime: 'Death Note',
    slot: 'accessory', rarity: 'rare',
    description: '+10% HP, regen 2% max HP per turn.',
    effect: { hpPct: 0.10, regenPct: 0.02 },
  },
  'dn_l_spoon': {
    key: 'dn_l_spoon', name: "L's Spoon", icon: '🥄', anime: 'Death Note',
    slot: 'accessory', rarity: 'rare',
    description: '+10% Speed',
    effect: { speedPct: 0.10 },
  },
  'dn_surveillance_kit': {
    key: 'dn_surveillance_kit', name: 'Surveillance Kit', icon: '📹', anime: 'Death Note',
    slot: 'accessory', rarity: 'epic',
    description: '+12% to all stats.',
    effect: { hpPct: 0.12, atkPct: 0.12, defPct: 0.12, speedPct: 0.12 },
  },
  'dn_death_note': {
    key: 'dn_death_note', name: 'The Death Note', icon: '📓', anime: 'Death Note',
    slot: 'accessory', rarity: 'legendary',
    description: '+10% ATK, 2% chance per turn for instant defeat.',
    effect: { atkPct: 0.10, instantKillPerTurnChance: 0.02 },
  },

  // ════════ Fullmetal Alchemist — alchemy kit ════════════════════════════════
  'fma_chalk_stick': {
    key: 'fma_chalk_stick', name: 'Chalk Stick', icon: '✏️', anime: 'Fullmetal Alchemist',
    slot: 'weapon', rarity: 'common',
    description: '+6% ATK',
    effect: { atkPct: 0.06 },
  },
  'fma_military_coat': {
    key: 'fma_military_coat', name: 'Military Coat', icon: '🧥', anime: 'Fullmetal Alchemist',
    slot: 'armor', rarity: 'common',
    description: '+8% HP',
    effect: { hpPct: 0.08 },
  },
  'fma_pocket_watch': {
    key: 'fma_pocket_watch', name: 'Pocket Watch', icon: '⏱️', anime: 'Fullmetal Alchemist',
    slot: 'accessory', rarity: 'rare',
    description: '+10% Speed',
    effect: { speedPct: 0.10 },
  },
  'fma_automail_arm': {
    key: 'fma_automail_arm', name: 'Automail Arm', icon: '🦾', anime: 'Fullmetal Alchemist',
    slot: 'weapon', rarity: 'rare',
    description: '+12% ATK, +5% DEF',
    effect: { atkPct: 0.12, defPct: 0.05 },
  },
  'fma_transmutation_gloves': {
    key: 'fma_transmutation_gloves', name: 'Transmutation Gloves', icon: '🧤', anime: 'Fullmetal Alchemist',
    slot: 'weapon', rarity: 'epic',
    description: '+15% ATK, attacks deal bonus damage equal to 10% of own DEF.',
    effect: { atkPct: 0.15, bonusDamageFromOwnDefPct: 0.10 },
  },
  'fma_philosopher_stone': {
    key: 'fma_philosopher_stone', name: "Philosopher's Stone Fragment", icon: '💎', anime: 'Fullmetal Alchemist',
    slot: 'accessory', rarity: 'legendary',
    description: '+12% to all stats.',
    effect: { hpPct: 0.12, atkPct: 0.12, defPct: 0.12, speedPct: 0.12 },
  },

  // ════════ Hunter x Hunter — Nen kit ════════════════════════════════════════
  'hxh_fishing_rod': {
    key: 'hxh_fishing_rod', name: 'Fishing Rod', icon: '🎣', anime: 'Hunter x Hunter',
    slot: 'weapon', rarity: 'common',
    description: '+6% ATK',
    effect: { atkPct: 0.06 },
  },
  'hxh_hunter_outfit': {
    key: 'hxh_hunter_outfit', name: 'Hunter Outfit', icon: '🎽', anime: 'Hunter x Hunter',
    slot: 'armor', rarity: 'common',
    description: '+8% HP',
    effect: { hpPct: 0.08 },
  },
  'hxh_hunter_license': {
    key: 'hxh_hunter_license', name: 'Hunter License', icon: '🪪', anime: 'Hunter x Hunter',
    slot: 'accessory', rarity: 'rare',
    description: '+8% to all stats.',
    effect: { hpPct: 0.08, atkPct: 0.08, defPct: 0.08, speedPct: 0.08 },
  },
  'hxh_nen_stone': {
    key: 'hxh_nen_stone', name: 'Nen Stone', icon: '🔮', anime: 'Hunter x Hunter',
    slot: 'accessory', rarity: 'rare',
    description: '+12% ATK',
    effect: { atkPct: 0.12 },
  },
  'hxh_aura_cloak': {
    key: 'hxh_aura_cloak', name: 'Aura Cloak', icon: '🧥', anime: 'Hunter x Hunter',
    slot: 'armor', rarity: 'epic',
    description: '+15% HP, +10% DEF.',
    effect: { hpPct: 0.15, defPct: 0.10 },
  },
  'hxh_bungee_gum': {
    key: 'hxh_bungee_gum', name: 'Bungee Gum Vial', icon: '🃏', anime: 'Hunter x Hunter',
    slot: 'accessory', rarity: 'legendary',
    description: '+15% ATK, returns 20% of damage taken to attacker.',
    effect: { atkPct: 0.15, counterPct: 0.20 },
  },

  // ════════ Sword Art Online — gamer kit ═════════════════════════════════════
  'sao_iron_sword': {
    key: 'sao_iron_sword', name: 'Iron Sword', icon: '⚔️', anime: 'Sword Art Online',
    slot: 'weapon', rarity: 'common',
    description: '+6% ATK',
    effect: { atkPct: 0.06 },
  },
  'sao_adventurers_cloak': {
    key: 'sao_adventurers_cloak', name: "Adventurer's Cloak", icon: '🧥', anime: 'Sword Art Online',
    slot: 'armor', rarity: 'common',
    description: '+8% HP',
    effect: { hpPct: 0.08 },
  },
  'sao_healing_crystal': {
    key: 'sao_healing_crystal', name: 'Crystal of Healing', icon: '💠', anime: 'Sword Art Online',
    slot: 'accessory', rarity: 'rare',
    description: 'Regen 6% max HP per turn.',
    effect: { regenPct: 0.06 },
  },
  'sao_knights_helm': {
    key: 'sao_knights_helm', name: "Knight's Helm", icon: '⛑️', anime: 'Sword Art Online',
    slot: 'armor', rarity: 'rare',
    description: '+10% DEF, +5% HP',
    effect: { defPct: 0.10, hpPct: 0.05 },
  },
  'sao_linear_stab': {
    key: 'sao_linear_stab', name: 'Linear Stab Skill', icon: '📐', anime: 'Sword Art Online',
    slot: 'accessory', rarity: 'epic',
    description: '+12% ATK, 15% crit chance for 2× damage.',
    effect: { atkPct: 0.12, critChance: 0.15, critMult: 2.0 },
  },
  'sao_elucidator': {
    key: 'sao_elucidator', name: 'Elucidator', icon: '🗡️', anime: 'Sword Art Online',
    slot: 'weapon', rarity: 'legendary',
    description: '+22% ATK, every attack hits twice at 60% damage each.',
    effect: { atkPct: 0.22, alwaysMultiHit: { count: 2, damagePct: 0.60 } },
  },

  // ════════ Jujutsu Kaisen — cursed energy kit ═══════════════════════════════
  'jjk_bento_box': {
    key: 'jjk_bento_box', name: 'Bento Box', icon: '🍱', anime: 'Jujutsu Kaisen',
    slot: 'accessory', rarity: 'common',
    description: '+6% Speed',
    effect: { speedPct: 0.06 },
  },
  'jjk_school_uniform': {
    key: 'jjk_school_uniform', name: 'School Uniform', icon: '🎽', anime: 'Jujutsu Kaisen',
    slot: 'armor', rarity: 'common',
    description: '+8% HP',
    effect: { hpPct: 0.08 },
  },
  'jjk_cursed_tool': {
    key: 'jjk_cursed_tool', name: 'Cursed Tool', icon: '🗡️', anime: 'Jujutsu Kaisen',
    slot: 'weapon', rarity: 'rare',
    description: '+12% ATK',
    effect: { atkPct: 0.12 },
  },
  'jjk_cursed_charm': {
    key: 'jjk_cursed_charm', name: 'Cursed Energy Charm', icon: '👁️', anime: 'Jujutsu Kaisen',
    slot: 'accessory', rarity: 'rare',
    description: '+10% to all stats.',
    effect: { hpPct: 0.10, atkPct: 0.10, defPct: 0.10, speedPct: 0.10 },
  },
  'jjk_domain_marker': {
    key: 'jjk_domain_marker', name: 'Domain Marker', icon: '🌀', anime: 'Jujutsu Kaisen',
    slot: 'accessory', rarity: 'epic',
    description: '+15% ATK, +10% DEF.',
    effect: { atkPct: 0.15, defPct: 0.10 },
  },
  'jjk_inverted_spear': {
    key: 'jjk_inverted_spear', name: 'Inverted Spear of Heaven', icon: '🔱', anime: 'Jujutsu Kaisen',
    slot: 'weapon', rarity: 'legendary',
    description: '+20% ATK, 15% chance per attack to ignore enemy DEF.',
    effect: { atkPct: 0.20, ignoreDefChance: 0.15 },
  },

  // ════════ Bleach — Soul Reaper kit ═════════════════════════════════════════
  'bleach_asauchi': {
    key: 'bleach_asauchi', name: 'Asauchi', icon: '⚔️', anime: 'Bleach',
    slot: 'weapon', rarity: 'common',
    description: '+6% ATK',
    effect: { atkPct: 0.06 },
  },
  'bleach_shihakusho': {
    key: 'bleach_shihakusho', name: 'Shihakusho', icon: '🎽', anime: 'Bleach',
    slot: 'armor', rarity: 'common',
    description: '+8% HP',
    effect: { hpPct: 0.08 },
  },
  'bleach_sash': {
    key: 'bleach_sash', name: 'Soul Reaper Sash', icon: '🎀', anime: 'Bleach',
    slot: 'accessory', rarity: 'rare',
    description: '+8% Speed, +4% ATK.',
    effect: { speedPct: 0.08, atkPct: 0.04 },
  },
  'bleach_reiatsu_charm': {
    key: 'bleach_reiatsu_charm', name: 'Reiatsu Charm', icon: '💢', anime: 'Bleach',
    slot: 'accessory', rarity: 'rare',
    description: '+12% DEF',
    effect: { defPct: 0.12 },
  },
  'bleach_hollow_mask': {
    key: 'bleach_hollow_mask', name: 'Hollow Mask Fragment', icon: '💀', anime: 'Bleach',
    slot: 'accessory', rarity: 'epic',
    description: '+12% ATK, 10% lifesteal.',
    effect: { atkPct: 0.12, lifestealPct: 0.10 },
  },
  'bleach_bankai': {
    key: 'bleach_bankai', name: 'Bankai Manifest', icon: '🌌', anime: 'Bleach',
    slot: 'accessory', rarity: 'legendary',
    description: '+20% ATK, +20% Speed.',
    effect: { atkPct: 0.20, speedPct: 0.20 },
  },
}

// ─── Salvage / Shop economy ───────────────────────────────────────────────────

export const SPARKS_SALVAGE: Record<EquipmentRarity, number> = {
  common:    5,
  rare:      15,
  epic:      40,
  legendary: 100,
}

export const SPARKS_BUY: Record<EquipmentRarity, number> = {
  common:    15,
  rare:      45,
  epic:      120,
  legendary: 300,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getEquipment(key: string): Equipment | null {
  return EQUIPMENT_CATALOG[key] ?? null
}

export function listEquipmentForAnime(anime: string): Equipment[] {
  return Object.values(EQUIPMENT_CATALOG).filter(eq => eq.anime === anime)
}

// Sum up percentage stat bonuses from a list of equipped items
export function sumEquipmentStats(equipped: Equipment[]): { hpPct: number; atkPct: number; defPct: number; speedPct: number } {
  return equipped.reduce((acc, eq) => ({
    hpPct:    acc.hpPct    + (eq.effect.hpPct    ?? 0),
    atkPct:   acc.atkPct   + (eq.effect.atkPct   ?? 0),
    defPct:   acc.defPct   + (eq.effect.defPct   ?? 0),
    speedPct: acc.speedPct + (eq.effect.speedPct ?? 0),
  }), { hpPct: 0, atkPct: 0, defPct: 0, speedPct: 0 })
}

// Apply equipment stat bonuses to base stats
export function applyEquipmentStats(
  base: { hp: number; atk: number; def: number; speed: number },
  equipped: Equipment[],
): { hp: number; atk: number; def: number; speed: number } {
  const bonus = sumEquipmentStats(equipped)
  return {
    hp:    Math.round(base.hp    * (1 + bonus.hpPct)),
    atk:   Math.round(base.atk   * (1 + bonus.atkPct)),
    def:   Math.round(base.def   * (1 + bonus.defPct)),
    speed: Math.round(base.speed * (1 + bonus.speedPct)),
  }
}

// Merge a character's ability with equipment-granted effects.
// Most numerical effects ADD. critMult takes the max. Booleans OR. Some structured
// effects (alwaysMultiHit, etc.) take the equipment value if the ability doesn't have one.
export function mergeAbilityWithEquipment(
  characterName: string,
  equipped: Equipment[],
): Ability | null {
  const base = getAbility(characterName)
  if (!base && equipped.length === 0) return null

  const baseEffect: AbilityEffect = base?.effect ? { ...base.effect } : {}

  for (const eq of equipped) {
    const e = eq.effect

    // Additive numerical effects
    if (e.regenPct)                    baseEffect.regenPct                    = (baseEffect.regenPct                    ?? 0) + e.regenPct
    if (e.lifestealPct)                baseEffect.lifestealPct                = (baseEffect.lifestealPct                ?? 0) + e.lifestealPct
    if (e.dodgeChance)                 baseEffect.dodgeChance                 = (baseEffect.dodgeChance                 ?? 0) + e.dodgeChance
    if (e.critChance)                  baseEffect.critChance                  = (baseEffect.critChance                  ?? 0) + e.critChance
    if (e.counterPct)                  baseEffect.counterPct                  = (baseEffect.counterPct                  ?? 0) + e.counterPct
    if (e.instantKillPerTurnChance)    baseEffect.instantKillPerTurnChance    = (baseEffect.instantKillPerTurnChance    ?? 0) + e.instantKillPerTurnChance
    if (e.bonusDamageFromOwnDefPct)    baseEffect.bonusDamageFromOwnDefPct    = (baseEffect.bonusDamageFromOwnDefPct    ?? 0) + e.bonusDamageFromOwnDefPct
    if (e.bonusDamageFromEnemyMaxHpPct) baseEffect.bonusDamageFromEnemyMaxHpPct = (baseEffect.bonusDamageFromEnemyMaxHpPct ?? 0) + e.bonusDamageFromEnemyMaxHpPct
    if (e.absorbPct)                   baseEffect.absorbPct                   = (baseEffect.absorbPct                   ?? 0) + e.absorbPct
    if (e.painPackerPct)               baseEffect.painPackerPct               = (baseEffect.painPackerPct               ?? 0) + e.painPackerPct
    if (e.ignoreDefChance)             baseEffect.ignoreDefChance             = (baseEffect.ignoreDefChance             ?? 0) + e.ignoreDefChance

    // Take max for multipliers
    if (e.critMult)                    baseEffect.critMult                    = Math.max(baseEffect.critMult ?? 2.0, e.critMult)

    // Boolean OR
    if (e.firstStrike)                 baseEffect.firstStrike                 = true
    if (e.firstStrikeRound1)           baseEffect.firstStrikeRound1           = true
    if (e.openerIgnoreDef)             baseEffect.openerIgnoreDef             = true

    // Structured effects — only set if ability doesn't already define one
    if (e.alwaysMultiHit && !baseEffect.alwaysMultiHit) baseEffect.alwaysMultiHit = e.alwaysMultiHit
    if (e.multiHitChance  && !baseEffect.multiHitChance)  baseEffect.multiHitChance  = e.multiHitChance
  }

  return {
    name:        base?.name ?? 'Equipped',
    icon:        base?.icon ?? '⚙️',
    description: base?.description ?? 'Equipment-granted effects.',
    effect:      baseEffect,
  }
}
