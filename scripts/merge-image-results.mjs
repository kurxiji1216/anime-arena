// Merge the two image-fetch passes into one final list, add manual entries
// for the last stragglers, and emit SQL UPDATE statements for the DB.

import fs from 'node:fs'

const primary = JSON.parse(fs.readFileSync('scripts/character-images.json', 'utf8'))
const retry   = JSON.parse(fs.readFileSync('scripts/character-images-retry.json', 'utf8'))

// Manual entries for characters AniList still couldn't resolve
const manual = [
  {
    name:     'Zeke Yeager',
    anime:    'Attack on Titan',
    imageUrl: 'https://s4.anilist.co/file/anilistcdn/character/large/b125661-FiqFvAtNlL0v.png',
    matched:  true,
  },
]

// Build a map keyed by name (newer entries override older)
const map = new Map()
for (const r of primary) map.set(r.name, r)
for (const r of retry)   if (r.imageUrl) map.set(r.name, r)
for (const r of manual)  map.set(r.name, r)

const all = Array.from(map.values())
const ok        = all.filter(r => r.imageUrl)
const stillNone = all.filter(r => !r.imageUrl)

console.error(`Final: ${ok.length} with image / ${stillNone.length} still without`)
if (stillNone.length) {
  console.error('STILL MISSING:')
  for (const s of stillNone) console.error('  ' + s.name + ' (' + s.anime + ')')
}

// Emit SQL — escape single quotes by doubling them
function esc(s) { return s.replace(/'/g, "''") }

const updates = ok.map(r =>
  `update public.characters set image_url = '${esc(r.imageUrl)}' where name = '${esc(r.name)}';`
).join('\n')

process.stdout.write(updates + '\n')
