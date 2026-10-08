const EDITOR_MUSIC_SOURCE = '/audio/editor-music.mp3'
const EDITOR_MUSIC_VOLUME = 0.22

let editorMusic = null
let editorMusicUnlocked = false
let interfaceAudioContext = null

function getInterfaceAudioContext() {
  if (typeof window === 'undefined') return null
  const AudioContext = window.AudioContext || window.webkitAudioContext
  if (!AudioContext) return null

  interfaceAudioContext ??= new AudioContext()
  return interfaceAudioContext
}

function scheduleTone(context, destination, {
  duration,
  frequency,
  gain = 0.5,
  start = 0,
  type = 'sine',
}) {
  const oscillator = context.createOscillator()
  const noteGain = context.createGain()
  const noteStart = context.currentTime + start
  const noteEnd = noteStart + duration

  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, noteStart)
  noteGain.gain.setValueAtTime(0.0001, noteStart)
  noteGain.gain.exponentialRampToValueAtTime(gain, noteStart + 0.012)
  noteGain.gain.exponentialRampToValueAtTime(0.0001, noteEnd)
  oscillator.connect(noteGain)
  noteGain.connect(destination)
  oscillator.start(noteStart)
  oscillator.stop(noteEnd + 0.02)
}

function getEditorMusic() {
  if (typeof Audio === 'undefined') return null
  if (editorMusic) return editorMusic

  editorMusic = new Audio(EDITOR_MUSIC_SOURCE)
  editorMusic.loop = true
  editorMusic.preload = 'auto'
  editorMusic.volume = EDITOR_MUSIC_VOLUME
  return editorMusic
}

export function armEditorMusicAutoplay() {
  if (typeof window === 'undefined') return () => {}

  let active = true

  function detach() {
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
  }

  function unlock() {
    if (!active || editorMusicUnlocked) return
    const music = getEditorMusic()
    if (!music) return

    const previousVolume = music.volume
    music.muted = false
    music.volume = 0.001
    music.currentTime = 0
    music.play()
      .then(() => {
        if (!active) return
        editorMusicUnlocked = true
        detach()
      })
      .catch(() => {
        music.volume = previousVolume
      })
  }

  window.addEventListener('pointerdown', unlock, { passive: true })
  window.addEventListener('keydown', unlock)

  return () => {
    active = false
    detach()
  }
}

export function armInterfaceSounds() {
  if (typeof window === 'undefined') return () => {}

  let active = true

  function detach() {
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
  }

  function unlock() {
    if (!active) return
    const context = getInterfaceAudioContext()
    if (!context) return

    context.resume().then(detach).catch(() => {
      // Uma interação futura poderá tentar liberar o áudio novamente.
    })
  }

  window.addEventListener('pointerdown', unlock, { passive: true })
  window.addEventListener('keydown', unlock)

  return () => {
    active = false
    detach()
  }
}

export function playRoomActivitySound(kind, isComplete = false) {
  const context = getInterfaceAudioContext()
  if (!context) return

  const play = () => {
    const master = context.createGain()
    const filter = context.createBiquadFilter()
    const now = context.currentTime
    const notes = kind === 'vote'
      ? [
          { duration: 0.11, frequency: 783.99, gain: 0.5, type: 'triangle' },
          { duration: 0.14, frequency: 1046.5, gain: 0.36, start: 0.07, type: 'sine' },
        ]
      : [
          { duration: 0.14, frequency: 392, gain: 0.52, type: 'triangle' },
          { duration: 0.18, frequency: 523.25, gain: 0.4, start: 0.08, type: 'sine' },
        ]

    if (isComplete) {
      notes.push({
        duration: 0.24,
        frequency: kind === 'vote' ? 1318.51 : 659.25,
        gain: 0.34,
        start: 0.18,
        type: 'sine',
      })
    }

    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(kind === 'vote' ? 2800 : 1900, now)
    filter.Q.value = 0.7
    master.gain.setValueAtTime(0.25, now)
    master.gain.exponentialRampToValueAtTime(0.0001, now + (isComplete ? 0.48 : 0.32))
    filter.connect(master)
    master.connect(context.destination)
    notes.forEach((note) => scheduleTone(context, filter, note))
  }

  if (context.state === 'suspended') {
    context.resume().then(play).catch(() => {
      // A atualização visual continua mesmo se o navegador bloquear o áudio.
    })
    return
  }

  play()
}

export function startEditorMusic() {
  const music = getEditorMusic()
  if (!music) return Promise.reject(new Error('Áudio indisponível.'))

  music.loop = true
  music.muted = false
  music.volume = EDITOR_MUSIC_VOLUME
  music.currentTime = 0
  return music.paused ? music.play() : Promise.resolve()
}

export function setEditorMusicMuted(muted) {
  const music = getEditorMusic()
  if (!music) return Promise.reject(new Error('Áudio indisponível.'))

  music.muted = muted
  if (muted) {
    music.pause()
    return Promise.resolve()
  }

  music.volume = EDITOR_MUSIC_VOLUME
  return music.play()
}

export function stopEditorMusic() {
  const music = getEditorMusic()
  if (!music) return

  if (editorMusicUnlocked && !music.muted) {
    music.volume = 0.001
  } else {
    music.pause()
  }
  music.currentTime = 0
}
