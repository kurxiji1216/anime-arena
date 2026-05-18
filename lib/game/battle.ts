export type BattleFighter = {
  name: string
  base_hp: number
  base_atk: number
  base_def: number
  base_speed: number
}

export type BattleLogEntry = {
  message: string
  playerHp: number
  enemyHp: number
}

export type BattleResult = {
  winner: 'player' | 'enemy'
  log: BattleLogEntry[]
  playerMaxHp: number
  enemyMaxHp: number
  playerName: string
  enemyName: string
}

function calcDamage(atk: number, def: number): number {
  return Math.max(1, atk - Math.floor(def / 2))
}

export function runBattle(player: BattleFighter, enemy: BattleFighter): BattleResult {
  let playerHp = player.base_hp
  let enemyHp = enemy.base_hp
  const log: BattleLogEntry[] = []

  // Faster fighter goes first. Ties go to player.
  const playerFirst = player.base_speed >= enemy.base_speed

  log.push({
    message: `⚔️ ${player.name} vs ${enemy.name}! ${playerFirst ? player.name : enemy.name} moves first!`,
    playerHp,
    enemyHp,
  })

  const MAX_TURNS = 100
  let turn = 0

  while (playerHp > 0 && enemyHp > 0 && turn < MAX_TURNS) {
    const playerTurn = playerFirst ? turn % 2 === 0 : turn % 2 === 1

    if (playerTurn) {
      const dmg = calcDamage(player.base_atk, enemy.base_def)
      enemyHp = Math.max(0, enemyHp - dmg)
      log.push({
        message: enemyHp === 0
          ? `💥 ${player.name} hits ${enemy.name} for ${dmg} — ${enemy.name} is defeated!`
          : `⚡ ${player.name} hits ${enemy.name} for ${dmg} dmg. (${enemy.name}: ${enemyHp} HP)`,
        playerHp,
        enemyHp,
      })
    } else {
      const dmg = calcDamage(enemy.base_atk, player.base_def)
      playerHp = Math.max(0, playerHp - dmg)
      log.push({
        message: playerHp === 0
          ? `💥 ${enemy.name} hits ${player.name} for ${dmg} — ${player.name} is defeated!`
          : `🔥 ${enemy.name} hits ${player.name} for ${dmg} dmg. (${player.name}: ${playerHp} HP)`,
        playerHp,
        enemyHp,
      })
    }

    turn++
  }

  const winner = playerHp > 0 ? 'player' : 'enemy'

  log.push({
    message: winner === 'player'
      ? `🏆 ${player.name} wins!`
      : `💀 ${enemy.name} wins!`,
    playerHp,
    enemyHp,
  })

  return {
    winner,
    log,
    playerMaxHp: player.base_hp,
    enemyMaxHp: enemy.base_hp,
    playerName: player.name,
    enemyName: enemy.name,
  }
}
