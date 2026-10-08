import { useEffect, useState } from 'react'
import './session.css'

const COUNTDOWN_STEPS = ['3', '2', '1', 'EDITAR!']

function playCountdownBeep(isEditStep) {
  const AudioContext = window.AudioContext || window.webkitAudioContext
  if (!AudioContext) return () => {}

  const context = new AudioContext()
  const master = context.createGain()
  const now = context.currentTime
  const notes = isEditStep
    ? [
        { duration: 0.12, frequency: 740, start: 0 },
        { duration: 0.24, frequency: 1046.5, start: 0.12 },
      ]
    : [{ duration: 0.16, frequency: 620, start: 0 }]
  const oscillators = []

  context.resume().catch(() => {
    // A contagem visual continua mesmo se o navegador bloquear o áudio.
  })
  master.gain.value = isEditStep ? 0.16 : 0.12
  master.connect(context.destination)

  notes.forEach(({ duration, frequency, start }) => {
    const oscillator = context.createOscillator()
    const noteGain = context.createGain()
    const noteStart = now + start
    const noteEnd = noteStart + duration

    oscillator.type = isEditStep ? 'triangle' : 'sine'
    oscillator.frequency.setValueAtTime(frequency, noteStart)
    noteGain.gain.setValueAtTime(0.0001, noteStart)
    noteGain.gain.exponentialRampToValueAtTime(1, noteStart + 0.012)
    noteGain.gain.setValueAtTime(0.76, Math.max(noteStart + 0.02, noteEnd - 0.055))
    noteGain.gain.exponentialRampToValueAtTime(0.0001, noteEnd)

    oscillator.connect(noteGain)
    noteGain.connect(master)
    oscillator.start(noteStart)
    oscillator.stop(noteEnd + 0.01)
    oscillators.push(oscillator)
  })

  return () => {
    oscillators.forEach((oscillator) => {
      try {
        oscillator.stop()
      } catch {
        // O bip já terminou naturalmente.
      }
    })
    context.close().catch(() => {})
  }
}

function ChallengeScreen({ onComplete, roomCode, round }) {
  const [countdownIndex, setCountdownIndex] = useState(0)
  const countdownStep = COUNTDOWN_STEPS[countdownIndex]
  const isEditStep = countdownStep === 'EDITAR!'

  useEffect(() => playCountdownBeep(isEditStep), [countdownIndex, isEditStep])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (countdownIndex === COUNTDOWN_STEPS.length - 1) {
        onComplete()
        return
      }

      setCountdownIndex((current) => current + 1)
    }, isEditStep ? 750 : 900)

    return () => window.clearTimeout(timeout)
  }, [countdownIndex, isEditStep, onComplete])

  return (
    <main className="session-shell challenge-shell">
      <div className="session-noise" aria-hidden="true" />
      <header className="session-topbar">
        <span className="room-chip">
          <span>Sala</span>
          <strong>{roomCode}</strong>
        </span>
        <span className="lobby-status is-online">
          <i className="bi bi-arrow-repeat" aria-hidden="true" />
          Rodada {round.number}/{round.total}
        </span>
      </header>

      <section className="challenge-layout" aria-labelledby="challenge-title">
        <div className="challenge-preview">
          <span className="card-tape" aria-hidden="true" />
          <img src={round.baseImageData} alt="Imagem-base vencedora da rodada" />
        </div>

        <div className="challenge-copy">
          <p className="session-eyebrow">Seu desafio é</p>
          <h1 id="challenge-title">{round.challenge}</h1>
          <p>A imagem mais votada venceu. Agora todo mundo edita a mesma foto.</p>
        </div>
      </section>

      <div
        className={`challenge-countdown-overlay${isEditStep ? ' is-edit-step' : ''}`}
        role="status"
        aria-live="assertive"
        aria-atomic="true"
      >
        <div className="countdown-burst" key={countdownStep}>
          <span>{isEditStep ? 'Valendo!' : 'Prepare-se'}</span>
          <strong>{countdownStep}</strong>
        </div>
      </div>
    </main>
  )
}

export default ChallengeScreen
