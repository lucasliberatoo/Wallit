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

Conta de demonstração (dados da "Família Silva", gerados em memória): **lucas@wallit.app / wallit123**, ou o botão "Entrar com a conta demo" no login. Em Perfil dá para restaurar os dados de exemplo.

## Estrutura

```
src/
  app/            rotas (Expo Router): telas finas, só composição
  domain/         regras financeiras puras e testadas (dinheiro, divisão, parcelas, faturas, saldos, permissões)
  data/           interfaces de repositório + implementação mock (em memória, persistida localmente)
  features/       hooks (TanStack Query) e componentes por funcionalidade
  components/     design system (ui/, layout/, finance/, brand/)
  theme/          cores, gradientes, tokens, tipografia
  lib/ stores/ providers/ utils/
```

Decisões importantes estão em [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
