import { useState } from 'react'
import { AVATARS } from './avatarOptions.js'
import { PlayerAvatar } from './PlayerAvatar.jsx'
import './session.css'

function IdentityScreen({ initialUsername, isHost, onBack, onContinue, roomCode }) {
  const [selectedAvatar, setSelectedAvatar] = useState(initialUsername.avatarId ?? AVATARS[0].id)
  const [username, setUsername] = useState(initialUsername.username ?? '')

  function handleSubmit(event) {
    event.preventDefault()
    onContinue({
      avatarId: selectedAvatar,
      username: username.trim(),
    })
  }

  return (
    <main className="session-shell">
      <div className="session-noise" aria-hidden="true" />
      <header className="session-topbar">
        <button className="session-back" type="button" onClick={onBack}>
          <i className="bi bi-arrow-left" aria-hidden="true" /> Menu
        </button>
        <div className="room-chip">
          <span>Sala</span>
          <strong>{roomCode}</strong>
        </div>
      </header>

      <section className="identity-layout" aria-labelledby="identity-title">
        <div className="identity-intro">
          <span className="step-sticker">1 minuto, zero cadastro</span>
          <p className="session-eyebrow">Sua identidade nesta sala</p>
          <h1 id="identity-title">Quem é você<br />na galera?</h1>
          <p>
            Escolha um nome e uma carinha. Eles só existem durante esta partida.
          </p>
          <div className="identity-preview" aria-hidden="true">
            <PlayerAvatar avatarId={selectedAvatar} />
            <span>{username || 'Seu nome aqui'}</span>
          </div>
        </div>

        <form className="identity-card" onSubmit={handleSubmit}>
          <span className="card-tape" aria-hidden="true" />
          <div className="identity-role">
            <i className={`bi ${isHost ? 'bi-crown-fill' : 'bi-controller'}`} aria-hidden="true" />
            {isHost ? 'Você será o host' : 'Você foi convidado'}
          </div>

          <label htmlFor="player-username">Username</label>
          <input
            id="player-username"
            name="username"
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            minLength="2"
            maxLength="18"
            placeholder="Ex.: MestreDoMeme"
            autoComplete="off"
            required
          />
          <span className="identity-help">De 2 a 18 caracteres. Vale somente nesta sala.</span>

          <fieldset className="avatar-picker">
            <legend>Escolha seu avatar</legend>
            <div className="avatar-grid">
              {AVATARS.map((avatar) => (
                <label key={avatar.id} title={avatar.label}>
                  <input
                    type="radio"
                    name="avatar"
                    value={avatar.id}
                    checked={avatar.id === selectedAvatar}
                    onChange={() => setSelectedAvatar(avatar.id)}
                  />
                  <PlayerAvatar avatarId={avatar.id} />
                  <span>{avatar.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <button className="session-primary" type="submit">
            Entrar na sala <i className="bi bi-arrow-right" aria-hidden="true" />
          </button>
        </form>
      </section>
    </main>
  )
}

export default IdentityScreen
