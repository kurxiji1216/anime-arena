---
name: new-card
description: Use when asked to add a new character card to Anime Arena
---
When adding a new card to Anime Arena:
1. Insert a row into the `characters` table with fields: name, source_anime, rarity (Common/Rare/Epic/Legendary), image_url, hp, atk, def, speed
2. Upload card art to Supabase Storage under the `cards/` bucket if an image is provided
3. Run: supabase gen types typescript --linked > lib/supabase/types.ts
4. Confirm the insert worked by querying the characters table

SQL template:
INSERT INTO characters (name, source_anime, rarity, image_url, hp, atk, def, speed)
VALUES ('NAME', 'ANIME', 'Common', 'URL', 100, 50, 40, 60);
