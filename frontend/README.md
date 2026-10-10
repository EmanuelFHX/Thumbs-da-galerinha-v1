# Frontend — Thumbs da Galerinha

Aplicação web do jogo, construída com React, JavaScript, Vite, Konva, Firebase e Bootstrap Icons.

## Comandos

```bash
npm install
npm run dev
npm run lint
npm run build
```

## Estrutura atual

- `src/GameApp.jsx`: tela inicial e comportamento do formulário de sala.
- `src/game.css`: identidade Cartoon Doodle e layout responsivo.
- `src/components/EditorScreen.jsx`: canvas interativo e histórico de edição.
- `src/components/editor.css`: estrutura visual do editor.
- `src/lib/roomService.js`: criação, entrada e sincronização das salas online.
- `src/lib/firebase.js`: inicialização opcional do Firebase por variáveis de ambiente.
- `public/favicon-game.svg`: ícone inicial do projeto.
- `public/sample-base.svg`: imagem-base local usada no protótipo.

## Editor implementado

- Texto com presets, fontes, peso, alinhamento, espaçamento, contorno e sombra.
- Retângulo e círculo com seleção e transformação.
- Pincel com predefinições, cor, espessura, opacidade e suavidade.
- Borracha não destrutiva e conta-gotas para capturar cores do canvas.
- Importação local de PNG, JPEG e WebP de até 8 MB.
- Stickers próprios em SVG.
- Painel de camadas com ordem, visibilidade, bloqueio, duplicação e opacidade.
- Ajustes não destrutivos de brilho, contraste, saturação, desfoque e preto e branco.
- Zoom, ajuste à tela, pan com Espaço e encaixe no centro/bordas.
- Alinhamento, flip horizontal/vertical e recorte central por proporção.
- Redimensionamento do documento com presets, proporção bloqueável e escala opcional do conteúdo.
- Recorte livre de imagens com prévia ao vivo, aplicar e cancelar.
- Rascunho automático no IndexedDB, restauração da sessão e proteção de saída.
- Exclusão, desfazer, refazer e exportação PNG.

## Multiplayer

O lobby suporta até 8 jogadores. Quando o Firebase está configurado, criação de sala,
entrada por código, usernames exclusivos e início da partida são sincronizados pelo
Cloud Firestore. Sem configuração, o frontend mantém o modo local para desenvolvimento.

1. Crie um projeto e um aplicativo web no Firebase.
2. Ative o provedor anônimo em **Authentication → Sign-in method**.
3. Crie um banco Cloud Firestore.
4. Copie `.env.example` para `.env.local` e preencha as variáveis do aplicativo web.
5. Configure regras restritivas do Firestore antes de disponibilizar o jogo publicamente.

As regras e o deploy da infraestrutura devem ser trabalhados na branch `backend`.

## Deploy na Vercel

O frontend está preparado para ser publicado como uma SPA do Vite. Ao importar o
repositório na Vercel, use estas configurações:

- **Production Branch:** `frontend`
- **Root Directory:** `frontend`
- **Framework Preset:** Vite
- **Build Command:** `npm run build` (detectado pelo `vercel.json`)
- **Output Directory:** `dist` (detectado pelo `vercel.json`)

Cadastre em **Settings → Environment Variables**, para `Production` e `Preview`,
as seis variáveis listadas em `.env.example`. Copie os valores de `.env.local`
sem publicar esse arquivo no Git. O build da Vercel é interrompido com uma lista
objetiva caso alguma variável esteja ausente.

Depois que a Vercel gerar o domínio de produção, abra o Firebase Console e adicione
somente o hostname, sem `https://`, em **Authentication → Settings → Authorized
domains**. Repita o processo ao adicionar um domínio próprio. Se a API key do
Firebase possuir restrições por referenciador no Google Cloud, inclua também os
domínios da Vercel e o domínio próprio nessas restrições.

O `vercel.json` mantém URLs internas da SPA funcionando após recarregar a página.
O backend continua no Firebase; nenhuma função de servidor é publicada na Vercel.

## Atalhos

- `Ctrl+Z`: desfazer.
- `Ctrl+Shift+Z`: refazer.
- `Ctrl+D`: duplicar a camada selecionada.
- `Ctrl+0`: ajustar o canvas à tela.
- `Ctrl++` / `Ctrl+-`: controlar o zoom.
- `Delete` ou `Backspace`: excluir a seleção.
- `Espaço` + arrastar: mover a visualização.
- `B`: selecionar o pincel.
- `E`: selecionar a borracha.
- `I`: selecionar o conta-gotas.

As funcionalidades desta pasta devem ser desenvolvidas na branch `frontend`.
