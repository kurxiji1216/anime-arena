import { getAbility } from '@/lib/game/abilities'

type Props = {
  characterName: string
  variant?:      'compact' | 'full' | 'icon'
}

// AbilityBadge — surfaces a character's signature passive in the UI.
//   'icon'    → tiny rounded square showing only the emoji icon (used in card grids)
//   'compact' → small chip with icon + ability name (used inline)
//   'full'    → boxed panel with icon, name, and description (used in detail views)
//
// Renders nothing if the character has no ability mapped.
export function AbilityBadge({ characterName, variant = 'compact' }: Props) {
  const ability = getAbility(characterName)
  if (!ability) return null

  if (variant === 'icon') {
    return (
      <div
        title={`${ability.name}: ${ability.description}`}
        className="w-6 h-6 rounded-md flex items-center justify-center text-xs"
        style={{
          background: 'rgba(168,85,247,0.18)',
          border:     '1px solid rgba(168,85,247,0.5)',
        }}
      >
        <span>{ability.icon}</span>
      </div>
    )
  }

  if (variant === 'compact') {
    return (
      <div
        title={ability.description}
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-game text-[10px]"
        style={{
          background: 'rgba(168,85,247,0.15)',
          border:     '1px solid rgba(168,85,247,0.45)',
          color:      '#e9d5ff',
        }}
      >
        <span>{ability.icon}</span>
        <span className="truncate max-w-[110px]">{ability.name}</span>
      </div>
    )
  }

  // 'full'
  return (
    <div
      className="rounded-xl p-3 font-game"
      style={{
        background: 'linear-gradient(135deg, rgba(168,85,247,0.10) 0%, rgba(168,85,247,0.04) 100%)',
        border:     '1px solid rgba(168,85,247,0.35)',
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg leading-none">{ability.icon}</span>
        <span className="font-bold text-sm" style={{ color: '#e9d5ff' }}>{ability.name}</span>
        <span className="ml-auto text-[9px] tracking-widest text-gray-600">SIGNATURE</span>
      </div>
      <p className="text-xs text-gray-400 leading-relaxed">{ability.description}</p>
    </div>
  )
}
