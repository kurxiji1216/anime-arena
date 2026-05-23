export type Stage = {
  stage: number      // 1–5
  enemyName: string  // must match exactly the name in the characters table
}

export type Arc = {
  arc: number
  name: string
  anime: string
  emoji: string
  story: string      // 1-2 sentence flavor text shown in the arc UI
  stages: Stage[]
}

// ─── Difficulty & Reward Scaling ─────────────────────────────────────────────

// Arc difficulty: ×1.0 at Arc 1, ×2.5 at Arc 20 (linear)
export function arcDifficultyMultiplier(arc: number): number {
  return 1 + (arc - 1) * (1.5 / 19)
}

// Stage difficulty within an arc: stage 5 boss is ×1.25 vs stage 1
export function stageDifficultyMultiplier(stage: number): number {
  return 1 + (stage - 1) * 0.0625
}

// Combined enemy stat multiplier for a given arc + stage
export function stageEnemyMultiplier(arc: number, stage: number): number {
  return arcDifficultyMultiplier(arc) * stageDifficultyMultiplier(stage)
}

// Gem reward for first clearing a stage — scales with arc number
const BASE_STAGE_REWARDS = [5, 5, 10, 10, 25]
export function stageGemReward(arc: number, stage: number): number {
  const base = BASE_STAGE_REWARDS[stage - 1]
  return Math.round(base * (1 + (arc - 1) * 0.15))
}

// Bonus gems awarded automatically when all 5 stages of an arc are cleared
export function arcCompleteBonus(arc: number): number {
  return 30 + (arc - 1) * 10
}

// Suggested player level before tackling this arc
export function recommendedLevel(arc: number): number {
  return Math.max(1, (arc - 1) * 3)
}

// Human-readable difficulty tier for an arc
export function difficultyTier(arc: number): { label: string; color: string } {
  if (arc <= 4)  return { label: 'Beginner',     color: '#4ade80' }
  if (arc <= 8)  return { label: 'Intermediate', color: '#60a5fa' }
  if (arc <= 12) return { label: 'Advanced',     color: '#a78bfa' }
  if (arc <= 16) return { label: 'Expert',       color: '#fb923c' }
  return             { label: 'Master',          color: '#f87171' }
}

// ─── Arc Data ─────────────────────────────────────────────────────────────────

function makeArc(
  arc: number,
  name: string,
  anime: string,
  emoji: string,
  story: string,
  enemies: string[],
): Arc {
  return {
    arc,
    name,
    anime,
    emoji,
    story,
    stages: enemies.map((enemyName, i) => ({ stage: i + 1, enemyName })),
  }
}

export const CAMPAIGN: Arc[] = [
  makeArc(1, 'Naruto: Part 1', 'Naruto', '🍃',
    'Your journey begins in the Hidden Leaf. Face Konoha\'s finest before crossing blades with the legendary Sharingan.',
    ['Sakura Haruno', 'Naruto Uzumaki', 'Sasuke Uchiha', 'Kakashi Hatake', 'Itachi Uchiha']),

  makeArc(2, 'Naruto: Shippuden', 'Naruto', '🌀',
    'Years have passed and the ninja world has changed. Survive Akatsuki\'s pawns and face the Yellow Flash himself.',
    ['Rock Lee', 'Gaara', 'Tsunade', 'Obito Uchiha', 'Minato Namikaze']),

  makeArc(3, 'Dragon Ball Z: Saiyan Saga', 'Dragon Ball Z', '🐉',
    'Warriors from the stars have arrived on Earth. Prove yourself against the Z Fighters and earn the right to challenge the Saiyan Prince.',
    ['Piccolo', 'Gohan', 'Frieza', 'Vegeta', 'Goku']),

  makeArc(4, 'Dragon Ball Z: Super', 'Dragon Ball Z', '⚡',
    'Gods of Destruction stir the cosmos. Battle through Earth\'s misfits before clashing with the true evils of the Dragon Ball universe.',
    ['Yamcha', 'Future Trunks', 'Android 18', 'Cell', 'Majin Buu']),

  makeArc(5, 'One Piece: East Blue', 'One Piece', '🏴‍☠️',
    'The Grand Line calls, but first prove your worth in the East Blue — the weakest sea, or so they say.',
    ['Nami', 'Sanji', 'Portgas D. Ace', 'Roronoa Zoro', 'Monkey D. Luffy']),

  makeArc(6, 'One Piece: New World', 'One Piece', '🌊',
    'The New World is no place for the weak. Legends clash at the top of the world, and you must face them all.',
    ['Usopp', 'Nico Robin', 'Trafalgar Law', 'Boa Hancock', 'Kaido']),

  makeArc(7, 'Attack on Titan: Survey Corps', 'Attack on Titan', '⚙️',
    'Beyond the walls lies the unknown. Fight alongside humanity\'s last hope before facing their greatest warriors.',
    ['Armin Arlert', 'Historia Reiss', 'Eren Yeager', 'Mikasa Ackerman', 'Levi Ackerman']),

  makeArc(8, 'Attack on Titan: Final Season', 'Attack on Titan', '💀',
    'The world outside the walls is at war. Take sides in a conflict that will reshape history forever.',
    ['Connie Springer', 'Sasha Blouse', 'Reiner Braun', 'Zeke Yeager', 'Eren (Founding Titan)']),

  makeArc(9, 'My Hero Academia: UA High', 'My Hero Academia', '💪',
    'Quirks run wild at UA High. Clash with the next generation of heroes before taking on the Symbol of Peace.',
    ['Ochaco Uraraka', 'Izuku Midoriya', 'Katsuki Bakugo', 'Shoto Todoroki', 'All Might']),

  makeArc(10, 'My Hero Academia: Sports Festival', 'My Hero Academia', '🔥',
    'The Sports Festival exposes both heroes and villains. Prove your worth in the arena — then face the League itself.',
    ['Minoru Mineta', 'Eijiro Kirishima', 'Momo Yaoyorozu', 'Hawks', 'Tomura Shigaraki']),

  makeArc(11, "Demon Slayer: Tanjiro's Journey", 'Demon Slayer', '🗡️',
    'A boy turned demon slayer walks the path of the sun. Battle his companions to challenge the Flame Hashira.',
    ['Zenitsu Agatsuma', 'Inosuke Hashibira', 'Nezuko Kamado', 'Tanjiro Kamado', 'Kyojuro Rengoku']),

  makeArc(12, 'Demon Slayer: Upper Moon', 'Demon Slayer', '🌙',
    'The Upper Moons do not fall easily. Survive the Hashira before confronting the Demon King himself.',
    ['Genya Shinazugawa', 'Mitsuri Kanroji', 'Gyomei Himejima', 'Doma', 'Muzan Kibutsuji']),

  makeArc(13, 'Death Note: Kira Investigation', 'Death Note', '📓',
    'A battle of minds hidden behind power. Face the brilliant and the broken who live in Kira\'s shadow.',
    ['Misa Amane', 'Near', 'Ryuk', 'Light Yagami', 'L Lawliet']),

  makeArc(14, "Death Note: Wammy's House", 'Death Note', '🍎',
    'L\'s successors close the net on Kira. A final confrontation between justice and godhood awaits.',
    ['Matsuda', 'Mello', 'Matt', 'Rem', 'Light Yagami (Kira)']),

  makeArc(15, "Fullmetal Alchemist: Brother's Journey", 'Fullmetal Alchemist', '⚗️',
    'Two brothers pay the price of forbidden alchemy. Face the scarred man who hunts State Alchemists.',
    ['Winry Rockbell', 'Alphonse Elric', 'Edward Elric', 'Scar', 'Roy Mustang']),

  makeArc(16, 'Fullmetal Alchemist: Brotherhood', 'Fullmetal Alchemist', '🔱',
    'The truth behind the military runs deep. Confront the Homunculi before facing the god behind the curtain.',
    ['Maes Hughes', 'Greed', 'Olivier Armstrong', 'Pride', 'Father']),

  makeArc(17, 'Hunter x Hunter: Hunter Exam', 'Hunter x Hunter', '🎯',
    'The Hunter Exam separates the determined from the reckless. Outlast the applicants and face the clown who makes it a game.',
    ['Leorio Paradinight', 'Kurapika', 'Gon Freecss', 'Killua Zoldyck', 'Hisoka Morow']),

  makeArc(18, 'Hunter x Hunter: Chimera Ant', 'Hunter x Hunter', '🐜',
    'Evolution takes a dark turn in the NGL. Face mutated warriors before standing before the King of all ants.',
    ['Biscuit Krueger', 'Feitan', 'Neferpitou', 'Illumi Zoldyck', 'Meruem']),

  makeArc(19, 'Sword Art Online: Aincrad', 'Sword Art Online', '⚔️',
    'Trapped in a death game, only the strongest survive. Clear the floors of Aincrad and face the Black Swordsman.',
    ['Klein', 'Sinon', 'Asuna', 'Alice', 'Kirito']),

  makeArc(20, 'Sword Art Online: Alicization', 'Sword Art Online', '🌸',
    'The Underworld\'s greatest warriors await. Fight through the Integrity Knights before the Administrator claims everything.',
    ['Leafa', 'Eugeo', 'Bercouli', 'Cardinal', 'Administrator']),

  makeArc(21, 'Jujutsu Kaisen: Tokyo Jujutsu High', 'Jujutsu Kaisen', '👁️',
    'Tokyo Jujutsu High trains the next generation of curse-fighters. Battle through Yuji\'s classmates before facing the strongest sorcerer alive.',
    ['Nobara Kugisaki', 'Maki Zenin', 'Megumi Fushiguro', 'Yuji Itadori', 'Satoru Gojo']),

  makeArc(22, 'Jujutsu Kaisen: Shibuya Incident', 'Jujutsu Kaisen', '🌃',
    'Shibuya burns under a curtain of curses. Survive the special-grade horrors before confronting the soul-twister himself.',
    ['Inumaki Toge', 'Aoi Todo', 'Kento Nanami', 'Sukuna', 'Mahito']),

  makeArc(23, 'Bleach: Soul Society', 'Bleach', '⚔️',
    'The Soul Society stands divided. Cross blades with the Seireitei\'s Soul Reapers before clashing with the Substitute Shinigami.',
    ['Hanataro Yamada', 'Rukia Kuchiki', 'Renji Abarai', 'Byakuya Kuchiki', 'Ichigo Kurosaki']),

  makeArc(24, 'Bleach: Hueco Mundo', 'Bleach', '🦋',
    'The realm of hollows opens before you. Face the Espada one by one before the architect of betrayal reveals himself.',
    ['Don Kanonji', 'Grimmjow Jaegerjaquez', 'Ulquiorra Cifer', 'Coyote Starrk', 'Sosuke Aizen']),
]

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export function getArc(arcNumber: number): Arc | undefined {
  return CAMPAIGN.find(a => a.arc === arcNumber)
}

export function getStage(arcNumber: number, stageNumber: number): Stage | undefined {
  return getArc(arcNumber)?.stages.find(s => s.stage === stageNumber)
}

export function isArcUnlocked(
  arcNumber: number,
  clearedStages: { arc: number; stage: number }[],
): boolean {
  if (arcNumber === 1) return true
  const prev = arcNumber - 1
  return [1, 2, 3, 4, 5].every(s => clearedStages.some(c => c.arc === prev && c.stage === s))
}

export function isStageUnlocked(
  arcNumber: number,
  stageNumber: number,
  clearedStages: { arc: number; stage: number }[],
): boolean {
  if (!isArcUnlocked(arcNumber, clearedStages)) return false
  if (stageNumber === 1) return true
  return clearedStages.some(c => c.arc === arcNumber && c.stage === stageNumber - 1)
}

export function isStageCleared(
  arcNumber: number,
  stageNumber: number,
  clearedStages: { arc: number; stage: number }[],
): boolean {
  return clearedStages.some(c => c.arc === arcNumber && c.stage === stageNumber)
}

export function isArcComplete(
  arcNumber: number,
  clearedStages: { arc: number; stage: number }[],
): boolean {
  return [1, 2, 3, 4, 5].every(s => clearedStages.some(c => c.arc === arcNumber && c.stage === s))
}
