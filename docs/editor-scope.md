# Escopo do editor — núcleo inspirado no Photoshop

Atualizado em: 2026-10-07

O editor deve oferecer as ferramentas fundamentais de composição e tratamento de
imagem sem tentar reproduzir todo o Photoshop. A prioridade é permitir criações
rápidas durante uma rodada competitiva.

## Núcleo obrigatório

### Documento e navegação

- Canvas com imagem-base.
- Zoom, pan e ajuste à tela.
- Recorte e redimensionamento do documento.
- Guias simples e encaixe em centro/bordas.

### Camadas

- Selecionar, renomear e reordenar.
- Mostrar, ocultar, bloquear, duplicar e excluir.
- Ajustar opacidade.
- Modos de mesclagem essenciais.

### Transformação

- Mover, redimensionar e rotacionar.
- Virar horizontal e verticalmente.
- Manter proporção quando necessário.

### Conteúdo

- Importar PNG, JPEG e WebP.
- Texto com família, tamanho, peso, alinhamento, cor e contorno.
- Formas básicas e stickers.
- Pincel, borracha e conta-gotas.

### Ajustes e filtros

- Brilho, contraste e saturação.
- Desfoque e preto e branco.
- Matiz, temperatura e nitidez em uma etapa posterior.

### Segurança e saída

- Desfazer e refazer.
- Salvamento temporário no navegador durante a rodada.
- Exportação PNG/JPEG.
- Confirmação antes de abandonar alterações não enviadas.

## Implementado

- Imagem-base e importação local.
- Texto, formas e stickers.
- Seleção, movimento, escala e rotação.
- Zoom, ajuste à tela e pan temporário com a tecla Espaço.
- Encaixe em centro e bordas do canvas.
- Alinhamento, flip horizontal/vertical e recorte central por proporção.
- Pincel com predefinições, opacidade e suavidade.
- Borracha não destrutiva em camada própria e conta-gotas.
- Texto com fontes, peso, itálico, sublinhado, alinhamento, espaçamento, entrelinhas, contorno e sombra.
- Presets de texto Doodle, Meme e Pop.
- Camadas com ordem, visibilidade, bloqueio, duplicação, exclusão e opacidade.
- Brilho, contraste, saturação, desfoque e preto e branco por imagem.
- Desfazer, refazer e exportação PNG.

## Próximas entregas

1. Redimensionamento do documento e recorte manual livre.
2. Salvamento automático e restauração de sessão.
3. Testes automatizados das interações do editor.

## Fora do primeiro MVP

- Arquivos PSD.
- Smart Objects.
- Curvas e níveis profissionais.
- Canais, edição CMYK e gerenciamento de cor avançado.
- Seleção inteligente por IA.
- Plugins compatíveis com Photoshop.
