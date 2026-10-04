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
- Pagamento marcado por um membro fica **aguardando a titular** e só conta como recebido depois de confirmado (a titular também pode recusar). O que a titular registra já entra confirmado. Quem tem pagamento aguardando não consegue marcar de novo além do que falta.
- O primeiro pagamento de uma fatura fechada a coloca em "recebendo"; quando tudo foi confirmado, ela vira "paga" sozinha.
- Quando a titular não usa o app (ex.: a Avó), quem responde pelos pagamentos e contestações do cartão é o dono da família.

## Conferência e contestação
- "Iniciar conferência" (aberta → em conferência) avisa quem participa das compras da fatura.
- Cada compra é conferida por quem comprou e por quem paga (só quem tem conta). Cada pessoa confirma ou contesta (motivo + observação + anexo opcional). Responder de novo substitui a resposta anterior.
- A fatura não fecha com contestação em aberto: a titular responde cada uma. Ao fechar, cada pessoa recebe o valor da sua parte.
- Se a compra muda de valor, divisão ou comprador, as confirmações dela voltam a ficar pendentes.

## Notificações
- Criadas pelas mesmas regras do `core` (`src/data/core/notify.ts`), nunca para quem causou o evento, e respeitando as preferências da pessoa (grupos: conferência, sua parte, pagamentos, novas compras, lembretes).
- No app: sino no início, com contador. Na web instalada (PWA), também chegam como push (Web Push com chaves VAPID derivadas do segredo do servidor, então não precisa configurar nada; `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` substituem). No iPhone, push só funciona com o app adicionado à tela de início. Push no APK Android precisa de Firebase e fica para depois.
- Lembrete de vencimento: tarefa diária (Vercel Cron, 9h de Brasília, `GET /api/cron/daily`) avisa 2 dias antes quem ainda deve. Não repete o mesmo lembrete. Com `CRON_SECRET` definido, só a Vercel consegue chamar.

## Apelidos de estabelecimento
- Por família: "JANUARIO DA SILVEIRA" → "Mercado Três Amigos". O nome da fatura é comparado sem acento, caixa ou espaços extras.
- São aprendidos ao salvar uma compra com nome na fatura diferente do estabelecimento; também dá para criar e apagar à mão. Uma compra com só o nome da fatura recebe o apelido, e criar um apelido renomeia compras que ainda mostravam o nome cru.

## Anexos
- Foto, print ou PDF ligado à compra (ou à contestação). Fotos viram JPEG de até 1600 px; limite de 2 MB por arquivo e 10 por compra.
- O conteúdo fica numa tabela separada (`attachment_blobs`) e só é carregado quando alguém abre o anexo, para a fatura continuar leve. Remover esconde o anexo (soft delete).

## Camada de dados
A UI chama hooks → repositórios (`src/data/repositories.ts`). As regras de negócio dos repositórios ficam em `src/data/core` e operam sobre um `Store` (um retrato em memória dos dados). Existem dois backends:

- **Offline** (`src/data/mock`): o `Store` é salvo no aparelho. Usado em desenvolvimento e quando não há `EXPO_PUBLIC_API_URL`.
- **API** (`src/data/http`): cada método vira `POST /api/rpc { method, args }`. Login e cadastro passam pelo Better Auth (`/api/auth/*`), com token bearer guardado no aparelho.

## Servidor (Vercel Functions + Neon)
- O build (`scripts/build-vercel.mjs`) empacota o app Hono (`server/app.ts`) com todas as dependências num único arquivo CommonJS e publica pela Build Output API, porque a Vercel não carrega via `require()` bibliotecas publicadas só como ES modules (caso do Better Auth). Função na região de São Paulo (`gru1`); o banco Neon deve ficar em São Paulo também.
- Cada chamada roda numa transação (`server/operations.ts`): carrega só as famílias de que a pessoa é membro ativo, trava essas famílias (`SELECT … FOR UPDATE`) se for escrita, executa a mesma regra do `core` e grava a diferença (`server/unit-of-work.ts`). Família de outra pessoa nunca é carregada, então não dá para ler nem alterar.
- Só os métodos listados em `OPERATIONS` podem ser chamados.
- O banco também protege as regras de dinheiro: CHECKs (valores > 0, dia de fechamento 1–31, até 48 parcelas), parcela única por compra e número, fatura única por cartão e mês, e um gatilho adiado que recusa no commit qualquer compra cuja divisão ou parcelas não somem o total (`server/db/migrations/0001_money_rules.sql`).
- Pagamento acima do devido e alteração em fatura fechada são barrados pela regra do `core`, dentro da mesma transação.
- Migrações e a demo (Família Silva, conta `lucas@wallit.app`) são aplicadas a cada deploy.
- Quando o volume crescer, as operações mais usadas podem virar consultas diretas sem mudar o app, porque o contrato continua sendo o dos repositórios.

## Ainda falta
- Push no app Android (APK): precisa de uma conta Firebase.
- Envio de email (recuperação de senha): o pedido é aceito, mas o email ainda não é enviado.
- Token guardado com AsyncStorage; no app nativo, trocar por armazenamento seguro.

## Segurança
Nunca armazenamos número do cartão, CVV ou senha do cartão. Exclusões são soft delete e alterações relevantes ficam no log de auditoria.
