import { PlayerAvatar } from './PlayerAvatar.jsx'
import { MAX_ROOM_PLAYERS } from '../lib/roomConstants.js'
import {
  EDIT_DURATION_OPTIONS,
  formatEditDuration,
  getMode,
  ROOM_MODES,
  ROUND_OPTIONS,
  VOTE_OPTIONS,
} from '../lib/roomSettings.js'
import './session.css'

function ChoiceRow({ formatOption, label, onChange, options, value }) {
  return (
    <div className="rule-selector" role="group" aria-label={label}>
      <span>{label}</span>
      <div>
        {options.map((option) => (
          <button
            className={value === option ? 'is-selected' : ''}
            type="button"
            key={option}
            aria-pressed={value === option}
            onClick={() => onChange(option)}
          >
            {formatOption(option)}
          </button>
        ))}
      </div>
    </div>
  )
}

function LobbyScreen({
  connectionError,
  isHost,
  isOnline,
  isSavingSettings,
  isStarting,
  onBack,
  onSettingsChange,
  onStart,
  player,
  players,
  roomCode,
  settings,
}) {
  const roomPlayers = players.length ? players : [{ ...player, isHost }]
  const activePlayerCount = roomPlayers.filter((roomPlayer) => roomPlayer.isActive !== false).length
  const emptySlots = Math.max(0, MAX_ROOM_PLAYERS - roomPlayers.length)
  const selectedMode = getMode(settings.mode)

  function changeSetting(key, value) {
    onSettingsChange({ ...settings, [key]: value })
  }

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
        <span className={`lobby-status ${isOnline ? 'is-online' : ''}`}>
          <i className={`bi ${isOnline ? 'bi-wifi' : 'bi-laptop'}`} aria-hidden="true" />
          {isOnline ? 'Lobby online' : 'Modo local'}
        </span>
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
              <span>{activePlayerCount} online · {roomPlayers.length}/{MAX_ROOM_PLAYERS}</span>
            </div>
            <div className="players-grid">
              {roomPlayers.map((roomPlayer) => (
                <article
                  className={`player-card ${roomPlayer.isActive === false ? 'is-away' : 'is-ready'}`}
                  key={roomPlayer.id ?? roomPlayer.username}
                >
                  <PlayerAvatar avatarId={roomPlayer.avatarId} />
                  <div>
                    <strong>{roomPlayer.username}</strong>
                    <span>
                      {roomPlayer.isActive === false
                        ? 'Reconectando…'
                        : roomPlayer.isHost
                          ? 'Host da sala'
                          : 'Pronto para jogar'}
                    </span>
                  </div>
                  <i
                    className={`bi ${roomPlayer.isActive === false ? 'bi-wifi-off' : 'bi-check-circle-fill'}`}
                    aria-label={roomPlayer.isActive === false ? 'Desconectado' : 'Pronto'}
                  />
                </article>
              ))}
              {Array.from({ length: emptySlots }, (_, index) => index + 1).map((slot) => (
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
            <p className="session-eyebrow">Regras da partida</p>
            <div className="rules-title-row">
              <h2>{selectedMode.label}</h2>
              <span className="rules-edit-state">
                <i className={`bi ${isHost ? 'bi-sliders' : 'bi-lock-fill'}`} aria-hidden="true" />
                {isHost ? (isSavingSettings ? 'Salvando…' : 'Você edita') : 'Host edita'}
              </span>
            </div>
            <p className="mode-description">{selectedMode.description}</p>

            <fieldset className="room-settings" disabled={!isHost || isSavingSettings}>
              <legend className="sr-only">Configurações da partida</legend>

              <div className="mode-selector" aria-label="Modo de jogo">
                {ROOM_MODES.map((mode) => (
                  <button
                    className={settings.mode === mode.value ? 'is-selected' : ''}
                    type="button"
                    key={mode.value}
                    aria-label={`${mode.label}: ${mode.description}`}
                    aria-pressed={settings.mode === mode.value}
                    onClick={() => changeSetting('mode', mode.value)}
                  >
                    <i className={`bi ${mode.icon}`} aria-hidden="true" />
                    <span>{mode.label}</span>
                  </button>
                ))}
              </div>

              <ChoiceRow
                label="Rodadas"
                options={ROUND_OPTIONS}
                value={settings.rounds}
                formatOption={(option) => option}
                onChange={(value) => changeSetting('rounds', value)}
              />
              <ChoiceRow
                label="Tempo para editar"
                options={EDIT_DURATION_OPTIONS}
                value={settings.editDurationSeconds}
                formatOption={formatEditDuration}
                onChange={(value) => changeSetting('editDurationSeconds', value)}
              />
              <ChoiceRow
                label="Votos por pessoa"
                options={VOTE_OPTIONS}
                value={settings.votesPerPlayer}
                formatOption={(option) => option}
                onChange={(value) => changeSetting('votesPerPlayer', value)}
              />
            </fieldset>

            <p className="secret-author-note">
              <i className="bi bi-eye-slash" aria-hidden="true" /> Autoria secreta durante a votação
            </p>
            {connectionError && (
              <p className="session-error" role="alert">
                <i className="bi bi-exclamation-triangle-fill" aria-hidden="true" /> {connectionError}
              </p>
            )}
            {isHost ? (
              <button className="session-primary" type="button" onClick={onStart} disabled={isStarting}>
                {isStarting ? 'Iniciando…' : 'Iniciar partida'} <i className="bi bi-play-fill" aria-hidden="true" />
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
