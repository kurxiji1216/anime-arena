#!/usr/bin/env node
// Fetches verified character images from AniList for every character in our DB.
// Outputs a JSON map of { "Name|Anime" -> imageUrl } so we can issue UPDATE statements.
// Run: node scripts/fix-character-images.mjs > scripts/character-images.json

const CHARACTERS = [
  // ─── Naruto ───
  { name: 'Sakura Haruno',     anime: 'Naruto', match: ['naruto'] },
  { name: 'Naruto Uzumaki',    anime: 'Naruto', match: ['naruto'] },
  { name: 'Sasuke Uchiha',     anime: 'Naruto', match: ['naruto'] },
  { name: 'Kakashi Hatake',    anime: 'Naruto', match: ['naruto'] },
  { name: 'Itachi Uchiha',     anime: 'Naruto', match: ['naruto'] },
  { name: 'Rock Lee',          anime: 'Naruto', match: ['naruto'] },
  { name: 'Gaara',             anime: 'Naruto', match: ['naruto'] },
  { name: 'Tsunade',           anime: 'Naruto', match: ['naruto'] },
  { name: 'Obito Uchiha',      anime: 'Naruto', match: ['naruto'] },
  { name: 'Minato Namikaze',   anime: 'Naruto', match: ['naruto'] },

  // ─── DBZ ───
  { name: 'Piccolo',           anime: 'Dragon Ball Z', match: ['dragon ball'] },
  { name: 'Gohan',             anime: 'Dragon Ball Z', match: ['dragon ball'] },
  { name: 'Frieza',            anime: 'Dragon Ball Z', match: ['dragon ball'] },
  { name: 'Vegeta',            anime: 'Dragon Ball Z', match: ['dragon ball'] },
  { name: 'Goku',              anime: 'Dragon Ball Z', match: ['dragon ball'] },
  { name: 'Yamcha',            anime: 'Dragon Ball Z', match: ['dragon ball'] },
  { name: 'Future Trunks',     anime: 'Dragon Ball Z', match: ['dragon ball'] },
  { name: 'Android 18',        anime: 'Dragon Ball Z', match: ['dragon ball'] },
  { name: 'Cell',              anime: 'Dragon Ball Z', match: ['dragon ball'] },
  { name: 'Majin Buu',         anime: 'Dragon Ball Z', match: ['dragon ball'] },

  // ─── One Piece ───
  { name: 'Nami',              anime: 'One Piece', match: ['one piece'] },
  { name: 'Sanji',             anime: 'One Piece', match: ['one piece'] },
  { name: 'Portgas D. Ace',    anime: 'One Piece', match: ['one piece'] },
  { name: 'Roronoa Zoro',      anime: 'One Piece', match: ['one piece'] },
  { name: 'Monkey D. Luffy',   anime: 'One Piece', match: ['one piece'] },
  { name: 'Usopp',             anime: 'One Piece', match: ['one piece'] },
  { name: 'Nico Robin',        anime: 'One Piece', match: ['one piece'] },
  { name: 'Trafalgar Law',     anime: 'One Piece', match: ['one piece'] },
  { name: 'Boa Hancock',       anime: 'One Piece', match: ['one piece'] },
  { name: 'Kaido',             anime: 'One Piece', match: ['one piece'] },

  // ─── Attack on Titan ───
  { name: 'Armin Arlert',      anime: 'Attack on Titan', match: ['shingeki', 'attack on titan'] },
  { name: 'Historia Reiss',    anime: 'Attack on Titan', match: ['shingeki', 'attack on titan'] },
  { name: 'Eren Yeager',       anime: 'Attack on Titan', match: ['shingeki', 'attack on titan'] },
  { name: 'Mikasa Ackerman',   anime: 'Attack on Titan', match: ['shingeki', 'attack on titan'] },
  { name: 'Levi Ackerman',     anime: 'Attack on Titan', match: ['shingeki', 'attack on titan'] },
  { name: 'Connie Springer',   anime: 'Attack on Titan', match: ['shingeki', 'attack on titan'] },
  { name: 'Sasha Blouse',      anime: 'Attack on Titan', match: ['shingeki', 'attack on titan'] },
  { name: 'Reiner Braun',      anime: 'Attack on Titan', match: ['shingeki', 'attack on titan'] },
  { name: 'Zeke Yeager',       anime: 'Attack on Titan', match: ['shingeki', 'attack on titan'] },
  { name: 'Eren (Founding Titan)', anime: 'Attack on Titan', search: 'Eren Yeager', match: ['shingeki', 'attack on titan'] },

  // ─── MHA ───
  { name: 'Ochaco Uraraka',    anime: 'My Hero Academia', match: ['boku no hero', 'my hero academia'] },
  { name: 'Izuku Midoriya',    anime: 'My Hero Academia', match: ['boku no hero', 'my hero academia'] },
  { name: 'Katsuki Bakugo',    anime: 'My Hero Academia', match: ['boku no hero', 'my hero academia'] },
  { name: 'Shoto Todoroki',    anime: 'My Hero Academia', match: ['boku no hero', 'my hero academia'] },
  { name: 'All Might',         anime: 'My Hero Academia', match: ['boku no hero', 'my hero academia'] },
  { name: 'Minoru Mineta',     anime: 'My Hero Academia', match: ['boku no hero', 'my hero academia'] },
  { name: 'Eijiro Kirishima',  anime: 'My Hero Academia', match: ['boku no hero', 'my hero academia'] },
  { name: 'Momo Yaoyorozu',    anime: 'My Hero Academia', match: ['boku no hero', 'my hero academia'] },
  { name: 'Hawks',             anime: 'My Hero Academia', match: ['boku no hero', 'my hero academia'] },
  { name: 'Tomura Shigaraki',  anime: 'My Hero Academia', match: ['boku no hero', 'my hero academia'] },

  // ─── Demon Slayer ───
  { name: 'Zenitsu Agatsuma',  anime: 'Demon Slayer', match: ['kimetsu', 'demon slayer'] },
  { name: 'Inosuke Hashibira', anime: 'Demon Slayer', match: ['kimetsu', 'demon slayer'] },
  { name: 'Nezuko Kamado',     anime: 'Demon Slayer', match: ['kimetsu', 'demon slayer'] },
  { name: 'Tanjiro Kamado',    anime: 'Demon Slayer', match: ['kimetsu', 'demon slayer'] },
  { name: 'Kyojuro Rengoku',   anime: 'Demon Slayer', match: ['kimetsu', 'demon slayer'] },
  { name: 'Genya Shinazugawa', anime: 'Demon Slayer', match: ['kimetsu', 'demon slayer'] },
  { name: 'Mitsuri Kanroji',   anime: 'Demon Slayer', match: ['kimetsu', 'demon slayer'] },
  { name: 'Gyomei Himejima',   anime: 'Demon Slayer', match: ['kimetsu', 'demon slayer'] },
  { name: 'Doma',              anime: 'Demon Slayer', match: ['kimetsu', 'demon slayer'] },
  { name: 'Muzan Kibutsuji',   anime: 'Demon Slayer', match: ['kimetsu', 'demon slayer'] },

  // ─── Death Note ───
  { name: 'Misa Amane',        anime: 'Death Note', match: ['death note'] },
  { name: 'Near',              anime: 'Death Note', match: ['death note'] },
  { name: 'Ryuk',              anime: 'Death Note', match: ['death note'] },
  { name: 'Light Yagami',      anime: 'Death Note', match: ['death note'] },
  { name: 'L Lawliet',         anime: 'Death Note', match: ['death note'] },
  { name: 'Matsuda',           anime: 'Death Note', search: 'Touta Matsuda', match: ['death note'] },
  { name: 'Mello',             anime: 'Death Note', match: ['death note'] },
  { name: 'Matt',              anime: 'Death Note', search: 'Mail Jeevas', match: ['death note'] },
  { name: 'Rem',               anime: 'Death Note', match: ['death note'] },
  { name: 'Light Yagami (Kira)', anime: 'Death Note', search: 'Light Yagami', match: ['death note'] },

  // ─── FMA ───
  { name: 'Winry Rockbell',    anime: 'Fullmetal Alchemist', match: ['fullmetal', 'hagane no renkinjutsushi'] },
  { name: 'Alphonse Elric',    anime: 'Fullmetal Alchemist', match: ['fullmetal', 'hagane no renkinjutsushi'] },
  { name: 'Edward Elric',      anime: 'Fullmetal Alchemist', match: ['fullmetal', 'hagane no renkinjutsushi'] },
  { name: 'Scar',              anime: 'Fullmetal Alchemist', match: ['fullmetal', 'hagane no renkinjutsushi'] },
  { name: 'Roy Mustang',       anime: 'Fullmetal Alchemist', match: ['fullmetal', 'hagane no renkinjutsushi'] },
  { name: 'Maes Hughes',       anime: 'Fullmetal Alchemist', match: ['fullmetal', 'hagane no renkinjutsushi'] },
  { name: 'Greed',             anime: 'Fullmetal Alchemist', match: ['fullmetal', 'hagane no renkinjutsushi'] },
  { name: 'Olivier Armstrong', anime: 'Fullmetal Alchemist', match: ['fullmetal', 'hagane no renkinjutsushi'] },
  { name: 'Pride',             anime: 'Fullmetal Alchemist', match: ['fullmetal', 'hagane no renkinjutsushi'] },
  { name: 'Father',            anime: 'Fullmetal Alchemist', match: ['fullmetal', 'hagane no renkinjutsushi'] },

  // ─── HxH ───
  { name: 'Leorio Paradinight', anime: 'Hunter x Hunter', search: 'Leorio Paladiknight', match: ['hunter x hunter'] },
  { name: 'Kurapika',          anime: 'Hunter x Hunter', match: ['hunter x hunter'] },
  { name: 'Gon Freecss',       anime: 'Hunter x Hunter', match: ['hunter x hunter'] },
  { name: 'Killua Zoldyck',    anime: 'Hunter x Hunter', match: ['hunter x hunter'] },
  { name: 'Hisoka Morow',      anime: 'Hunter x Hunter', match: ['hunter x hunter'] },
  { name: 'Biscuit Krueger',   anime: 'Hunter x Hunter', match: ['hunter x hunter'] },
  { name: 'Feitan',            anime: 'Hunter x Hunter', search: 'Feitan Portor', match: ['hunter x hunter'] },
  { name: 'Neferpitou',        anime: 'Hunter x Hunter', match: ['hunter x hunter'] },
  { name: 'Illumi Zoldyck',    anime: 'Hunter x Hunter', match: ['hunter x hunter'] },
  { name: 'Meruem',            anime: 'Hunter x Hunter', match: ['hunter x hunter'] },

  // ─── SAO ───
  { name: 'Klein',             anime: 'Sword Art Online', match: ['sword art online'] },
  { name: 'Sinon',             anime: 'Sword Art Online', match: ['sword art online'] },
  { name: 'Asuna',             anime: 'Sword Art Online', search: 'Asuna Yuuki', match: ['sword art online'] },
  { name: 'Alice',             anime: 'Sword Art Online', search: 'Alice Zuberg', match: ['sword art online'] },
  { name: 'Kirito',            anime: 'Sword Art Online', match: ['sword art online'] },
  { name: 'Leafa',             anime: 'Sword Art Online', match: ['sword art online'] },
  { name: 'Eugeo',             anime: 'Sword Art Online', match: ['sword art online'] },
  { name: 'Bercouli',          anime: 'Sword Art Online', search: 'Bercouli Synthesis One', match: ['sword art online'] },
  { name: 'Cardinal',          anime: 'Sword Art Online', match: ['sword art online'] },
  { name: 'Administrator',     anime: 'Sword Art Online', search: 'Quinella', match: ['sword art online'] },

  // ─── JJK ───
  { name: 'Nobara Kugisaki',   anime: 'Jujutsu Kaisen', match: ['jujutsu kaisen'] },
  { name: 'Maki Zenin',        anime: 'Jujutsu Kaisen', search: 'Maki Zen\'in', match: ['jujutsu kaisen'] },
  { name: 'Megumi Fushiguro',  anime: 'Jujutsu Kaisen', match: ['jujutsu kaisen'] },
  { name: 'Yuji Itadori',      anime: 'Jujutsu Kaisen', search: 'Yuuji Itadori', match: ['jujutsu kaisen'] },
  { name: 'Satoru Gojo',       anime: 'Jujutsu Kaisen', search: 'Satoru Gojou', match: ['jujutsu kaisen'] },
  { name: 'Inumaki Toge',      anime: 'Jujutsu Kaisen', search: 'Toge Inumaki', match: ['jujutsu kaisen'] },
  { name: 'Aoi Todo',          anime: 'Jujutsu Kaisen', search: 'Aoi Toudou', match: ['jujutsu kaisen'] },
  { name: 'Kento Nanami',      anime: 'Jujutsu Kaisen', match: ['jujutsu kaisen'] },
  { name: 'Sukuna',            anime: 'Jujutsu Kaisen', search: 'Ryomen Sukuna', match: ['jujutsu kaisen'] },
  { name: 'Mahito',            anime: 'Jujutsu Kaisen', match: ['jujutsu kaisen'] },

  // ─── Bleach ───
  { name: 'Hanataro Yamada',   anime: 'Bleach', search: 'Hanatarou Yamada', match: ['bleach'] },
  { name: 'Rukia Kuchiki',     anime: 'Bleach', match: ['bleach'] },
  { name: 'Renji Abarai',      anime: 'Bleach', match: ['bleach'] },
  { name: 'Byakuya Kuchiki',   anime: 'Bleach', match: ['bleach'] },
  { name: 'Ichigo Kurosaki',   anime: 'Bleach', match: ['bleach'] },
  { name: 'Don Kanonji',       anime: 'Bleach', search: 'Donkanonji', match: ['bleach'] },
  { name: 'Grimmjow Jaegerjaquez', anime: 'Bleach', search: 'Grimmjow Jaegerjaques', match: ['bleach'] },
  { name: 'Ulquiorra Cifer',   anime: 'Bleach', match: ['bleach'] },
  { name: 'Coyote Starrk',     anime: 'Bleach', search: 'Coyote Stark', match: ['bleach'] },
  { name: 'Sosuke Aizen',      anime: 'Bleach', search: 'Sousuke Aizen', match: ['bleach'] },
]

const QUERY = `
query ($search: String!) {
  Page(perPage: 8) {
    characters(search: $search, sort: [SEARCH_MATCH, FAVOURITES_DESC]) {
      name { full native alternative }
      image { large }
      media(perPage: 5) {
        nodes { title { romaji english native } }
      }
    }
  }
}`

function mediaMatches(media, hints) {
  if (!media) return false
  const titles = media.flatMap(n => [
    n.title?.romaji,
    n.title?.english,
    n.title?.native,
  ]).filter(Boolean).map(t => t.toLowerCase())
  return hints.some(h => titles.some(t => t.includes(h.toLowerCase())))
}

async function fetchOne(char) {
  const search = char.search ?? char.name
  const res = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ query: QUERY, variables: { search } }),
  })
  if (!res.ok) {
    return { name: char.name, anime: char.anime, error: `HTTP ${res.status}` }
  }
  const data = await res.json()
  const candidates = data?.data?.Page?.characters ?? []
  if (candidates.length === 0) return { name: char.name, anime: char.anime, error: 'No results' }
  // Pick the first result whose media matches the requested anime
  const picked = candidates.find(c => mediaMatches(c.media?.nodes, char.match)) ?? candidates[0]
  return {
    name:     char.name,
    anime:    char.anime,
    imageUrl: picked?.image?.large ?? null,
    matched:  mediaMatches(picked?.media?.nodes, char.match),
    pickedName: picked?.name?.full,
  }
}

async function main() {
  // If a "good" file exists, skip characters that already have valid results
  const fs = await import('node:fs')
  let existing = []
  try {
    existing = JSON.parse(fs.readFileSync('scripts/character-images-good.json', 'utf8'))
  } catch { /* no existing file, start fresh */ }
  const have = new Set(existing.map(r => r.name + '|' + r.anime))

  const results = [...existing]
  const todo    = CHARACTERS.filter(c => !have.has(c.name + '|' + c.anime))
  process.stderr.write(`Skipping ${have.size}, fetching ${todo.length}\n`)

  for (let i = 0; i < todo.length; i++) {
    const char = todo[i]
    let attempt = 0
    let r = null
    while (attempt < 4) {
      try {
        r = await fetchOne(char)
        if (r.error?.startsWith('HTTP 429')) {
          attempt++
          process.stderr.write(`  429 on ${char.name}, waiting ${attempt * 30}s...\n`)
          await new Promise(res => setTimeout(res, attempt * 30000))
          continue
        }
        break
      } catch (err) {
        r = { name: char.name, anime: char.anime, error: err.message }
        break
      }
    }
    results.push(r)
    // Throttle: AniList limit is 90/min = 1500ms minimum, give buffer
    await new Promise(res => setTimeout(res, 1500))
    if ((i + 1) % 5 === 0) process.stderr.write(`  Processed ${i + 1}/${todo.length}\n`)
  }
  process.stdout.write(JSON.stringify(results, null, 2))
}

main()
