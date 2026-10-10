import { useEffect, useEffectEvent } from 'react'
import './session.css'

const IMAGE_VOTE_TRANSITION_DURATION_MS = 4200

function ImageVoteTransitionScreen({ images, onComplete, roomCode, roundNumber, totalRounds }) {
  const completeTransition = useEffectEvent(onComplete)

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timeout = window.setTimeout(
      completeTransition,
      reducedMotion ? 700 : IMAGE_VOTE_TRANSITION_DURATION_MS,
    )

    return () => window.clearTimeout(timeout)
  }, [])

  const previewImages = images.slice(0, 5)

  return (
    <main className="session-shell image-vote-transition-shell">
      <div className="session-noise" aria-hidden="true" />

      <header className="session-topbar">
        <span className="room-chip"><span>Sala</span><strong>{roomCode}</strong></span>
        <span className="lobby-status is-online">
          <i className="bi bi-images" aria-hidden="true" /> Rodada {roundNumber}/{totalRounds}
        </span>
      </header>

      <section className="image-vote-transition-content" role="status" aria-live="polite">
        <div className="vote-transition-gallery" aria-hidden="true">
          <span className="vote-transition-wire" />
          <span className="vote-transition-spotlight spotlight-left" />
          <span className="vote-transition-spotlight spotlight-right" />

          <div className="vote-transition-cards">
            {previewImages.map((image, index) => (
              <span
                className={`vote-transition-card card-${index + 1}`}
                key={image.id}
              >
                <i className="bi bi-paperclip" />
                <img src={image.imageData} alt="" />
              </span>
            ))}
          </div>

          <span className="vote-transition-stamp">
            <i className="bi bi-hand-index-thumb-fill" /> Escolha secreta
          </span>
          <span className="vote-transition-spark spark-left">✦</span>
          <span className="vote-transition-spark spark-right">✷</span>
        </div>

        <p className="session-eyebrow">Todas as imagens chegaram</p>
        <h1>Hora de escolher!</h1>
        <p>Olhos atentos: a votação vai começar.</p>
        <div className="vote-transition-progress" aria-hidden="true"><span /></div>
      </section>
    </main>
  )
}

export default ImageVoteTransitionScreen
