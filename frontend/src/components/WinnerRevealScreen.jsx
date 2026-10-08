import { useEffect, useEffectEvent, useRef } from 'react'
import { WINNER_REVEAL_DURATION_MS } from '../lib/roundSession.js'
import './session.css'

const VOICE_REVEAL_DELAY_MS = 2700
const CELEBRATION_REVEAL_DELAY_MS = 3900

const CONFETTI_COLORS = ['#ff5378', '#ffd84a', '#43b7ff', '#63d98b', '#fff4d8']
const CONFETTI_PIECES = Array.from({ length: 42 }, (_, index) => ({
  color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
  delay: `${(index % 7) * 38}ms`,
  drift: `${((index * 37) % 180) - 90}px`,
  duration: `${1800 + ((index * 83) % 700)}ms`,
  left: `${2 + ((index * 29) % 96)}%`,
  rotation: `${540 + ((index * 47) % 540)}deg`,
  size: `${7 + (index % 4) * 2}px`,
}))

function playRevealHorn() {
  const AudioContext = window.AudioContext || window.webkitAudioContext
  if (!AudioContext) return () => {}

  const context = new AudioContext()
  const master = context.createGain()
  const filter = context.createBiquadFilter()
  const now = context.currentTime
  const notes = [
    { duration: 0.2, frequency: 392, start: 0 },
    { duration: 0.2, frequency: 523.25, start: 0.18 },
    { duration: 0.62, frequency: 659.25, start: 0.36 },
    { duration: 0.62, frequency: 783.99, start: 0.36 },
  ]
  const oscillators = []

  context.resume().catch(() => {
    // O visual continua mesmo se o navegador bloquear áudio sintetizado.
  })

  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(2200, now)
  filter.frequency.exponentialRampToValueAtTime(1350, now + 1)
  filter.Q.value = 1.8

  master.gain.setValueAtTime(0.0001, now)
  master.gain.exponentialRampToValueAtTime(0.13, now + 0.025)
  master.gain.setValueAtTime(0.13, now + 0.72)
  master.gain.exponentialRampToValueAtTime(0.0001, now + 1.05)
  filter.connect(master)
  master.connect(context.destination)

  notes.forEach(({ duration, frequency, start }) => {
    const oscillator = context.createOscillator()
    const noteGain = context.createGain()
    const noteStart = now + start
    const noteEnd = noteStart + duration

    oscillator.type = 'sawtooth'
    oscillator.frequency.setValueAtTime(frequency, noteStart)
    oscillator.detune.setValueAtTime(-5, noteStart)
    oscillator.detune.linearRampToValueAtTime(8, noteEnd)
    noteGain.gain.setValueAtTime(0.0001, noteStart)
    noteGain.gain.exponentialRampToValueAtTime(0.52, noteStart + 0.025)
    noteGain.gain.setValueAtTime(0.42, Math.max(noteStart + 0.03, noteEnd - 0.08))
    noteGain.gain.exponentialRampToValueAtTime(0.0001, noteEnd)

    oscillator.connect(noteGain)
    noteGain.connect(filter)
    oscillator.start(noteStart)
    oscillator.stop(noteEnd + 0.02)
    oscillators.push(oscillator)
  })

  return () => {
    oscillators.forEach((oscillator) => {
      try {
        oscillator.stop()
      } catch {
        // A nota já terminou naturalmente.
      }
    })
    context.close().catch(() => {})
  }
}

function WinnerRevealScreen({ onComplete, roomCode, round }) {
  const completeReveal = useEffectEvent(onComplete)
  const drumrollRef = useRef(null)
  const voiceRef = useRef(null)
  const hornCleanupRef = useRef(() => {})

  useEffect(() => {
    const drumroll = drumrollRef.current
    const voice = voiceRef.current
    drumroll.volume = 0.62
    drumroll.currentTime = 0
    drumroll.play().catch(() => {
      // O navegador pode bloquear autoplay até a primeira interação do jogador.
    })

    const voiceTimeout = window.setTimeout(() => {
      drumroll.volume = 0.42
      voice.volume = 1
      voice.currentTime = 0
      voice.play().catch(() => {
        // O visual continua normalmente caso o navegador bloqueie o áudio.
      })
    }, VOICE_REVEAL_DELAY_MS)
    const celebrationTimeout = window.setTimeout(() => {
      hornCleanupRef.current = playRevealHorn()
    }, CELEBRATION_REVEAL_DELAY_MS)
    const timeout = window.setTimeout(completeReveal, WINNER_REVEAL_DURATION_MS)
    return () => {
      window.clearTimeout(voiceTimeout)
      window.clearTimeout(celebrationTimeout)
      window.clearTimeout(timeout)
      hornCleanupRef.current()
      drumroll.pause()
      drumroll.currentTime = 0
      voice.pause()
      voice.currentTime = 0
    }
  }, [])

  return (
    <main className="session-shell winner-reveal-shell">
      <audio ref={drumrollRef} src="/audio/drumroll.mp3" preload="auto" aria-hidden="true" />
      <audio ref={voiceRef} src="/audio/winner-announcement.mp3" preload="auto" aria-hidden="true" />
      <div className="stage-grain" aria-hidden="true" />
      <div className="stage-curtain stage-curtain-left" aria-hidden="true" />
      <div className="stage-curtain stage-curtain-right" aria-hidden="true" />
      <div className="stage-spotlight spotlight-left" aria-hidden="true" />
      <div className="stage-spotlight spotlight-right" aria-hidden="true" />
      <div className="winner-confetti" aria-hidden="true">
        {CONFETTI_PIECES.map((piece, index) => (
          <span
            key={index}
            style={{
              '--confetti-color': piece.color,
              '--confetti-delay': piece.delay,
              '--confetti-drift': piece.drift,
              '--confetti-duration': piece.duration,
              '--confetti-left': piece.left,
              '--confetti-rotation': piece.rotation,
              '--confetti-size': piece.size,
            }}
          />
        ))}
      </div>

      <header className="session-topbar winner-stage-topbar">
        <span className="room-chip"><span>Sala</span><strong>{roomCode}</strong></span>
        <span className="lobby-status is-online">
          <i className="bi bi-stars" aria-hidden="true" /> Resultado da votação
        </span>
      </header>

      <section className="winner-stage" aria-labelledby="winner-title">
        <div className="winner-announcement">
          <span className="winner-kicker">A galera escolheu</span>
          <h1 id="winner-title">E a imagem é…</h1>
        </div>

        <div className="winner-image-frame">
          <span className="winner-badge"><i className="bi bi-trophy-fill" /> Mais votada</span>
          <img src={round.baseImageData} alt="Imagem mais votada pela sala" />
        </div>

        <p className="winner-next">Olha bem… daqui a pouco começa a edição.</p>
      </section>
    </main>
  )
}

export default WinnerRevealScreen
