import './session.css'

function RoundCompleteScreen({
  imageDataUrl,
  isOpeningGallery,
  onLeave,
  onRetry,
  reason,
  roomCode,
  round,
  submission,
  totalPlayers,
}) {
  const isUploading = submission.status === 'uploading'
  const hasError = submission.status === 'error'
  const isSubmitted = submission.status === 'submitted'
  const everyoneSubmitted = submission.count >= totalPlayers

  return (
    <main className="session-shell round-complete-shell">
      <div className="session-noise" aria-hidden="true" />
      <header className="session-topbar">
        <span className="room-chip">
          <span>Sala</span>
          <strong>{roomCode}</strong>
        </span>
        <span className={`lobby-status ${hasError ? 'has-error' : 'is-online'}`}>
          <i
            className={`bi ${isUploading
              ? 'bi-arrow-repeat is-spinning'
              : hasError
                ? 'bi-exclamation-triangle-fill'
                : 'bi-cloud-check-fill'}`}
            aria-hidden="true"
          />
          {isUploading ? 'Enviando thumb' : hasError ? 'Envio interrompido' : 'Thumb enviada'}
        </span>
      </header>

      <section className="round-complete-layout" aria-labelledby="round-complete-title">
        <div className="round-complete-preview">
          <span className="card-tape" aria-hidden="true" />
          <img src={imageDataUrl} alt="Prévia da sua thumb finalizada" />
        </div>

        <div className="round-complete-copy">
          <span className="step-sticker">Rodada {round.number}/{round.total}</span>
          <p className="session-eyebrow">
            {reason === 'timeout' ? 'O tempo acabou' : 'Edição finalizada'}
          </p>
          <h1 id="round-complete-title" aria-live="polite">
            {isUploading
              ? 'Subindo a arte…'
              : hasError
                ? 'A conexão borrou tudo.'
                : everyoneSubmitted
                  ? 'Abrindo a galeria!'
                  : 'Thumb enviada!'}
          </h1>

          {hasError ? (
            <div className="submission-error" role="alert">
              <i className="bi bi-wifi-off" aria-hidden="true" />
              <p>{submission.error}</p>
            </div>
          ) : (
            <div className="submission-progress" aria-live="polite">
              <div>
                <span>Thumbs recebidas</span>
                <strong>{submission.count}/{totalPlayers}</strong>
              </div>
              <div className="submission-dots" aria-hidden="true">
                {Array.from({ length: totalPlayers }, (_, index) => (
                  <span className={index < submission.count ? 'is-filled' : ''} key={index} />
                ))}
              </div>
              <p>
                {isUploading
                  ? 'Guardando sua criação com cuidado…'
                  : everyoneSubmitted
                    ? 'Todo mundo entregou. Preparando a votação anônima…'
                    : 'Esperando o restante da galera terminar.'}
              </p>
            </div>
          )}

          {hasError && (
            <button className="session-primary" type="button" onClick={onRetry}>
              Tentar enviar novamente <i className="bi bi-arrow-clockwise" aria-hidden="true" />
            </button>
          )}

          {isSubmitted && !hasError && (
            <span className="waiting-sticker">
              <i className={`bi ${everyoneSubmitted ? 'bi-images' : 'bi-hourglass-split'}`} aria-hidden="true" />
              {everyoneSubmitted || isOpeningGallery ? 'Montando a galeria' : 'Aguardando a galera'}
            </span>
          )}

          <button className="leave-match-button" type="button" onClick={onLeave}>
            Sair para o menu
          </button>
        </div>
      </section>
    </main>
  )
}

export default RoundCompleteScreen
