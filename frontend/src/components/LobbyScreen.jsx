import { PlayerAvatar } from './PlayerAvatar.jsx'
import './session.css'

function LobbyScreen({ isHost, onBack, onStart, player, roomCode }) {
  function copyRoomCode() {
    navigator.clipboard?.writeText(roomCode)
  }

  return (
    <main className="session-shell">
      <div className="session-noise" aria-hidden="true" />
      <header className="session-topbar">
        <button className="session-back" type="button" onClick={onBack}>
          <i className="bi bi-pencil" aria-hidden="true" /> Editar perfil
        </button>
        <span className="lobby-status"><i className="bi bi-wifi" aria-hidden="true" /> Lobby local</span>
      </header>

      <section className="lobby-layout" aria-labelledby="lobby-title">
        <div className="lobby-heading">
          <div>
            <p className="session-eyebrow">Todo mundo junto</p>
            <h1 id="lobby-title">Sala <span>{roomCode}</span></h1>
            <p>Compartilhe o código e espere a galera chegar.</p>
          </div>
          <button className="copy-code" type="button" onClick={copyRoomCode}>
            <span>{roomCode}</span>
            <i className="bi bi-copy" aria-hidden="true" /> Copiar
          </button>
        </div>

        <div className="lobby-content">
          <section className="players-board" aria-labelledby="players-title">
            <div className="board-heading">
              <h2 id="players-title">Jogadores</h2>
              <span>1/8</span>
            </div>
            <div className="players-grid">
              <article className="player-card is-ready">
                <PlayerAvatar avatarId={player.avatarId} />
                <div>
                  <strong>{player.username}</strong>
                  <span>{isHost ? 'Host da sala' : 'Pronto para jogar'}</span>
                </div>
                <i className="bi bi-check-circle-fill" aria-label="Pronto" />
              </article>
              {[1, 2, 3].map((slot) => (
                <article className="player-card is-empty" key={slot}>
                  <span className="empty-avatar"><i className="bi bi-person" aria-hidden="true" /></span>
                  <div>
                    <strong>Espaço livre</strong>
                    <span>Aguardando alguém…</span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <aside className="rules-note">
            <span className="card-tape" aria-hidden="true" />
            <p className="session-eyebrow">Regras da rodada</p>
            <h2>Clássico</h2>
            <ul>
              <li><i className="bi bi-arrow-repeat" aria-hidden="true" /><span><strong>3</strong> rodadas</span></li>
              <li><i className="bi bi-stopwatch" aria-hidden="true" /><span><strong>4 min</strong> para editar</span></li>
              <li><i className="bi bi-hand-thumbs-up" aria-hidden="true" /><span><strong>1 voto</strong> por pessoa</span></li>
              <li><i className="bi bi-eye-slash" aria-hidden="true" /><span>Autoria secreta</span></li>
            </ul>
            {isHost ? (
              <button className="session-primary" type="button" onClick={onStart}>
                Iniciar partida <i className="bi bi-play-fill" aria-hidden="true" />
              </button>
            ) : (
              <button className="session-primary is-ready" type="button" disabled>
                <i className="bi bi-check-lg" aria-hidden="true" /> Você está pronto
              </button>
            )}
            <p className="host-note">
              {isHost ? 'Você controla o início da partida.' : 'Aguardando o host iniciar.'}
            </p>
          </aside>
        </div>
      </section>
    </main>
  )
}

export default LobbyScreen
