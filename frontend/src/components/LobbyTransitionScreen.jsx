import { useEffect, useEffectEvent } from 'react'
import './session.css'

const LOBBY_TRANSITION_DURATION_MS = 3000

function LobbyTransitionScreen({ onComplete, roomCode, roundNumber, totalRounds }) {
  const completeTransition = useEffectEvent(onComplete)

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timeout = window.setTimeout(
      completeTransition,
      reducedMotion ? 700 : LOBBY_TRANSITION_DURATION_MS,
    )
    return () => window.clearTimeout(timeout)
  }, [])

  return (
    <main className="session-shell lobby-transition-shell">
      <div className="session-noise" aria-hidden="true" />
      <div className="transition-paper transition-paper-left" aria-hidden="true" />
      <div className="transition-paper transition-paper-right" aria-hidden="true" />

      <section className="lobby-transition-content" role="status" aria-live="polite">
        <span className="transition-kicker">
          Sala {roomCode} · Rodada {roundNumber}/{totalRounds}
        </span>
        <div className="transition-icon" aria-hidden="true">
          <i className="bi bi-images" />
          <span className="transition-spark spark-one">✦</span>
          <span className="transition-spark spark-two">✷</span>
        </div>
        <p>Todo mundo dentro?</p>
        <h1>Preparem as imagens!</h1>
        <div className="transition-progress" aria-hidden="true"><span /></div>
      </section>
    </main>
  )
}

export default LobbyTransitionScreen
