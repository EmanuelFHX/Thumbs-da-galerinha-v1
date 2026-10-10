export const ROOM_MODES = [
  { value: 'classic', label: 'Clássico', icon: 'bi-stars', description: 'A melhor edição vence.' },
  { value: 'comedy', label: 'Comédia', icon: 'bi-emoji-laughing', description: 'Vale fazer a galera rir.' },
  { value: 'theme', label: 'Tema', icon: 'bi-palette-fill', description: 'Todo mundo segue uma proposta.' },
  { value: 'chaos', label: 'Caos', icon: 'bi-lightning-charge-fill', description: 'Desafios mais imprevisíveis.' },
]

export const ROUND_OPTIONS = [1, 3, 5]
export const EDIT_DURATION_OPTIONS = [120, 240, 360, 600, 900, 1200]
export const VOTE_OPTIONS = [1, 2, 3]

export const DEFAULT_ROOM_SETTINGS = Object.freeze({
  editDurationSeconds: 240,
  mode: 'classic',
  rounds: 3,
  votesPerPlayer: 1,
})

function includesOption(options, value) {
  return options.includes(value)
}

export function normalizeRoomSettings(settings = {}) {
  return {
    editDurationSeconds: includesOption(EDIT_DURATION_OPTIONS, settings.editDurationSeconds)
      ? settings.editDurationSeconds
      : DEFAULT_ROOM_SETTINGS.editDurationSeconds,
    mode: ROOM_MODES.some((mode) => mode.value === settings.mode)
      ? settings.mode
      : DEFAULT_ROOM_SETTINGS.mode,
    rounds: includesOption(ROUND_OPTIONS, settings.rounds)
      ? settings.rounds
      : DEFAULT_ROOM_SETTINGS.rounds,
    votesPerPlayer: includesOption(VOTE_OPTIONS, settings.votesPerPlayer)
      ? settings.votesPerPlayer
      : DEFAULT_ROOM_SETTINGS.votesPerPlayer,
  }
}

export function getMode(modeValue) {
  return ROOM_MODES.find((mode) => mode.value === modeValue) ?? ROOM_MODES[0]
}

export function formatEditDuration(seconds) {
  return `${seconds / 60} min`
}
