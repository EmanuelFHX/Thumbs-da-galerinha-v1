import { AVATARS } from './avatarOptions.js'

export function PlayerAvatar({ avatarId, className = '' }) {
  const avatar = AVATARS.find((item) => item.id === avatarId) ?? AVATARS[0]

  return (
    <span
      className={`player-avatar ${className}`.trim()}
      style={{ '--avatar-color': avatar.color }}
      role="img"
      aria-label={`Avatar ${avatar.label}`}
    >
      {avatar.emoji}
    </span>
  )
}
