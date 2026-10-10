import { PlayerAvatar } from './PlayerAvatar.jsx'
import './session.css'

function MatchResultScreen({ onLeave, players, roomCode, scores, submissions = [], totalRounds }) {
  const ranking = [...players].sort((first, second) => {
    const scoreDifference = (scores[second.id] ?? 0) - (scores[first.id] ?? 0)
    return scoreDifference || first.username.localeCompare(second.username, 'pt-BR')
  })
  const highestScore = scores[ranking[0]?.id] ?? 0
  const champions = ranking.filter((player) => (scores[player.id] ?? 0) === highestScore)
  const hasTie = champions.length > 1
  const finalists = ranking.slice(0, 3).map((rankedPlayer, index) => ({
    artwork: submissions.find((submission) => submission.id === rankedPlayer.id)?.imageData,
    player: rankedPlayer,
    place: index + 1,
    score: scores[rankedPlayer.id] ?? 0,
  }))
  const podiumOrder = [finalists[1], finalists[0], finalists[2]].filter(Boolean)

  return (
    <main className="session-shell match-result-shell">
      <div className="session-noise" aria-hidden="true" />
      <div className="match-confetti" aria-hidden="true">
        {Array.from({ length: 18 }, (_, index) => <span key={index} />)}
      </div>

      <header className="session-topbar">
        <span className="room-chip"><span>Sala</span><strong>{roomCode}</strong></span>
        <span className="lobby-status is-online">
          <i className="bi bi-flag-fill" aria-hidden="true" /> Partida encerrada
        </span>
      </header>

      <section className="match-gallery-layout" aria-labelledby="match-result-title">
        <header className="match-gallery-heading">
          <p className="session-eyebrow">Exposição final · {totalRounds} {totalRounds === 1 ? 'rodada' : 'rodadas'}</p>
          <h1 id="match-result-title">Galeria dos campeões</h1>
          <span>
            {hasTie
              ? `Empate épico entre ${champions.map((champion) => champion.username).join(' e ')}!`
              : `${champions[0]?.username ?? 'A galera'} leva o grande troféu!`}
          </span>
        </header>

        <div className="champions-gallery-wall">
          <div className="gallery-ceiling-line" aria-hidden="true" />
          {podiumOrder.map((finalist) => (
            <article
              className={`gallery-finalist is-place-${finalist.place}`}
              key={finalist.player.id}
            >
              <div className="gallery-spotlight" aria-hidden="true" />
              <div className="gallery-art-frame">
                <span className="gallery-frame-hook" aria-hidden="true" />
                {finalist.artwork ? (
                  <img
                    src={finalist.artwork}
                    alt={`Thumb final de ${finalist.player.username}`}
                  />
                ) : (
                  <div className="gallery-art-placeholder">
                    <i className="bi bi-image" aria-hidden="true" />
                    <span>Obra em exposição</span>
                  </div>
                )}
                <span className="gallery-art-label">Obra de {finalist.player.username}</span>
              </div>

              <div className="podium-finalist-identity">
                {finalist.place === 1 && (
                  <i className="bi bi-crown-fill podium-crown" aria-hidden="true" />
                )}
                <PlayerAvatar avatarId={finalist.player.avatarId} />
                <strong>{finalist.player.username}</strong>
              </div>

              <div className="gallery-podium-step">
                <b>{finalist.place}º</b>
                <span>{finalist.score} {finalist.score === 1 ? 'ponto' : 'pontos'}</span>
              </div>
            </article>
          ))}
        </div>

        <footer className="match-gallery-footer">
          <ol className="gallery-full-ranking" aria-label="Classificação final completa">
            {ranking.map((rankedPlayer, index) => (
              <li className={index < 3 ? 'is-top-three' : ''} key={rankedPlayer.id}>
                <span>{index + 1}º</span>
                <PlayerAvatar avatarId={rankedPlayer.avatarId} />
                <strong>{rankedPlayer.username}</strong>
                <b>{scores[rankedPlayer.id] ?? 0} pts</b>
              </li>
            ))}
          </ol>
          <button className="session-primary" type="button" onClick={onLeave}>
            Voltar ao menu <i className="bi bi-house-door-fill" aria-hidden="true" />
          </button>
        </footer>
      </section>
    </main>
  )
}

export default MatchResultScreen
