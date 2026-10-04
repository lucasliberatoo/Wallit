# Wallit

Cartões compartilhados sem confusão: quem compra registra, quem deve acompanha, quem paga não precisa fazer contas.

Wallit organiza um cartão de crédito usado por várias pessoas: famílias → carteiras → cartões → faturas → compras → divisão entre responsáveis, com parcelamento, pagamentos parciais e histórico.

## Rodando

```bash
npm install
npm start          # Expo (Android, iOS ou web)
npm run web        # direto no navegador
npm run check      # typecheck + lint + testes
npm run build:web  # exporta a versão web (SPA) para dist/
```

Sem configuração, o app usa um backend offline com dados de exemplo guardados no aparelho. Com `EXPO_PUBLIC_API_URL` definido, usa a API real.

Conta de demonstração (dados da "Família Silva", gerados em memória): **lucas@wallit.app / wallit123**, ou o botão "Entrar com a conta demo" no login. Em Perfil dá para restaurar os dados de exemplo.

## API (Vercel + Neon)

```bash
export DATABASE_URL=postgres://...   # Postgres local ou Neon
npm run db:migrate                   # aplica as migrações
npm run db:seed                      # cria a Família Silva (só se ainda não existir)
npm run api:dev                      # http://localhost:3000/api
EXPO_PUBLIC_API_URL=http://localhost:3000/api npm run web

TEST_DATABASE_URL=postgres://.../wallit_test npm run test:api   # testes de ponta a ponta
```

Na Vercel, o build (`scripts/vercel-build.sh`) aplica as migrações, cria a demo e publica a versão web já apontando para `/api` sempre que houver um banco conectado.

## Estrutura

```
src/
  app/            rotas (Expo Router): telas finas, só composição
  domain/         regras financeiras puras e testadas (dinheiro, divisão, parcelas, faturas, saldos, permissões)
  data/
    core/         regras de negócio dos repositórios, compartilhadas por app offline e servidor
    mock/         backend offline (core + armazenamento no aparelho)
    http/         backend real: chama a API
server/           API: Hono + Better Auth + Drizzle (esquema, migrações, unit of work)
api/              entrada da Vercel Function
  features/       hooks (TanStack Query) e componentes por funcionalidade
  components/     design system (ui/, layout/, finance/, brand/)
  theme/          cores, gradientes, tokens, tipografia
  lib/ stores/ providers/ utils/
```

Decisões importantes estão em [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
