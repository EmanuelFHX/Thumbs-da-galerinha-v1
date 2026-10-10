import { useEffect, useEffectEvent } from 'react'
import './session.css'

const RESULT_TRANSITION_DURATION_MS = 3600

function RoundResultTransitionScreen({ onComplete, roomCode, round, submissions }) {
  const completeTransition = useEffectEvent(onComplete)

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timeout = window.setTimeout(
      completeTransition,
      reducedMotion ? 800 : RESULT_TRANSITION_DURATION_MS,
    )

    return () => window.clearTimeout(timeout)
  }, [])

  return (
    <main className="session-shell result-transition-shell">
      <div className="session-noise" aria-hidden="true" />

      <header className="session-topbar">
        <span className="room-chip"><span>Sala</span><strong>{roomCode}</strong></span>
        <span className="lobby-status is-online">
          <i className="bi bi-stars" aria-hidden="true" /> Rodada {round.number}/{round.total}
        </span>
      </header>

      <section className="result-transition-content" role="status" aria-live="polite">
        <div className="result-counting-stage" aria-hidden="true">
          <div className="result-card-stack">
            {submissions.slice(0, 4).map((submission, index) => (
              <span className={`result-mini-card card-${index + 1}`} key={submission.id}>
                <img src={submission.imageData} alt="" />
              </span>
            ))}
          </div>

          <div className="result-ballot-box">
            <span className="ballot-slot" />
            <i className="bi bi-trophy-fill" />
            <div className="tally-marks">
              <span /><span /><span /><span /><b />
            </div>
          </div>

          <span className="result-ready-stamp">Resultado pronto!</span>
          <span className="result-transition-spark spark-left">✦</span>
          <span className="result-transition-spark spark-right">✷</span>
        </div>

        <p className="session-eyebrow">Hora da verdade</p>
        <h1>Contando cada voto…</h1>
        <p>As assinaturas vão aparecer junto com a thumb vencedora.</p>
        <div className="result-counting-progress" aria-hidden="true"><span /></div>
      </section>
    </main>
  )
}

export default RoundResultTransitionScreen
