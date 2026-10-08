# Decisões técnicas — v0.1

Atualizado em: 2026-10-07

## Confirmado

| Área | Decisão |
| --- | --- |
| Plataforma | Aplicação web executada no navegador |
| Linguagem | JavaScript |
| Frontend | React com JavaScript |
| Build e desenvolvimento | Vite |
| Canvas do editor | Konva com integração `react-konva` |
| Backend | Ecossistema JavaScript, com Node.js como runtime planejado |
| Identidade | Convidado temporário por sala, sem cadastro ou perfil global |
| Salas em tempo real | Firebase Authentication anônimo + Cloud Firestore |
| Organização Git | Trabalho de frontend na branch `frontend`; backend na branch `backend` |

## Princípios

- Manter uma única linguagem entre cliente e servidor.
- Preferir módulos ES (`import`/`export`).
- Não exigir instalação no computador do jogador.
- Preservar o estado da edição no navegador durante a rodada.
- Exportar a composição final em um formato de imagem amplamente suportado.
- Manter um fallback local quando o Firebase não estiver configurado.
- Manter username e avatar como dados efêmeros da sala.
- Usar identidade anônima do Firebase apenas como mecanismo técnico de sessão e reconexão, sem fluxo de conta para o jogador.

## Decisões ainda abertas

- Framework HTTP do backend.
- Estratégia de presença, desconexão e remoção de salas inativas.
- Armazenamento e entrega das imagens finalizadas.
- Estratégia de testes.

Essas escolhas devem ser feitas por necessidade do produto, sem adicionar dependências
antes de existir uma funcionalidade que as justifique.
