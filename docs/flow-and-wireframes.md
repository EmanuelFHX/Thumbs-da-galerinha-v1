# Fluxo e wireframes — v0.1

Atualizado em: 2026-10-07

Os wireframes abaixo representam hierarquia e comportamento, não acabamento visual.

## Mapa do fluxo

```text
Menu
├── Criar sala ──> Configuração ──> Identidade ──> Lobby
└── Entrar com código ────────────> Identidade ──> Lobby
                                                    │
                                                    v
              Desafio ──> Editor ──> Envio
                 ^                       │
                 │                       v
            Próxima rodada <── Resultado <── Votação <── Galeria
                 │
                 └── após a última rodada ──> Placar final ──> Lobby/Menu
```

## 1. Menu

```text
┌──────────────────────────────────────────────────────────┐
│               THUMBS DA GALERINHA                        │
│            [ ilustração/mascote do jogo ]                │
│                                                          │
│                 [ CRIAR PARTIDA ]                        │
│                 [ ENTRAR COM CÓDIGO ]                    │
│                                                          │
│              Como jogar       Som       ⚙               │
└──────────────────────────────────────────────────────────┘
```

Objetivo: apresentar imediatamente as duas ações principais. Não usar uma landing
page longa antes do jogo.

## 2. Identidade da sala

```text
┌──────────────────────────────────────────────────────────┐
│                   QUEM É VOCÊ?                           │
│                                                          │
│ Username                                                 │
│ [ Galerinha123________________ ]                         │
│                                                          │
│ Escolha seu avatar                                       │
│ [ 🙂 ] [ 🤠 ] [ 👽 ] [ 🤖 ] [ 👻 ] [ 🐸 ]              │
│                                                          │
│                         [ ENTRAR NA SALA ]                │
└──────────────────────────────────────────────────────────┘
```

A identidade vale somente para a sala atual. Não pedir email, senha ou criação de
conta. O botão só é liberado com username válido e avatar selecionado.

## 3. Lobby

```text
┌──────────────────────────────────────────────────────────┐
│ Sala ABC123                              3/8 jogadores   │
│ Compartilhe: [ ABC123 ] [ copiar ]                        │
│                                                          │
│ [Avatar Ana ✓] [Avatar Beto ✓] [Avatar Caio ...]         │
│                                                          │
│ Regras: 3 rodadas · 4 min · Clássico                     │
│                                                          │
│ [ configurações ]                  [ INICIAR PARTIDA ]    │
└──────────────────────────────────────────────────────────┘
```

O botão de iniciar pertence ao host. Os demais jogadores veem seu estado de pronto.

## 4. Apresentação do desafio

```text
┌──────────────────────────────────────────────────────────┐
│                       RODADA 1/3                         │
│                                                          │
│                  [ imagem-base grande ]                  │
│                                                          │
│        "Transforme isso no pior anúncio possível"       │
│                                                          │
│                     Começa em 3…                         │
└──────────────────────────────────────────────────────────┘
```

A tela é curta e igual para todos. O texto do desafio permanece acessível no editor.

## 5. Editor

```text
┌──────────────────────────────────────────────────────────┐
│ Rodada 1/3  Desafio resumido                  03:42      │
├──────────┬──────────────────────────────┬────────────────┤
│ Seleção  │                              │ Propriedades   │
│ Texto    │           CANVAS             │ do elemento    │
│ Pincel   │                              │ selecionado     │
│ Formas   │                              │                │
│ Stickers │                              │                │
│ Imagem   │                              │                │
├──────────┴──────────────────────────────┴────────────────┤
│ [desfazer] [refazer] [zoom]              [ ENVIAR ✓ ]    │
└──────────────────────────────────────────────────────────┘
```

O canvas domina a tela. Ferramentas avançadas aparecem apenas quando relevantes.
O botão de envio confirma a ação; quando o tempo acaba, o estado atual é salvo.

## 6. Galeria e votação

```text
┌──────────────────────────────────────────────────────────┐
│                 ESCOLHA A MELHOR                         │
│              Ninguém pode votar em si                   │
│                                                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐         │
│  │ trabalho A  │ │ trabalho B  │ │ trabalho C  │         │
│  │ [ votar ]   │ │ [ votar ]   │ │ seu trabalho│         │
│  └─────────────┘ └─────────────┘ └─────────────┘         │
│                                                          │
│                    18 segundos                           │
└──────────────────────────────────────────────────────────┘
```

A ordem dos trabalhos é aleatória. Nome e avatar aparecem somente na revelação.

## 7. Revelação da rodada

```text
┌──────────────────────────────────────────────────────────┐
│                    E O VENCEDOR É…                       │
│                                                          │
│               [ trabalho vencedor grande ]              │
│                      feito por ANA                       │
│                       ♥ ♥ ♥ ♥  4 votos                   │
│                                                          │
│             [ ver todos ] [ PRÓXIMA RODADA ]             │
└──────────────────────────────────────────────────────────┘
```

A revelação pode acontecer em etapas: votos, autor e colocação. A animação deve ser
curta o bastante para continuar divertida após várias rodadas.

## 8. Placar final

```text
┌──────────────────────────────────────────────────────────┐
│                    CAMPEÃO DA GALERINHA                  │
│                         [ ANA ]                          │
│                                                          │
│  1. Ana   8 votos   2. Beto  6 votos   3. Caio  4 votos │
│                                                          │
│       [ rever galeria ] [ JOGAR DE NOVO ] [ menu ]       │
└──────────────────────────────────────────────────────────┘
```

## Estados obrigatórios futuros

Cada tela implementada deve considerar carregamento, vazio, erro, desconexão,
controle desabilitado, texto longo, foco por teclado e largura reduzida.

