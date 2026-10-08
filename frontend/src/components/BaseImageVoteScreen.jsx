import './session.css'

function BaseImageVoteScreen({
  connectionError,
  images,
  isHost,
  onFinishVoting,
  onVote,
  playerId,
  roomCode,
  totalPlayers,
  votes,
}) {
  const ownVote = votes.find((vote) => vote.id === playerId)?.imageId
  const everyoneVoted = votes.length >= totalPlayers

  return (
    <main className="session-shell image-vote-shell">
      <div className="session-noise" aria-hidden="true" />
      <header className="session-topbar">
        <span className="room-chip"><span>Sala</span><strong>{roomCode}</strong></span>
        <span className="lobby-status is-online">
          <i className="bi bi-hand-thumbs-up-fill" aria-hidden="true" /> {votes.length}/{totalPlayers} votaram
        </span>
      </header>

      <section className="image-vote-layout" aria-labelledby="image-vote-title">
        <div className="image-vote-heading">
          <span className="step-sticker">Etapa 2 de 2</span>
          <p className="session-eyebrow">Escolha da galera</p>
          <h1 id="image-vote-title">Qual imagem vai pro editor?</h1>
          <p>Os autores ficam escondidos. Escolha a imagem com mais potencial para o caos.</p>
        </div>

        <div className="candidate-grid">
          {images.map((image, index) => (
            <button
              className={`candidate-card${ownVote === image.id ? ' is-selected' : ''}`}
              type="button"
              key={image.id}
              aria-pressed={ownVote === image.id}
              onClick={() => onVote(image.id)}
            >
              <span className="candidate-number">#{index + 1}</span>
              <img src={image.imageData} alt={`Imagem candidata ${index + 1}`} />
              <span className="candidate-action">
                <i className={`bi ${ownVote === image.id ? 'bi-check-circle-fill' : 'bi-hand-thumbs-up'}`} aria-hidden="true" />
                {ownVote === image.id ? 'Seu voto' : 'Votar nessa'}
              </span>
            </button>
          ))}
        </div>

        <div className="vote-footer">
          <p>{connectionError || (ownVote ? 'Voto registrado. Você ainda pode trocar.' : 'Escolha uma imagem para votar.')}</p>
          {isHost && (
            <button
              className="session-primary"
              type="button"
              disabled={!everyoneVoted}
              onClick={onFinishVoting}
            >
              Revelar vencedora <i className="bi bi-stars" aria-hidden="true" />
            </button>
          )}
          {!isHost && everyoneVoted && (
            <span className="waiting-sticker"><i className="bi bi-hourglass-split" /> Aguardando o host</span>
          )}
        </div>
      </section>
    </main>
  )
}

export default BaseImageVoteScreen
