import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runBattle } from '@/lib/game/battle'
import { calcEffectiveStats } from '@/lib/game/stats'

const RARITY_ORDER: Record<string, number> = { legendary: 4, epic: 3, rare: 2, common: 1 }
const WIN_REWARD = 15

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  const { characterId } = await request.json()

  // Verify the player owns this character and get their upgrade info
  const { data: userChar } = await supabase
    .from('user_characters')
    .select('level, stars')
    .eq('user_id', user.id)
    .eq('character_id', characterId)
    .single()

  if (!userChar) return NextResponse.json({ error: "You don't own that character" }, { status: 403 })

  // Fetch player character base stats
  const { data: playerBase } = await supabase
    .from('characters')
    .select('*')
    .eq('id', characterId)
    .single()

  if (!playerBase) return NextResponse.json({ error: 'Character not found' }, { status: 404 })

  // Apply level + star upgrades
  const eff = calcEffectiveStats(playerBase, userChar.level ?? 1, userChar.stars ?? 1)
  const playerChar = { ...playerBase, base_hp: eff.hp, base_atk: eff.atk, base_def: eff.def, base_speed: eff.speed }

  // Find a random opponent — any other user who owns at least one character
  const { data: opponentRows } = await supabase
    .from('user_characters')
    .select('user_id, character_id, level, stars, character:characters(id, name, rarity, base_hp, base_atk, base_def, base_speed)')
    .neq('user_id', user.id)

  if (!opponentRows || opponentRows.length === 0) {
    return NextResponse.json({ error: 'No opponents found yet — check back once more players have joined!' }, { status: 404 })
  }

  // Pick the strongest character (highest rarity, then highest level) from a random opponent
  const shuffled = [...opponentRows].sort(() => Math.random() - 0.5)
  const best = shuffled.reduce((a, b) => {
    const aRarity = RARITY_ORDER[(a.character as any).rarity] ?? 0
    const bRarity = RARITY_ORDER[(b.character as any).rarity] ?? 0
    if (bRarity !== aRarity) return bRarity > aRarity ? b : a
    return (b.level ?? 1) > (a.level ?? 1) ? b : a
  })

  const oppBase = best.character as any
  const oppEff = calcEffectiveStats(oppBase, best.level ?? 1, best.stars ?? 1)
  const enemyChar = { ...oppBase, base_hp: oppEff.hp, base_atk: oppEff.atk, base_def: oppEff.def, base_speed: oppEff.speed }

  // Get the opponent's username for display
  const { data: oppProfile } = await supabase
    .from('profiles')
    .select('username')
    .eq('user_id', best.user_id)
    .single()

  const opponentName = oppProfile?.username ?? 'Unknown Player'

  // Run the battle
  const result = runBattle(playerChar, enemyChar)

  // Update player's PvP record
  const { data: profile } = await supabase
    .from('profiles')
    .select('gems, pvp_wins, pvp_battles')
    .eq('user_id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 500 })

  const gemsAwarded = result.winner === 'player' ? WIN_REWARD : 0
  await supabase
    .from('profiles')
    .update({
      pvp_wins:    profile.pvp_wins    + (result.winner === 'player' ? 1 : 0),
      pvp_battles: profile.pvp_battles + 1,
      gems:        profile.gems + gemsAwarded,
    })
    .eq('user_id', user.id)

  return NextResponse.json({
    ...result,
    gemsAwarded,
    opponentName,
    opponentCharacter: oppBase.name,
  })
}
