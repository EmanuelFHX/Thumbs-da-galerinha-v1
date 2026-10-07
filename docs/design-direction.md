# Direção visual — Cartoon Doodle / Hand-Drawn UI

Atualizado em: 2026-10-06

## Conceito

A interface deve parecer um caderno coletivo transformado em game show: rabiscos,
adesivos, recortes, marcadores e pequenas imperfeições criam personalidade, enquanto
uma grade sólida mantém o jogo fácil de usar.

A palavra-chave é **bagunça criativa controlada**.

## Personalidade

- Divertida, irreverente e social.
- Artesanal, sem parecer infantil demais.
- Energética durante criação e revelação.
- Clara e silenciosa quando o jogador precisa editar com precisão.

## Sistema visual inicial

### Cores

| Papel | Uso | Cor inicial |
| --- | --- | --- |
| Papel quente | Fundo principal | `#FFF7E8` |
| Tinta | Texto e contornos | `#25232B` |
| Rosa | Ação principal e celebração | `#FF5C7A` |
| Amarelo | Atenção e cronômetro | `#FFD447` |
| Azul | Informação e seleção | `#49A8FF` |
| Verde | Sucesso e jogador pronto | `#54D68C` |
| Roxo | Eventos especiais | `#9B6BFF` |

A paleta é um ponto de partida. Contraste e legibilidade têm prioridade sobre a
fidelidade a qualquer cor específica.

### Tipografia

- **Display:** letras expressivas, arredondadas e com sensação manual para títulos.
- **Interface:** família arredondada e altamente legível para botões, campos e placar.
- **Números:** largura estável no cronômetro e na pontuação para evitar saltos visuais.
- Caixa alta apenas em rótulos curtos e momentos de celebração.

### Formas e linhas

- Contornos escuros com aproximadamente 2–3 px.
- Cantos moderados e levemente irregulares, sem transformar tudo em cápsulas.
- Sombras chapadas e deslocadas, como impressão fora de registro.
- Substituir divisores genéricos por traços ou recortes somente quando não prejudicar alinhamento.
- Elementos decorativos nunca devem competir com o canvas ou bloquear conteúdo.

### Ícones e ilustrações

- Ícones simples, reconhecíveis e consistentes no mesmo peso de linha.
- Variações desenhadas à mão podem ser usadas como assets próprios, preservando a
  silhueta familiar de ferramentas como texto, pincel, apagar, desfazer e refazer.
- Stickers devem parecer parte do universo do jogo, não um conjunto genérico de emojis.

## Componentes

- **Botões:** contorno forte, sombra curta, estado pressionado com deslocamento real.
- **Campos:** aparência de etiqueta colada, foco muito evidente e texto sem inclinação.
- **Cards:** usados apenas para jogadores, trabalhos e escolhas repetidas.
- **Modais:** folha sobreposta com fita, clipe ou dobra como detalhe secundário.
- **Toast:** bilhete curto que entra e sai rapidamente sem cobrir o editor.
- **Cronômetro:** calmo no início; pulsa e muda de cor apenas nos segundos finais.

## Movimento e som

- Entradas rápidas com pequeno overshoot, sem quicar continuamente.
- Hover pode inclinar ou deslocar 1–2 px, mantendo o tamanho do elemento estável.
- Confete, carimbos e rabiscos animados ficam reservados para votos e resultados.
- Reduzir movimento quando o sistema operacional solicitar.
- Sons curtos confirmam entrada, voto e fim do tempo; nenhuma ação comum precisa de som longo.

## Acessibilidade

- Nunca comunicar estado somente por cor.
- Foco de teclado sempre visível.
- Áreas clicáveis confortáveis e rótulos para todos os ícones essenciais.
- Textura de fundo com contraste baixo para não prejudicar a leitura.
- Animações decorativas não podem atrasar ações ou impedir navegação.

## Evitar

- Aparência de dashboard corporativo.
- Gradientes genéricos como principal identidade.
- Fontes manuscritas em textos longos.
- Aleatoriedade que desalinhe controles ou reduza precisão.
- Excesso de stickers em todas as telas.
- Efeitos tridimensionais realistas ou acabamento metálico.
- Movimento constante durante a edição.

