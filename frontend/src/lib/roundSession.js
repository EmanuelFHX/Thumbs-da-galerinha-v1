import { DEFAULT_ROOM_SETTINGS, normalizeRoomSettings } from './roomSettings.js'

export const TOTAL_ROUNDS = DEFAULT_ROOM_SETTINGS.rounds
export const EDIT_DURATION_SECONDS = DEFAULT_ROOM_SETTINGS.editDurationSeconds
export const COUNTDOWN_DURATION_MS = 3450
export const WINNER_REVEAL_DURATION_MS = 8200

const ROUND_CHALLENGES = {
  classic: [
    'Transforme o passeio em uma aventura impossível',
    'Venda isso como a invenção do século',
    'Crie a capa de um filme que ninguém pediu',
  ],
  comedy: [
    'Crie o pior anúncio que alguém aprovaria',
    'Faça parecer que tudo deu muito errado',
    'Transforme a cena no meme do grupo',
  ],
  theme: [
    'Transforme tudo em uma aventura espacial',
    'Faça uma versão digna de filme de terror',
    'Reimagine a cena em um futuro absurdo',
  ],
  chaos: [
    'Misture luxo, perigo e uma capivara',
    'Crie uma notícia urgente que não faz sentido',
    'Faça a edição mais exagerada possível',
  ],
}

function hashSeed(seed) {
  return Array.from(seed).reduce(
    (hash, character) => ((hash * 31) + character.charCodeAt(0)) >>> 0,
    0,
  )
}

export function createRoundSession(roomCode, roomData = {}) {
  const number = roomData.roundNumber ?? 1
  const settings = normalizeRoomSettings(roomData.settings)
  const serverStart = roomData.updatedAt?.toMillis?.()
  const startedAt = Number.isFinite(serverStart) ? serverStart : Date.now()
  const challenges = ROUND_CHALLENGES[settings.mode]
  const challengeIndex = hashSeed(`${roomCode}:${number}:${settings.mode}`) % challenges.length

  return {
    baseImageData: roomData.selectedImageData ?? '/sample-base.svg',
    challenge: challenges[challengeIndex],
    endsAt: startedAt
      + WINNER_REVEAL_DURATION_MS
      + COUNTDOWN_DURATION_MS
      + (settings.editDurationSeconds * 1000),
    mode: settings.mode,
    number,
    startedAt,
    total: settings.rounds,
    votesPerPlayer: settings.votesPerPlayer,
  }
}

export function formatRoundTime(totalSeconds) {
  const safeSeconds = Math.max(0, totalSeconds)
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
