export type Stage = {
  stage: number      // 1–5
  enemyName: string  // must match exactly the name in the characters table
  reward: number     // gems awarded on first clear
}

export type Arc = {
  arc: number        // 1–20
  name: string       // display name
  anime: string      // source anime
  emoji: string      // icon shown in UI
  stages: Stage[]
}

// Gem rewards per stage position (same for every arc)
const STAGE_REWARDS = [5, 5, 10, 10, 25]

function makeArc(arc: number, name: string, anime: string, emoji: string, enemies: string[]): Arc {
  return {
    arc,
    name,
    anime,
    emoji,
    stages: enemies.map((enemyName, i) => ({
      stage: i + 1,
      enemyName,
      reward: STAGE_REWARDS[i],
    })),
  }
}

export const CAMPAIGN: Arc[] = [
  makeArc(1,  'Naruto: Part 1',          'Naruto',               '🍃', ['Sakura Haruno', 'Naruto Uzumaki', 'Sasuke Uchiha', 'Kakashi Hatake', 'Itachi Uchiha']),
  makeArc(2,  'Naruto: Shippuden',       'Naruto',               '🌀', ['Rock Lee', 'Gaara', 'Tsunade', 'Obito Uchiha', 'Minato Namikaze']),
  makeArc(3,  'Dragon Ball Z: Saiyan Saga', 'Dragon Ball Z',     '🐉', ['Piccolo', 'Gohan', 'Frieza', 'Vegeta', 'Goku']),
  makeArc(4,  'Dragon Ball Z: Super',    'Dragon Ball Z',        '⚡', ['Yamcha', 'Future Trunks', 'Android 18', 'Cell', 'Majin Buu']),
  makeArc(5,  'One Piece: East Blue',    'One Piece',            '🏴‍☠️', ['Nami', 'Sanji', 'Portgas D. Ace', 'Roronoa Zoro', 'Monkey D. Luffy']),
  makeArc(6,  'One Piece: New World',    'One Piece',            '🌊', ['Usopp', 'Nico Robin', 'Trafalgar Law', 'Boa Hancock', 'Kaido']),
  makeArc(7,  'Attack on Titan: Survey Corps', 'Attack on Titan','⚙️', ['Armin Arlert', 'Historia Reiss', 'Eren Yeager', 'Mikasa Ackerman', 'Levi Ackerman']),
  makeArc(8,  'Attack on Titan: Final Season', 'Attack on Titan','💀', ['Connie Springer', 'Sasha Blouse', 'Reiner Braun', 'Zeke Yeager', 'Eren (Founding Titan)']),
  makeArc(9,  'My Hero Academia: UA High', 'My Hero Academia',   '💪', ['Ochaco Uraraka', 'Izuku Midoriya', 'Katsuki Bakugo', 'Shoto Todoroki', 'All Might']),
  makeArc(10, 'My Hero Academia: Sports Festival', 'My Hero Academia', '🔥', ['Minoru Mineta', 'Eijiro Kirishima', 'Momo Yaoyorozu', 'Hawks', 'Tomura Shigaraki']),
  makeArc(11, "Demon Slayer: Tanjiro's Journey", 'Demon Slayer', '🗡️', ['Zenitsu Agatsuma', 'Inosuke Hashibira', 'Nezuko Kamado', 'Tanjiro Kamado', 'Kyojuro Rengoku']),
  makeArc(12, 'Demon Slayer: Upper Moon', 'Demon Slayer',        '🌙', ['Genya Shinazugawa', 'Mitsuri Kanroji', 'Gyomei Himejima', 'Doma', 'Muzan Kibutsuji']),
  makeArc(13, 'Death Note: Kira Investigation', 'Death Note',    '📓', ['Misa Amane', 'Near', 'Ryuk', 'Light Yagami', 'L Lawliet']),
  makeArc(14, "Death Note: Wammy's House", 'Death Note',         '🍎', ['Matsuda', 'Mello', 'Matt', 'Rem', 'Light Yagami (Kira)']),
  makeArc(15, "Fullmetal Alchemist: Brother's Journey", 'Fullmetal Alchemist', '⚗️', ['Winry Rockbell', 'Alphonse Elric', 'Edward Elric', 'Scar', 'Roy Mustang']),
  makeArc(16, 'Fullmetal Alchemist: Brotherhood', 'Fullmetal Alchemist', '🔱', ['Maes Hughes', 'Greed', 'Olivier Armstrong', 'Pride', 'Father']),
  makeArc(17, 'Hunter x Hunter: Hunter Exam', 'Hunter x Hunter', '🎯', ['Leorio Paradinight', 'Kurapika', 'Gon Freecss', 'Killua Zoldyck', 'Hisoka Morow']),
  makeArc(18, 'Hunter x Hunter: Chimera Ant', 'Hunter x Hunter', '🐜', ['Biscuit Krueger', 'Feitan', 'Neferpitou', 'Illumi Zoldyck', 'Meruem']),
  makeArc(19, 'Sword Art Online: Aincrad',    'Sword Art Online', '⚔️', ['Klein', 'Sinon', 'Asuna', 'Alice', 'Kirito']),
  makeArc(20, 'Sword Art Online: Alicization', 'Sword Art Online','🌸', ['Leafa', 'Eugeo', 'Bercouli', 'Cardinal', 'Administrator']),
]

export function getArc(arcNumber: number): Arc | undefined {
  return CAMPAIGN.find(a => a.arc === arcNumber)
}

export function getStage(arcNumber: number, stageNumber: number): Stage | undefined {
  return getArc(arcNumber)?.stages.find(s => s.stage === stageNumber)
}

// An arc is unlocked if the player has cleared all 5 stages of the previous arc
// Arc 1 is always unlocked
export function isArcUnlocked(arcNumber: number, clearedStages: { arc: number; stage: number }[]): boolean {
  if (arcNumber === 1) return true
  const prevArc = arcNumber - 1
  return [1, 2, 3, 4, 5].every(s => clearedStages.some(c => c.arc === prevArc && c.stage === s))
}

export function isStageUnlocked(arcNumber: number, stageNumber: number, clearedStages: { arc: number; stage: number }[]): boolean {
  if (!isArcUnlocked(arcNumber, clearedStages)) return false
  if (stageNumber === 1) return true
  return clearedStages.some(c => c.arc === arcNumber && c.stage === stageNumber - 1)
}

export function isStageCleared(arcNumber: number, stageNumber: number, clearedStages: { arc: number; stage: number }[]): boolean {
  return clearedStages.some(c => c.arc === arcNumber && c.stage === stageNumber)
}
