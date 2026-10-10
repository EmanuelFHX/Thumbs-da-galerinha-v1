import { useEffect, useRef } from 'react'
import { PlayerAvatar } from './PlayerAvatar.jsx'
import './session.css'

const VICTORY_SOUND_VOLUME = 0.35
const VICTORY_FADE_SECONDS = 1.25

function getVoteTotals(submissions, votes) {
  const totals = new Map(submissions.map((submission) => [submission.id, 0]))

  votes.forEach((vote) => {
    vote.submissionIds?.forEach((submissionId) => {
      if (totals.has(submissionId)) totals.set(submissionId, totals.get(submissionId) + 1)
    })
  })

  return totals
}

function RoundResultScreen({
  connectionError,
  isAdvancing,
  isHost,
  matchScores,
  onContinue,
  outcome,
  players,
  roomCode,
  round,
  submissions,
  votes,
}) {
  const victorySoundRef = useRef(null)
  const totals = getVoteTotals(submissions, votes)
  const ranking = [...submissions].sort((first, second) => {
    const scoreDifference = totals.get(second.id) - totals.get(first.id)
    return scoreDifference || first.id.localeCompare(second.id)
  })
  const winner = submissions.find((submission) => submission.id === outcome?.winnerId)
    ?? ranking[0]
  const winnerPlayer = players.find((candidate) => candidate.id === winner?.id)
  const winnerVotes = winner ? totals.get(winner.id) : 0

  useEffect(() => {
    const victorySound = victorySoundRef.current
    if (!victorySound) return undefined

    let fadeFrame = 0

    function updateFade() {
      const remainingSeconds = victorySound.duration - victorySound.currentTime

      if (Number.isFinite(remainingSeconds) && remainingSeconds <= VICTORY_FADE_SECONDS) {
        const fadeProgress = Math.max(0, remainingSeconds / VICTORY_FADE_SECONDS)
        victorySound.volume = VICTORY_SOUND_VOLUME * (fadeProgress ** 1.4)
      }

      if (!victorySound.paused && !victorySound.ended) {
        fadeFrame = window.requestAnimationFrame(updateFade)
      }
    }

    victorySound.volume = VICTORY_SOUND_VOLUME
    victorySound.currentTime = 0
    victorySound.play()
      .then(() => {
        fadeFrame = window.requestAnimationFrame(updateFade)
      })
      .catch(() => {
        // A revelação continua normalmente se o navegador bloquear o áudio.
      })

    return () => {
      window.cancelAnimationFrame(fadeFrame)
      victorySound.pause()
      victorySound.currentTime = 0
    }
  }, [])

  return (
    <main className="session-shell round-result-shell">
      <div className="session-noise" aria-hidden="true" />
      <audio
        ref={victorySoundRef}
        src="/audio/round-victory-doodle.wav"
        preload="auto"
        aria-hidden="true"
      />
      <header className="session-topbar">
        <span className="room-chip"><span>Sala</span><strong>{roomCode}</strong></span>
        <span className="lobby-status is-online">
          <i className="bi bi-trophy-fill" aria-hidden="true" /> Resultado da rodada
        </span>
      </header>

      <section className="round-result-layout" aria-labelledby="round-result-title">
        <div className="round-winner-card">
          <span className="winner-burst" aria-hidden="true">VENCEU!</span>
          <div className="round-winner-image">
            {winner && <img src={winner.imageData} alt="Thumb vencedora da rodada" />}
          </div>
          <div className="round-winner-author">
            <PlayerAvatar avatarId={winnerPlayer?.avatarId} />
            <div>
              <span>A obra era de</span>
              <strong>{winnerPlayer?.username ?? 'Artista misterioso'}</strong>
            </div>
            <b>{winnerVotes} {winnerVotes === 1 ? 'voto' : 'votos'}</b>
          </div>
        </div>

        <div className="round-result-copy">
          <span className="step-sticker">Rodada {round.number}/{round.total}</span>
          <p className="session-eyebrow">Os nomes apareceram</p>
          <h1 id="round-result-title">A galera decidiu!</h1>

          <ol className="round-ranking" aria-label="Ranking da rodada">
            {ranking.map((submission, index) => {
              const rankedPlayer = players.find((candidate) => candidate.id === submission.id)
              const score = totals.get(submission.id)
              const totalScore = matchScores[submission.id] ?? 0

              return (
                <li key={submission.id} className={submission.id === winner?.id ? 'is-winner' : ''}>
                  <span className="ranking-position">{index + 1}º</span>
                  <PlayerAvatar avatarId={rankedPlayer?.avatarId} />
                  <strong>{rankedPlayer?.username ?? 'Artista misterioso'}</strong>
                  <span className="ranking-score">
                    <b>+{score}</b>
                    <small>{totalScore} no total</small>
                  </span>
                </li>
              )
            })}
          </ol>

          {connectionError && <p className="session-error" role="alert">{connectionError}</p>}

          {isHost ? (
            <button
              className="session-primary"
              type="button"
              disabled={isAdvancing}
              onClick={onContinue}
            >
              {isAdvancing
                ? 'Preparando…'
                : round.number >= round.total
                  ? 'Ver campeão da partida'
                  : 'Próxima rodada'}
              <i
                className={`bi ${round.number >= round.total ? 'bi-trophy-fill' : 'bi-arrow-right-circle-fill'}`}
                aria-hidden="true"
              />
            </button>
          ) : (
            <span className="waiting-sticker">
              <i className="bi bi-hourglass-split" aria-hidden="true" />
              {round.number >= round.total ? 'Aguardando o placar final' : 'Aguardando a próxima rodada'}
            </span>
          )}
        </div>
      </section>
    </main>
  )
}

export default RoundResultScreen
