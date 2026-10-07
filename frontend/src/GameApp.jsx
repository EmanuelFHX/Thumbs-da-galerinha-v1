import { useState } from 'react'
import './game.css'

const ROOM_CODE_LENGTH = 6

function GameApp() {
  const [roomCode, setRoomCode] = useState('')
  const [notice, setNotice] = useState('')

  const normalizedCode = roomCode.trim().toUpperCase()
  const canJoin = normalizedCode.length === ROOM_CODE_LENGTH

  function handleCreateGame() {
    setNotice('O modo local será a primeira partida jogável.')
  }

  function handleJoinGame(event) {
    event.preventDefault()
    if (!canJoin) return
    setNotice(`A sala ${normalizedCode} será conectada ao multiplayer.`)
  }

  function handleCodeChange(event) {
    const nextCode = event.target.value
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, ROOM_CODE_LENGTH)
      .toUpperCase()

    setRoomCode(nextCode)
    setNotice('')
  }

  return (
    <main className="game-shell">
      <div className="paper-noise" aria-hidden="true" />

      <header className="topbar">
        <span className="prototype-stamp">Protótipo</span>
        <button className="sound-button" type="button" aria-label="Configurações de som">
          Som: ligado
        </button>
      </header>

      <section className="menu" aria-labelledby="game-title">
        <div className="brand-block">
          <span className="doodle doodle-star" aria-hidden="true">✦</span>
          <span className="doodle doodle-arrow" aria-hidden="true">↝</span>

          <div className="thumbnail-mark" aria-hidden="true">
            <div className="thumbnail-sun" />
            <div className="thumbnail-hill thumbnail-hill-left" />
            <div className="thumbnail-hill thumbnail-hill-right" />
            <span>TOP!</span>
          </div>

          <p className="eyebrow">Pegue a imagem. Solte a criatividade.</p>
          <h1 id="game-title">
            <span>Thumbs</span>
            <strong>da Galerinha</strong>
          </h1>
          <p className="tagline">Edite, zoe e conquiste os votos da galera.</p>
        </div>

        <div className="action-board">
          <div className="tape tape-left" aria-hidden="true" />
          <div className="tape tape-right" aria-hidden="true" />

          <button className="primary-button" type="button" onClick={handleCreateGame}>
            Criar partida
            <span aria-hidden="true">→</span>
          </button>

          <div className="divider" aria-hidden="true">
            <span>ou entre na bagunça</span>
          </div>

          <form className="join-form" onSubmit={handleJoinGame}>
            <label htmlFor="room-code">Código da sala</label>
            <div className="join-row">
              <input
                id="room-code"
                name="room-code"
                type="text"
                value={roomCode}
                onChange={handleCodeChange}
                placeholder="ABC123"
                autoComplete="off"
                spellCheck="false"
                inputMode="text"
                aria-describedby="code-help"
              />
              <button type="submit" disabled={!canJoin}>Entrar</button>
            </div>
            <span id="code-help" className="field-help">
              Use os 6 caracteres enviados pelo host.
            </span>
          </form>

          <p className="notice" aria-live="polite">
            {notice || 'Nenhum cadastro. Só escolher um nome e jogar.'}
          </p>
        </div>
      </section>

      <footer className="footer-note">
        <span aria-hidden="true">✎</span>
        <p>Um jogo de edição criativa para a galera toda.</p>
      </footer>
    </main>
  )
}

export default GameApp
