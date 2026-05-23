-- ─── Arc 21–24 character additions ───────────────────────────────────────────
-- 20 new characters across 2 anime: Jujutsu Kaisen + Bleach
-- Run on dev DB first, then prod. Idempotent via on conflict do nothing.

insert into public.characters (name, source_anime, rarity, image_url, base_hp, base_atk, base_def, base_speed) values

-- ════════ Arc 21 — Jujutsu Kaisen: Tokyo Jujutsu High ═══════════════════════
('Nobara Kugisaki',   'Jujutsu Kaisen', 'common',    null,  92,  38,  38,  58),
('Maki Zenin',        'Jujutsu Kaisen', 'rare',      null, 152,  72,  60,  82),
('Megumi Fushiguro',  'Jujutsu Kaisen', 'rare',      null, 145,  65,  72,  68),
('Yuji Itadori',      'Jujutsu Kaisen', 'epic',      null, 195,  92,  80,  90),
('Satoru Gojo',       'Jujutsu Kaisen', 'legendary', null, 250, 130, 105, 125),

-- ════════ Arc 22 — Jujutsu Kaisen: Shibuya Incident ════════════════════════
('Inumaki Toge',      'Jujutsu Kaisen', 'common',    null,  88,  36,  42,  52),
('Aoi Todo',          'Jujutsu Kaisen', 'rare',      null, 160,  78,  68,  70),
('Kento Nanami',      'Jujutsu Kaisen', 'rare',      null, 172,  85,  78,  75),
('Sukuna',            'Jujutsu Kaisen', 'epic',      null, 220, 105,  92,  88),
('Mahito',            'Jujutsu Kaisen', 'legendary', null, 245, 118,  95,  95),

-- ════════ Arc 23 — Bleach: Soul Society ════════════════════════════════════
('Hanataro Yamada',   'Bleach',         'common',    null,  88,  34,  40,  55),
('Rukia Kuchiki',     'Bleach',         'rare',      null, 145,  65,  65,  75),
('Renji Abarai',      'Bleach',         'rare',      null, 175,  82,  70,  78),
('Byakuya Kuchiki',   'Bleach',         'epic',      null, 188,  95,  85,  95),
('Ichigo Kurosaki',   'Bleach',         'legendary', null, 245, 125, 100, 110),

-- ════════ Arc 24 — Bleach: Hueco Mundo ═════════════════════════════════════
('Don Kanonji',          'Bleach', 'common',    null,  85,  36,  38,  50),
('Grimmjow Jaegerjaquez','Bleach', 'rare',      null, 165,  80,  65,  90),
('Ulquiorra Cifer',      'Bleach', 'epic',      null, 195,  92,  95,  88),
('Coyote Starrk',        'Bleach', 'epic',      null, 215, 100,  90, 102),
('Sosuke Aizen',         'Bleach', 'legendary', null, 248, 128, 105, 105);
