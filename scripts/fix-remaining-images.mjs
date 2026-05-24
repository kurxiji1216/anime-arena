// Retries the 14 characters AniList couldn't find with corrected search terms.

const REMAINING = [
  // ─── Errored: try alternate names/spellings ───
  { name: 'Obito Uchiha',          anime: 'Naruto',           search: 'Tobi',                  match: ['naruto'] },
  { name: 'Historia Reiss',        anime: 'Attack on Titan',  search: 'Krista Lenz',           match: ['shingeki', 'attack on titan'] },
  { name: 'Levi Ackerman',         anime: 'Attack on Titan',  search: 'Levi',                  match: ['shingeki', 'attack on titan'] },
  { name: 'Zeke Yeager',           anime: 'Attack on Titan',  search: 'Zeke Jaeger',           match: ['shingeki', 'attack on titan'] },
  { name: 'Tanjiro Kamado',        anime: 'Demon Slayer',     search: 'Tanjirou Kamado',       match: ['kimetsu', 'demon slayer'] },
  { name: 'Kyojuro Rengoku',       anime: 'Demon Slayer',     search: 'Kyoujurou Rengoku',     match: ['kimetsu', 'demon slayer'] },
  { name: 'Gyomei Himejima',       anime: 'Demon Slayer',     search: 'Gyoumei Himejima',      match: ['kimetsu', 'demon slayer'] },
  { name: 'Maki Zenin',            anime: 'Jujutsu Kaisen',   search: 'Maki Zenin',            match: ['jujutsu kaisen'] },
  { name: 'Sukuna',                anime: 'Jujutsu Kaisen',   search: 'Sukuna',                match: ['jujutsu kaisen'] },
  { name: 'Don Kanonji',           anime: 'Bleach',           search: 'Kanonji',               match: ['bleach'] },
  { name: 'Grimmjow Jaegerjaquez', anime: 'Bleach',           search: 'Grimmjow',              match: ['bleach'] },
  { name: 'Coyote Starrk',         anime: 'Bleach',           search: 'Starrk',                match: ['bleach'] },

  // ─── Mismatched: corrected search ───
  { name: 'Doma',  anime: 'Demon Slayer',         search: 'Douma',         match: ['kimetsu', 'demon slayer'] },
  { name: 'Pride', anime: 'Fullmetal Alchemist',  search: 'Selim Bradley', match: ['fullmetal', 'hagane'] },
]

const QUERY = `
query ($search: String!) {
  Page(perPage: 8) {
    characters(search: $search, sort: [SEARCH_MATCH, FAVOURITES_DESC]) {
      name { full native }
      image { large }
      media(perPage: 5) { nodes { title { romaji english native } } }
    }
  }
}`

function mediaMatches(media, hints) {
  if (!media) return false
  const titles = media.flatMap(n => [n.title?.romaji, n.title?.english, n.title?.native])
    .filter(Boolean).map(t => t.toLowerCase())
  return hints.some(h => titles.some(t => t.includes(h.toLowerCase())))
}

async function fetchOne(char) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query: QUERY, variables: { search: char.search } }),
    })
    if (res.status === 429) {
      const wait = (attempt + 1) * 30000
      process.stderr.write(`  429 on ${char.name}, waiting ${wait/1000}s...\n`)
      await new Promise(r => setTimeout(r, wait))
      continue
    }
    if (!res.ok) return { name: char.name, anime: char.anime, error: `HTTP ${res.status}` }
    const data = await res.json()
    const candidates = data?.data?.Page?.characters ?? []
    if (candidates.length === 0) return { name: char.name, anime: char.anime, error: 'No results' }
    const picked = candidates.find(c => mediaMatches(c.media?.nodes, char.match)) ?? candidates[0]
    return {
      name:       char.name,
      anime:      char.anime,
      imageUrl:   picked?.image?.large ?? null,
      matched:    mediaMatches(picked?.media?.nodes, char.match),
      pickedName: picked?.name?.full,
    }
  }
  return { name: char.name, anime: char.anime, error: 'rate-limit exhausted' }
}

async function main() {
  const results = []
  for (let i = 0; i < REMAINING.length; i++) {
    results.push(await fetchOne(REMAINING[i]))
    await new Promise(r => setTimeout(r, 1500))
    process.stderr.write(`  ${i + 1}/${REMAINING.length}\n`)
  }
  process.stdout.write(JSON.stringify(results, null, 2))
}

main()
