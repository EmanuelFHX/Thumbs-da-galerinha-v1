import { PlayerAvatar } from './PlayerAvatar.jsx'
import './session.css'

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
  onLeave,
  outcome,
  players,
  roomCode,
  round,
  submissions,
  votes,
}) {
  const totals = getVoteTotals(submissions, votes)
  const ranking = [...submissions].sort((first, second) => {
    const scoreDifference = totals.get(second.id) - totals.get(first.id)
    return scoreDifference || first.id.localeCompare(second.id)
  })
  const winner = submissions.find((submission) => submission.id === outcome?.winnerId)
    ?? ranking[0]
  const winnerPlayer = players.find((candidate) => candidate.id === winner?.id)
  const winnerVotes = winner ? totals.get(winner.id) : 0

  return (
    <main className="session-shell round-result-shell">
      <div className="session-noise" aria-hidden="true" />
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

              return (
                <li key={submission.id} className={submission.id === winner?.id ? 'is-winner' : ''}>
                  <span className="ranking-position">{index + 1}º</span>
                  <PlayerAvatar avatarId={rankedPlayer?.avatarId} />
                  <strong>{rankedPlayer?.username ?? 'Artista misterioso'}</strong>
                  <span className="ranking-score">{score} {score === 1 ? 'pt' : 'pts'}</span>
                </li>
              )
            })}
          </ol>

          <button className="session-primary" type="button" onClick={onLeave}>
            Voltar ao menu <i className="bi bi-house-door-fill" aria-hidden="true" />
          </button>
        </div>
      </section>
    </main>
  )
}

export default RoundResultScreen
