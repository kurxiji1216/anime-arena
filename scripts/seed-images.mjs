// scripts/seed-images.mjs
// One-time script: fetches a portrait for every character in your Supabase
// database from the free Jikan API (MyAnimeList data), then saves each URL.
//
// Run with:
//   node --env-file=.env.local scripts/seed-images.mjs

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// Build a list of search attempts for a given character name, from most
// specific to least — Jikan is tried in order until one returns a result.
function searchCandidates(name) {
  const candidates = []

  // 1. Strip parentheticals: "Eren (Founding Titan)" → "Eren"
  const noParens = name.replace(/\s*\(.*?\)\s*/g, '').trim()
  candidates.push(noParens)

  // 2. Strip "Future " prefix: "Future Trunks" → "Trunks"
  if (noParens.startsWith('Future ')) {
    candidates.push(noParens.replace('Future ', ''))
  }

  // 3. Strip middle initials like "D.": "Portgas D. Ace" → "Portgas Ace"
  if (/\b[A-Z]\.\s/.test(noParens)) {
    candidates.push(noParens.replace(/\b[A-Z]\.\s/g, ''))
  }

  // 4. First name only (helps with "Katsuki Bakugo" → "Bakugo" by trying last word)
  const words = noParens.split(' ')
  if (words.length > 1) {
    candidates.push(words[words.length - 1]) // last word (family name or nickname)
    candidates.push(words[0])                // first word
  }

  // Deduplicate while preserving order
  return [...new Set(candidates)]
}

async function fetchJikanImage(characterName) {
  for (const candidate of searchCandidates(characterName)) {
    try {
      const query = encodeURIComponent(candidate)
      const res = await fetch(`https://api.jikan.moe/v4/characters?q=${query}&limit=1`)
      if (!res.ok) continue
      const json = await res.json()
      const url = json.data?.[0]?.images?.jpg?.image_url ?? null
      if (url) return url
    } catch {
      continue
    }
    await sleep(400) // rate limit between fallback attempts
  }
  return null
}

async function main() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('\n❌  Missing env vars.')
    console.error('    Make sure .env.local contains both:')
    console.error('      NEXT_PUBLIC_SUPABASE_URL=...')
    console.error('      SUPABASE_SERVICE_ROLE_KEY=...\n')
    process.exit(1)
  }

  // Only fetch characters that still have null image_url (safe to re-run)
  const { data: characters, error } = await supabase
    .from('characters')
    .select('id, name')
    .is('image_url', null)

  if (error) {
    console.error('❌  Could not read characters table:', error.message)
    process.exit(1)
  }

  if (characters.length === 0) {
    console.log('✅  All characters already have images — nothing to do!')
    process.exit(0)
  }

  console.log(`\n🎴  Fetching portraits for ${characters.length} characters...\n`)

  let success = 0
  let failed = 0

  for (const char of characters) {
    const imageUrl = await fetchJikanImage(char.name)

    if (imageUrl) {
      const { error: writeError } = await supabase
        .from('characters')
        .update({ image_url: imageUrl })
        .eq('id', char.id)

      if (writeError) {
        console.log(`❌  ${char.name} — DB write failed: ${writeError.message}`)
        failed++
      } else {
        console.log(`✅  ${char.name}`)
        success++
      }
    } else {
      console.log(`⚠️   ${char.name} — not found on Jikan (will use placeholder)`)
      failed++
    }

    // Jikan rate limit: ~3 req/sec — wait 400ms between requests
    await sleep(400)
  }

  console.log(`\n✨  Done! ${success} portraits saved, ${failed} skipped.\n`)
}

main()
