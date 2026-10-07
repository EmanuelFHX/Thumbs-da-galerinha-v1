# Frontend — Thumbs da Galerinha

Aplicação web do jogo, construída com React, JavaScript, Vite e Konva.

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
- `public/favicon-game.svg`: ícone inicial do projeto.
- `public/sample-base.svg`: imagem-base local usada no protótipo.

## Editor implementado

- Texto, retângulo e círculo com seleção e transformação.
- Pincel com ajuste de cor e espessura.
- Importação local de PNG, JPEG e WebP de até 8 MB.
- Stickers próprios em SVG.
- Painel de camadas com ordem, visibilidade, bloqueio, duplicação e opacidade.
- Ajustes não destrutivos de brilho, contraste, saturação, desfoque e preto e branco.
- Zoom, ajuste à tela, pan com Espaço e encaixe no centro/bordas.
- Alinhamento, flip horizontal/vertical e recorte central por proporção.
- Exclusão, desfazer, refazer e exportação PNG.

## Atalhos

- `Ctrl+Z`: desfazer.
- `Ctrl+Shift+Z`: refazer.
- `Ctrl+D`: duplicar a camada selecionada.
- `Ctrl+0`: ajustar o canvas à tela.
- `Ctrl++` / `Ctrl+-`: controlar o zoom.
- `Delete` ou `Backspace`: excluir a seleção.
- `Espaço` + arrastar: mover a visualização.

As funcionalidades desta pasta devem ser desenvolvidas na branch `frontend`.
