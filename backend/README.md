# Backend — Thumbs da Galerinha

Infraestrutura do Firebase usada pelo multiplayer do jogo.

## Firestore

- `firestore.rules`: regras de acesso para salas, jogadores e reserva de usernames.
- `firestore.indexes.json`: índices compostos do projeto; nenhum é necessário nesta etapa.
- `../firebase.json`: aponta o Firebase CLI para estes arquivos.

As regras garantem que:

- apenas usuários autenticados tecnicamente podem acessar uma sala conhecida;
- códigos de sala não podem ser listados publicamente;
- cada sala comporta no máximo 8 jogadores;
- cada jogador altera somente o próprio perfil;
- usernames são reservados por sala e não podem ser tomados por outro jogador;
- somente o host pode iniciar a partida;
- antes da edição, cada jogador envia uma imagem-base e vota em uma candidata válida;
- somente o host avança as etapas e a imagem enviada ao editor deve corresponder a uma candidata da sala;
- cada jogador envia somente a própria thumb, em WebP e com até 900.000 caracteres;
- somente membros da sala podem ler as imagens daquela partida;
- documentos de sala não podem ser apagados pelo cliente.

## Publicação

Na raiz do repositório, associe o projeto correto e publique as regras:

```bash
npx firebase-tools login
npx firebase-tools use --add
npx firebase-tools deploy --only firestore:rules
```

As thumbs compactadas ficam no próprio documento de submissão do Firestore. Essa
estratégia mantém o MVP no plano gratuito sem depender do Firebase Storage.

Não use regras abertas (`allow read, write: if true`) em produção.

## Testes locais

O emulador exige Node.js 16+ e Java JDK 11+.

```bash
npm install
npm test
```

Os testes usam o Emulator Suite e nunca acessam o projeto Firebase de produção.

As funcionalidades desta pasta devem ser desenvolvidas na branch `backend`.
