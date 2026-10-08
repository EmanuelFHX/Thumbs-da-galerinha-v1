import './session.css'

function RoundVoteScreen({
  connectionError,
  isFinishing,
  isHost,
  isVoting,
  onFinishVoting,
  onVote,
  playerId,
  roomCode,
  round,
  submissions,
  totalPlayers,
  votes,
}) {
  const ownVote = votes.find((vote) => vote.id === playerId)
  const selectedIds = ownVote?.submissionIds ?? []
  const availableChoices = submissions.filter((submission) => submission.id !== playerId).length
  const voteLimit = Math.min(round.votesPerPlayer, availableChoices)
  const isSoloRound = voteLimit === 0
  const everyoneVoted = isSoloRound || votes.length >= totalPlayers

  return (
    <main className="session-shell round-vote-shell">
      <div className="session-noise" aria-hidden="true" />
      <header className="session-topbar">
        <span className="room-chip"><span>Sala</span><strong>{roomCode}</strong></span>
        <span className="lobby-status is-online">
          <i className="bi bi-ballot-fill" aria-hidden="true" />
          {isSoloRound ? 'Rodada solo' : `${votes.length}/${totalPlayers} votaram`}
        </span>
      </header>

      <section className="round-vote-layout" aria-labelledby="round-vote-title">
        <div className="round-vote-heading">
          <span className="step-sticker">Rodada {round.number}/{round.total}</span>
          <p className="session-eyebrow">Galeria anônima</p>
          <h1 id="round-vote-title">Qual thumb merece o troféu?</h1>
          <p>
            {isSoloRound
              ? 'Sua criação já está pronta para a revelação.'
              : `Escolha até ${voteLimit} ${voteLimit === 1 ? 'favorita' : 'favoritas'}. A autoria aparece só depois da votação.`}
          </p>
        </div>

        <div className="thumb-gallery-grid">
          {submissions.map((submission, index) => {
            const isOwn = submission.id === playerId
            const isSelected = selectedIds.includes(submission.id)

            return (
              <button
                className={`thumb-gallery-card${isSelected ? ' is-selected' : ''}${isOwn ? ' is-own' : ''}`}
                type="button"
                key={submission.id}
                aria-label={isOwn ? `Thumb ${index + 1}, sua criação` : `Votar na thumb ${index + 1}`}
                aria-pressed={isSelected}
                disabled={isOwn || isVoting || isSoloRound}
                onClick={() => onVote(submission.id, selectedIds, voteLimit)}
              >
                <span className="candidate-number">#{index + 1}</span>
                <img
                  src={submission.imageData}
                  alt={`Thumb anônima ${index + 1}`}
                  draggable="false"
                />
                <span className="candidate-action">
                  <i
                    className={`bi ${isOwn
                      ? 'bi-person-fill'
                      : isSelected
                        ? 'bi-heart-fill'
                        : 'bi-heart'}`}
                    aria-hidden="true"
                  />
                  {isOwn ? 'Sua thumb' : isSelected ? 'Favorita' : 'Dar voto'}
                </span>
              </button>
            )
          })}
        </div>

        <div className="vote-footer round-vote-footer">
          <div>
            <strong>
              {isSoloRound
                ? 'Sem votação nesta rodada'
                : `${selectedIds.length}/${voteLimit} ${voteLimit === 1 ? 'voto escolhido' : 'votos escolhidos'}`}
            </strong>
            <p>
              {connectionError
                || (ownVote ? 'Voto salvo. Você ainda pode trocar suas escolhas.' : 'As thumbs continuam sem nome até a revelação.')}
            </p>
          </div>

          {isHost ? (
            <button
              className="session-primary"
              type="button"
              disabled={!everyoneVoted || isFinishing}
              onClick={onFinishVoting}
            >
              {isFinishing ? 'Contando votos…' : 'Revelar resultado'}
              <i className="bi bi-stars" aria-hidden="true" />
            </button>
          ) : everyoneVoted ? (
            <span className="waiting-sticker">
              <i className="bi bi-hourglass-split" aria-hidden="true" /> Aguardando o host
            </span>
          ) : null}
        </div>
      </section>
    </main>
  )
}

export default RoundVoteScreen
