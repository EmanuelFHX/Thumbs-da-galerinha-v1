import { useEffect, useRef, useState } from 'react'
import { prepareBaseImage } from '../lib/imagePreparation.js'
import './session.css'

function BaseImageSubmitScreen({
  connectionError,
  images,
  isHost,
  onBeginVoting,
  onLeave,
  onSubmit,
  playerId,
  roomCode,
  totalPlayers,
}) {
  const inputRef = useRef(null)
  const [error, setError] = useState('')
  const [isPreparing, setIsPreparing] = useState(false)
  const [localPreview, setLocalPreview] = useState(null)
  const ownImage = images.find((image) => image.id === playerId)
  const previewSource = localPreview || ownImage?.imageData
  const everyoneSubmitted = images.length >= totalPlayers

  useEffect(() => () => {
    if (localPreview) URL.revokeObjectURL(localPreview)
  }, [localPreview])

  async function handleFile(event) {
    const input = event.currentTarget
    const [file] = event.target.files
    if (!file) return

    const previewUrl = URL.createObjectURL(file)
    setLocalPreview(previewUrl)
    setIsPreparing(true)
    setError('')

    try {
      const imageData = await prepareBaseImage(file)
      await onSubmit(imageData)
    } catch (uploadError) {
      setLocalPreview(null)
      setError(uploadError.message || 'Não foi possível enviar a imagem.')
    } finally {
      setIsPreparing(false)
      input.value = ''
    }
  }

  return (
    <main className="session-shell image-pick-shell">
      <div className="session-noise" aria-hidden="true" />
      <header className="session-topbar">
        <span className="room-chip"><span>Sala</span><strong>{roomCode}</strong></span>
        <span className="lobby-status is-online">
          <i className="bi bi-images" aria-hidden="true" /> Escolha das imagens
        </span>
      </header>

      <section className="image-pick-layout" aria-labelledby="image-pick-title">
        <div className="image-pick-copy">
          <span className="step-sticker">Etapa 1 de 2</span>
          <p className="session-eyebrow">Matéria-prima da rodada</p>
          <h1 id="image-pick-title">Manda uma imagem!</h1>
          <p>Escolha uma foto que renderia uma edição absurda. Ela entrará anonimamente na votação.</p>

          <input
            ref={inputRef}
            className="sr-only"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFile}
          />
          <button
            className="session-primary"
            type="button"
            disabled={isPreparing}
            onClick={() => inputRef.current?.click()}
          >
            <i className={`bi ${isPreparing ? 'bi-arrow-repeat is-spinning' : 'bi-cloud-arrow-up-fill'}`} aria-hidden="true" />
            {isPreparing ? 'Preparando imagem…' : ownImage ? 'Trocar minha imagem' : 'Escolher imagem'}
          </button>
          {error && <p className="session-error" role="alert">{error}</p>}
          {!error && connectionError && <p className="session-error" role="alert">{connectionError}</p>}
        </div>

        <div className={`image-drop-card${previewSource ? ' has-image' : ''}`}>
          <span className="card-tape" aria-hidden="true" />
          {previewSource ? (
            <img src={previewSource} alt="Prévia da imagem escolhida para a votação" decoding="async" />
          ) : (
            <div className="image-drop-empty">
              <i className="bi bi-image" aria-hidden="true" />
              <strong>Sua imagem aparece aqui</strong>
              <span>PNG, JPG ou WebP · até 8 MB</span>
            </div>
          )}
          {isPreparing && (
            <span className="image-preparing-badge" role="status">
              <i className="bi bi-arrow-repeat is-spinning" aria-hidden="true" />
              Otimizando para enviar…
            </span>
          )}
        </div>

        <aside className="phase-progress-card">
          <span>Imagens recebidas</span>
          <strong>{images.length}/{totalPlayers}</strong>
          <div className="submission-dots" aria-hidden="true">
            {Array.from({ length: totalPlayers }, (_, index) => (
              <span className={index < images.length ? 'is-filled' : ''} key={index} />
            ))}
          </div>
          <p>{everyoneSubmitted ? 'Tudo pronto para votar!' : 'Esperando o restante da galera.'}</p>
          {isHost ? (
            <button
              className="session-primary"
              type="button"
              disabled={!everyoneSubmitted || images.length === 0}
              onClick={onBeginVoting}
            >
              Começar votação <i className="bi bi-arrow-right" aria-hidden="true" />
            </button>
          ) : (
            <span className="waiting-sticker"><i className="bi bi-hourglass-split" /> Aguardando o host</span>
          )}
          <button className="leave-match-button" type="button" onClick={onLeave}>Sair para o menu</button>
        </aside>
      </section>
    </main>
  )
}

export default BaseImageSubmitScreen
