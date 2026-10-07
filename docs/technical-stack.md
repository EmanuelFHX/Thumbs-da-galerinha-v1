# Decisões técnicas — v0.1

Atualizado em: 2026-10-06

## Confirmado

| Área | Decisão |
| --- | --- |
| Plataforma | Aplicação web executada no navegador |
| Linguagem | JavaScript |
| Frontend | React com JavaScript |
| Build e desenvolvimento | Vite |
| Canvas do editor | Konva com integração `react-konva` |
| Backend | Ecossistema JavaScript, com Node.js como runtime planejado |
| Organização Git | Trabalho de frontend na branch `frontend`; backend na branch `backend` |

## Princípios

- Manter uma única linguagem entre cliente e servidor.
- Preferir módulos ES (`import`/`export`).
- Não exigir instalação no computador do jogador.
- Preservar o estado da edição no navegador durante a rodada.
- Exportar a composição final em um formato de imagem amplamente suportado.
- Preparar a arquitetura para comunicação em tempo real sem introduzi-la no MVP local.

## Decisões ainda abertas

- Framework HTTP do backend.
- Tecnologia de comunicação em tempo real.
- Banco de dados e armazenamento das imagens.
- Estratégia de testes.

Essas escolhas devem ser feitas por necessidade do produto, sem adicionar dependências
antes de existir uma funcionalidade que as justifique.
