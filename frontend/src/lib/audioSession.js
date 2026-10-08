const EDITOR_MUSIC_SOURCE = '/audio/editor-music.mp3'
const EDITOR_MUSIC_VOLUME = 0.22

let editorMusic = null
let editorMusicUnlocked = false

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
        music.pause()
        music.currentTime = 0
        music.volume = previousVolume
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

export function startEditorMusic() {
  const music = getEditorMusic()
  if (!music) return Promise.reject(new Error('Áudio indisponível.'))

  music.loop = true
  music.muted = false
  music.volume = EDITOR_MUSIC_VOLUME
  music.currentTime = 0
  return music.play()
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
  music.pause()
  music.currentTime = 0
}
