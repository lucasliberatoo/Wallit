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
A UI chama hooks → repositórios (`src/data/repositories.ts`). Hoje a implementação é o mock em memória (`src/data/mock`), com latência simulada, auditoria e as mesmas validações que a API terá. Trocar para o backend real = nova implementação HTTP escolhida em `src/data/index.ts`, sem mexer nas telas.

## Próxima etapa: backend
API Hono + Drizzle + Better Auth em Vercel Functions, Postgres no Neon (planos gratuitos). Regras críticas também no banco (CHECKs, UNIQUE por parcela, transações para compra + divisão e pagamentos) e isolamento entre famílias em toda consulta. Versão web publicada na Vercel e APK via EAS Build.

## Segurança
Nunca armazenamos número do cartão, CVV ou senha do cartão. Exclusões são soft delete e alterações relevantes ficam no log de auditoria.
