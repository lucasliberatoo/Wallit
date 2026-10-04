# Arquitetura e decisões

## Dinheiro
Todo valor é **inteiro em centavos**. Divisões usam o método do maior resto, então a soma sempre fecha (R$ 100 / 3 = 33,34 + 33,33 + 33,33). Em parcelamentos, os centavos que sobram vão para a primeira parcela.

## Divisão de compras
- A soma das responsabilidades precisa ser exatamente o valor da compra (`validateSplit`: completa, faltando, excedente ou inválida). Salvar fica bloqueado até fechar.
- "Quem comprou" é independente de "quem paga".
- Em compras parceladas, a divisão é distribuída por parcela proporcionalmente, mantendo exatas as somas por parcela e por pessoa.

## Faturas
- A referência da fatura é o **mês de fechamento**. Compra feita no dia de fechamento ou depois entra na fatura seguinte; o dia de fechamento é limitado ao tamanho do mês.
- Cada parcela é uma entidade própria, atribuída a faturas consecutivas (criadas automaticamente).
- Fluxo: aberta → em conferência → fechada → recebendo → paga → arquivada. A partir de "fechada", só titular/owner alteram compras.
- A parte do próprio titular do cartão tem status "titular" (nunca fica pendente).
- Pagamento parcial é permitido; pagamento acima do devido é rejeitado.

## Camada de dados
A UI chama hooks → repositórios (`src/data/repositories.ts`). As regras de negócio dos repositórios ficam em `src/data/core` e operam sobre um `Store` (um retrato em memória dos dados). Existem dois backends:

- **Offline** (`src/data/mock`): o `Store` é salvo no aparelho. Usado em desenvolvimento e quando não há `EXPO_PUBLIC_API_URL`.
- **API** (`src/data/http`): cada método vira `POST /api/rpc { method, args }`. Login e cadastro passam pelo Better Auth (`/api/auth/*`), com token bearer guardado no aparelho.

## Servidor (Vercel Functions + Neon)
- `api/index.ts` expõe o app Hono (`server/app.ts`). Funções na região de São Paulo (`gru1`); o banco Neon deve ficar em São Paulo também.
- Cada chamada roda numa transação (`server/operations.ts`): carrega só as famílias de que a pessoa é membro ativo, trava essas famílias (`SELECT … FOR UPDATE`) se for escrita, executa a mesma regra do `core` e grava a diferença (`server/unit-of-work.ts`). Família de outra pessoa nunca é carregada, então não dá para ler nem alterar.
- Só os métodos listados em `OPERATIONS` podem ser chamados.
- O banco também protege as regras de dinheiro: CHECKs (valores > 0, dia de fechamento 1–31, até 48 parcelas), parcela única por compra e número, fatura única por cartão e mês, e um gatilho adiado que recusa no commit qualquer compra cuja divisão ou parcelas não somem o total (`server/db/migrations/0001_money_rules.sql`).
- Pagamento acima do devido e alteração em fatura fechada são barrados pela regra do `core`, dentro da mesma transação.
- Migrações e a demo (Família Silva, conta `lucas@wallit.app`) são aplicadas a cada deploy.
- Quando o volume crescer, as operações mais usadas podem virar consultas diretas sem mudar o app, porque o contrato continua sendo o dos repositórios.

## Ainda falta
- Envio de email (recuperação de senha): o pedido é aceito, mas o email ainda não é enviado.
- Token guardado com AsyncStorage; no app nativo, trocar por armazenamento seguro.

## Segurança
Nunca armazenamos número do cartão, CVV ou senha do cartão. Exclusões são soft delete e alterações relevantes ficam no log de auditoria.
