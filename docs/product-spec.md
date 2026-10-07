# Especificação do produto — v0.1

Atualizado em: 2026-10-07

> As regras abaixo são propostas para o primeiro protótipo. Elas devem ser
> validadas em partidas locais antes de orientar o multiplayer.

## Visão

**Thumbs da Galerinha** é um party game competitivo em que todos recebem a mesma
imagem-base e um desafio. Os jogadores editam a imagem dentro de um limite de
tempo; as criações são exibidas anonimamente e votadas pelo grupo.

O jogo deve recompensar ideias engraçadas e criativas, mesmo quando o jogador não
domina ferramentas profissionais de edição.

## Pilares

1. **Criar rapidamente:** entrar no editor e produzir algo reconhecível em poucos minutos.
2. **Rir em grupo:** galeria, votação e revelação são parte central da experiência.
3. **Competir sem pressão:** controles acessíveis e pontuação fácil de entender.
4. **Ser imprevisível:** imagens e desafios devem gerar resultados bem diferentes.

## Público e plataforma inicial

- Grupos de amigos e criadores de conteúdo.
- Partidas curtas, casuais e rejogáveis.
- Aplicação web executada diretamente no navegador.
- Navegador desktop como primeiro alvo de experiência e testes.
- Layout responsivo preparado para telas menores, sem prometer editor mobile no MVP.
- Sem contas: cada jogador escolhe uma identidade temporária ao entrar na sala.

## Identidade temporária do jogador

- Criar ou entrar em uma sala abre a etapa de escolha de identidade antes do lobby.
- O jogador informa um username visível apenas naquela sala.
- O jogador escolhe um avatar em uma coleção própria e pré-definida pelo jogo.
- Não há email, senha, perfil global, histórico público ou cadastro obrigatório.
- Username e avatar permanecem associados ao jogador durante a partida e a reconexão.
- Um identificador técnico aleatório é salvo no navegador para permitir reconexão à mesma sala.
- A identidade expira quando a sala é encerrada ou removida por inatividade.
- Usernames devem ter de 2 a 18 caracteres e ser únicos dentro da sala, ignorando maiúsculas e minúsculas.
- Upload de avatar personalizado fica fora do MVP para evitar moderação e armazenamento desnecessários.

## Diretriz técnica confirmada

- JavaScript é a linguagem principal do projeto.
- O frontend deve usar APIs e tecnologias compatíveis com navegadores modernos.
- O backend também seguirá o ecossistema JavaScript, com Node.js como runtime planejado.
- A escolha de framework, biblioteca de canvas e protocolo de tempo real será feita
  separadamente, antes da implementação de cada camada.

## Configuração padrão da partida

| Regra | Proposta inicial |
| --- | --- |
| Jogadores | 3 a 8 |
| Rodadas | 3 |
| Tempo de edição | 4 minutos |
| Tempo de votação | 25 segundos por galeria |
| Votos | 1 voto por jogador em cada rodada |
| Voto próprio | Bloqueado |
| Autoria | Oculta até a revelação |
| Vitória da rodada | Maior número de votos |
| Vitória da partida | Maior soma de votos após todas as rodadas |

Em caso de empate, os jogadores empatados compartilham a colocação no protótipo.
Um sistema de desempate será escolhido após os primeiros testes para evitar uma
regra arbitrária antes de entendermos o ritmo real das partidas.

## Ciclo principal

1. O host cria a partida e escolhe username e avatar.
2. Os demais jogadores informam o código, escolhem username e avatar e entram no lobby.
3. Jogadores confirmam que estão prontos.
4. O jogo sorteia uma imagem-base e um desafio.
5. Todos editam durante o mesmo intervalo.
6. O tempo acaba e as edições são enviadas automaticamente.
7. A galeria apresenta os trabalhos sem revelar os autores.
8. Cada jogador vota em um trabalho que não seja o próprio.
9. O jogo revela votos, autores e vencedor da rodada.
10. Após a última rodada, o placar final é apresentado.

## Escopo do protótipo local

O modo local deve permitir validar o ciclo inteiro em um computador. Os jogadores
editam em turnos; cada envio é ocultado antes de entregar o controle ao próximo
jogador. A votação também acontece individualmente, com as escolhas escondidas.

O protótipo local não exige:

- autenticação;
- banco de dados remoto;
- chat;
- matchmaking;
- sistema de denúncias;
- progressão ou itens cosméticos.

## Editor mínimo

- Exibir a imagem-base na área de trabalho.
- Adicionar e editar texto.
- Mover, redimensionar e rotacionar elementos.
- Desenhar com pincel, cor e espessura ajustáveis.
- Adicionar formas e stickers.
- Importar uma imagem local.
- Selecionar e excluir elementos.
- Desfazer e refazer ações.
- Exportar uma composição final achatada.
- Mostrar cronômetro e estado de envio.

## Regras de experiência

- O usuário deve conseguir produzir algo sem abrir um tutorial longo.
- O canvas é sempre o elemento dominante no editor.
- Ações destrutivas devem permitir desfazer.
- O fim do tempo nunca pode perder silenciosamente uma criação.
- A galeria não revela nomes, avatares ou ordem de envio antes do voto.
- O placar deve explicar de onde vieram os pontos.

## Critérios do primeiro marco

O MVP do editor está pronto quando uma pessoa consegue abrir uma imagem-base,
combinar texto, desenho, formas, stickers e imagens importadas, desfazer operações
e exportar o resultado sem sair da aplicação.

## Questões para os primeiros testes

- Quatro minutos são suficientes para criar algo divertido?
- Um voto por pessoa gera empates demais?
- O editor oferece liberdade sem parecer complexo?
- A revelação deve mostrar todos os autores de uma vez ou um por um?
- Quantos trabalhos cabem por tela sem reduzir demais as imagens?
