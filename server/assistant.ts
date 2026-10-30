import { addMonths, compareRefs, formatBRL, formatRef, type Card, type Category, type FamilyMember, type InvoiceRef } from '../src/domain';
import { AppError } from '../src/data/errors';
import type {
  AssistantMessage,
  FamilySummary,
  HomeSummary,
  InvoiceDetails,
  InvoiceListItem,
  PurchaseListItem,
  ScenarioOperation,
  ScenarioResult,
  StatisticsView,
} from '../src/data/models';
import type { Db } from './db/client';
import { runOperation, type OperationName } from './operations';

/**
 * The AI assistant: answers questions about the user's family in Portuguese,
 * using Google's Gemini (free tier). It only reads: every tool goes through
 * the same read operations the app uses, so it sees exactly what the user sees.
 */


const MAX_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_TOOL_ROUNDS = 5;

export function assistantConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

type Transport = (url: string, init: RequestInit) => Promise<Response>;
let transport: Transport = (url, init) => fetch(url, init);

/** Tests replace Gemini with a fake. */
export function setGeminiTransport(next: Transport): void {
  transport = next;
}

// ---- Gemini wire format ----

interface Part {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
  thought?: boolean;
  thoughtSignature?: string;
}

interface Content {
  role: 'user' | 'model';
  parts: Part[];
}

async function callGemini(system: string, contents: Content[]): Promise<Content> {
  const model = process.env.GEMINI_MODEL || 'gemini-flash-latest';
  const response = await transport(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY ?? '' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      tools: [{ functionDeclarations: TOOLS.map(({ name, description, parameters }) => ({ name, description, parameters })) }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
    }),
  });
  const data = (await response.json().catch(() => null)) as {
    candidates?: { content?: Content }[];
    error?: { message?: string };
  } | null;
  if (response.status === 429) {
    throw new AppError('validation', 'O Wally atingiu o limite gratuito por agora. Tente de novo daqui a pouco.');
  }
  if (!response.ok) {
    console.error('[assistant] gemini error', response.status, data?.error?.message);
    throw new AppError('internal', 'O assistente não conseguiu responder agora. Tente de novo.');
  }
  const content = data?.candidates?.[0]?.content;
  if (!content?.parts?.length) throw new AppError('internal', 'O assistente não soube responder. Tente perguntar de outro jeito.');
  return { role: 'model', parts: content.parts };
}

// ---- What the model sees (short text, money already formatted) ----

const brl = (cents: number) => formatBRL(cents);
const ref = (r: InvoiceRef) => formatRef(r);

function parseRef(value: unknown): InvoiceRef | null {
  const match = typeof value === 'string' ? /^(\d{4})-(\d{1,2})$/.exec(value.trim()) : null;
  if (!match) return null;
  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? { year: Number(match[1]), month } : null;
}

const STATUS: Record<string, string> = {
  open: 'aberta',
  reviewing: 'em conferência',
  closed: 'fechada',
  collecting: 'em cobrança',
  paid: 'paga',
  archived: 'arquivada',
};

interface Context {
  family: FamilySummary;
  members: FamilyMember[];
  cards: Card[];
  categories: Category[];
}

const memberName = (ctx: Context, id: string) => ctx.members.find((m) => m.id === id)?.displayName ?? 'alguém';

function purchaseLine(item: PurchaseListItem): string {
  const { purchase } = item;
  const installments = purchase.installmentCount > 1 ? ` em ${purchase.installmentCount}x` : '';
  const payers = item.payers.map((p) => p.displayName).join(', ');
  return `- ${purchase.date} ${purchase.merchant}: ${brl(purchase.totalCents)}${installments} · ${item.card.name} · comprou ${item.buyer.displayName} · paga(m) ${payers} · ${item.category?.name ?? 'sem categoria'} [compra ${purchase.id}]`;
}

function invoiceItem(ctx: Context, item: InvoiceListItem): string {
  const mine = item.myBalance ? ` · minha parte ${brl(item.myBalance.owedCents)}, falta eu pagar ${brl(item.myBalance.pendingCents)}` : '';
  return `- ${item.card.name} ${ref(item.invoice.ref)} (${STATUS[item.invoice.status]}, vence ${item.invoice.dueDate}): total ${brl(item.totals.totalCents)}, falta receber ${brl(item.totals.pendingCents)}${mine} [fatura ${item.invoice.id}]`;
}

function homeText(home: HomeSummary): string {
  return [
    `Eu devo transferir: ${brl(home.owedCents)}`,
    `Tenho a receber dos outros: ${brl(home.toReceiveCents)}`,
    `Minha parte nas faturas atuais: ${brl(home.myCurrentShareCents)}`,
    `Parcelamentos ativos: ${home.activeInstallments.count}, restam ${brl(home.activeInstallments.remainingCents)}`,
    home.nextDue ? `Próximo vencimento: ${home.nextDue.date} (${home.nextDue.cardName})` : 'Nenhum vencimento próximo',
    `Compras esperando minha conferência: ${home.toReview.count}`,
  ].join('\n');
}

function invoiceText(details: InvoiceDetails): string {
  const lines = details.lines.map((line) => {
    const parcel = line.installment.count > 1 ? ` (parcela ${line.installment.number}/${line.installment.count})` : '';
    const shares = line.shares.map((s) => `${s.member.displayName} ${brl(s.amountCents)}`).join(', ');
    return `- ${line.purchase.date} ${line.purchase.merchant}${parcel}: ${brl(line.installment.amountCents)} · ${line.category?.name ?? 'sem categoria'} · ${shares}`;
  });
  const balances = details.balancesRestricted
    ? ['(a família esconde o saldo dos outros membros)']
    : details.balances.map(
        (b) => `- ${b.member.displayName}: deve ${brl(b.owedCents)}, pagou ${brl(b.paidCents)}, falta ${brl(b.pendingCents)}`,
      );
  return [
    `Fatura ${details.card.name} ${ref(details.invoice.ref)} (${STATUS[details.invoice.status]}), titular ${details.holder.displayName}, vence ${details.invoice.dueDate}`,
    `Total ${brl(details.totals.totalCents)} · recebido ${brl(details.totals.receivedCents)} · falta ${brl(details.totals.pendingCents)}`,
    'Quanto cada um deve:',
    ...balances,
    `Lançamentos (${details.lines.length}):`,
    ...lines,
  ].join('\n');
}

function statisticsText(ctx: Context, stats: StatisticsView): string {
  const name = (list: { id: string; name: string }[], id: string) => list.find((x) => x.id === id)?.name ?? '?';
  const pct = (share: number) => `${Math.round(share * 100)}%`;
  return [
    `Total ${brl(stats.totalCents)} em ${stats.purchaseCount} compras, média mensal ${brl(stats.averageMonthCents)}`,
    `Por mês: ${stats.months.map((m) => `${ref(m.ref)} ${brl(m.totalCents)}`).join('; ')}`,
    `Por categoria: ${stats.byCategory.map((b) => `${name(stats.categories, b.id)} ${brl(b.totalCents)} (${pct(b.share)})`).join('; ')}`,
    `Por pessoa: ${stats.byMember.map((b) => `${memberName(ctx, b.id)} ${brl(b.totalCents)} (${pct(b.share)})`).join('; ')}`,
    `Por cartão: ${stats.byCard.map((b) => `${name(stats.cards, b.id)} ${brl(b.totalCents)}`).join('; ')}`,
    `Parcelas futuras ainda a cobrar: ${brl(stats.futureInstallmentsCents)}`,
  ].join('\n');
}

function scenarioText(result: ScenarioResult): string {
  // Same totals as the screen: invoices plus loan installments, minus loan money received.
  const months = result.months.map((m) => {
    const loan = m.loanPaymentsCents - m.loanReceivedCents;
    const loanText =
      m.loanPaymentsCents || m.loanReceivedCents
        ? ` (inclui empréstimo: paga ${brl(m.loanPaymentsCents)}, recebe ${brl(m.loanReceivedCents)})`
        : '';
    return `- ${ref(m.ref)}: cartões ${brl(m.cards.beforeCents)} → ${brl(m.cards.afterCents + loan)}; minha parte ${brl(m.mine.beforeCents)} → ${brl(m.mine.afterCents + loan)}${loanText}`;
  });
  const limits = result.limits.map(
    (l) => `- Limite disponível ${l.card.name}: ${brl(l.availableBeforeCents)} → ${brl(l.availableAfterCents)}`,
  );
  return ['Simulação (antes → depois), nada foi salvo:', ...months, ...limits].join('\n');
}

// ---- Tools ----

interface Tool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  run: (args: Record<string, unknown>, ctx: Context, read: Reader) => Promise<string>;
}

type Reader = <T>(name: OperationName, args: unknown[]) => Promise<T>;

const str = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);
const knownId = (value: unknown, ids: string[]) => {
  const id = str(value);
  return id && ids.includes(id) ? id : undefined;
};

const TOOLS: Tool[] = [
  {
    name: 'listar_faturas',
    description: 'Lista as faturas da família (todas os cartões), com total, quanto falta receber e a minha parte.',
    parameters: { type: 'object', properties: {} },
    async run(_args, ctx, read) {
      const items = await read<InvoiceListItem[]>('invoices.listByFamily', [ctx.family.family.id]);
      const sorted = [...items].sort((a, b) => b.invoice.dueDate.localeCompare(a.invoice.dueDate)).slice(0, 24);
      return sorted.length ? sorted.map((i) => invoiceItem(ctx, i)).join('\n') : 'Nenhuma fatura.';
    },
  },
  {
    name: 'detalhar_fatura',
    description: 'Mostra uma fatura: cada lançamento com parcela, categoria e divisão, e quanto cada pessoa deve e já pagou.',
    parameters: {
      type: 'object',
      properties: { faturaId: { type: 'string', description: 'id da fatura, vindo de listar_faturas' } },
      required: ['faturaId'],
    },
    async run(args, _ctx, read) {
      const id = str(args.faturaId);
      if (!id) return 'Informe faturaId.';
      return invoiceText(await read<InvoiceDetails>('invoices.getDetails', [id]));
    },
  },
  {
    name: 'buscar_compras',
    description: 'Busca compras por texto (loja), pessoa, cartão, categoria e período. Retorna até 40.',
    parameters: {
      type: 'object',
      properties: {
        texto: { type: 'string', description: 'parte do nome da loja' },
        pessoaId: { type: 'string', description: 'id do membro que comprou ou paga parte' },
        cartaoId: { type: 'string' },
        categoriaId: { type: 'string' },
        de: { type: 'string', description: 'data inicial AAAA-MM-DD' },
        ate: { type: 'string', description: 'data final AAAA-MM-DD' },
        soParceladas: { type: 'boolean' },
      },
    },
    async run(args, ctx, read) {
      const date = (value: unknown) => (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined);
      const items = await read<PurchaseListItem[]>('purchases.search', [
        ctx.family.family.id,
        {
          search: str(args.texto),
          memberId: knownId(args.pessoaId, ctx.members.map((m) => m.id)),
          cardId: knownId(args.cartaoId, ctx.cards.map((c) => c.id)),
          categoryId: knownId(args.categoriaId, ctx.categories.map((c) => c.id)),
          from: date(args.de),
          to: date(args.ate),
          onlyInstallments: args.soParceladas === true || undefined,
        },
      ]);
      if (!items.length) return 'Nenhuma compra encontrada.';
      const total = items.reduce((sum, i) => sum + i.purchase.totalCents, 0);
      const more = items.length > 40 ? `\n(mostrando 40 de ${items.length})` : '';
      return `${items.length} compras, somando ${brl(total)}:\n${items.slice(0, 40).map(purchaseLine).join('\n')}${more}`;
    },
  },
  {
    name: 'estatisticas',
    description: 'Gastos por mês, categoria, pessoa e cartão entre dois meses de fatura.',
    parameters: {
      type: 'object',
      properties: {
        deMes: { type: 'string', description: 'mês de fatura inicial AAAA-MM' },
        ateMes: { type: 'string', description: 'mês de fatura final AAAA-MM' },
        pessoaId: { type: 'string' },
        cartaoId: { type: 'string' },
        categoriaId: { type: 'string' },
      },
      required: ['deMes', 'ateMes'],
    },
    async run(args, ctx, read) {
      const from = parseRef(args.deMes);
      const to = parseRef(args.ateMes);
      if (!from || !to) return 'Use meses no formato AAAA-MM.';
      const stats = await read<StatisticsView>('statistics.get', [
        ctx.family.family.id,
        {
          from,
          to,
          memberId: knownId(args.pessoaId, ctx.members.map((m) => m.id)),
          cardId: knownId(args.cartaoId, ctx.cards.map((c) => c.id)),
          categoryId: knownId(args.categoriaId, ctx.categories.map((c) => c.id)),
        },
      ]);
      return statisticsText(ctx, stats);
    },
  },
  {
    name: 'simular_compra',
    description:
      'Simula uma compra nova num cartão (nada é salvo) e mostra como ficam as próximas faturas e a minha parte. Sem divisão, a compra fica toda comigo.',
    parameters: {
      type: 'object',
      properties: {
        cartaoId: { type: 'string' },
        valorTotalReais: { type: 'number', description: 'valor total da compra em reais' },
        parcelas: { type: 'integer', description: 'número de parcelas (1 a 48)' },
        mesPrimeiraParcela: { type: 'string', description: 'mês da fatura da primeira parcela AAAA-MM; padrão: a fatura aberta do cartão' },
      },
      required: ['cartaoId', 'valorTotalReais', 'parcelas'],
    },
    async run(args, ctx, read) {
      const cardId = knownId(args.cartaoId, ctx.cards.map((c) => c.id));
      const totalCents = Math.round(Number(args.valorTotalReais) * 100);
      const installmentCount = Math.trunc(Number(args.parcelas));
      if (!cardId) return 'Cartão desconhecido. Use um cartaoId da lista.';
      if (!(totalCents > 0) || !(installmentCount >= 1 && installmentCount <= 48)) return 'Valor ou parcelas inválidos.';
      const familyId = ctx.family.family.id;
      // The first still-open invoice of the card, unless the model asked for a later one.
      const probe = await read<ScenarioResult>('purchases.simulateScenario', [{ familyId, operations: [] }]);
      const openRef = probe.openRefs.find((o) => o.cardId === cardId)?.ref;
      const asked = parseRef(args.mesPrimeiraParcela);
      const startRef = asked && (!openRef || compareRefs(asked, openRef) >= 0) ? asked : (openRef ?? asked);
      if (!startRef) return 'Informe mesPrimeiraParcela (AAAA-MM).';
      const result = await read<ScenarioResult>('purchases.simulateScenario', [
        { familyId, operations: [{ kind: 'purchase', cardId, totalCents, installmentCount, startRef }] },
      ]);
      const end = addMonths(startRef, installmentCount);
      const months = result.months.filter((m) => compareRefs(m.ref, end) <= 0);
      return `Primeira parcela na fatura de ${ref(startRef)}.\n${scenarioText({ ...result, months })}`;
    },
  },
];

function systemPrompt(ctx: Context, home: HomeSummary, today: string): string {
  const me = ctx.family.me;
  const cards = ctx.cards.map(
    (c) =>
      `- ${c.name} [cartaoId ${c.id}] titular ${memberName(ctx, c.holderMemberId)}, fecha dia ${c.closingDay}, vence dia ${c.dueDay}${c.limitCents ? `, limite ${brl(c.limitCents)}` : ''}`,
  );
  const members = ctx.members.map((m) => `- ${m.displayName}${m.nickname ? ` (${m.nickname})` : ''} [pessoaId ${m.id}]${m.id === me.id ? ' ← sou eu' : ''}`);
  const categories = ctx.categories.filter((c) => !c.deletedAt).map((c) => `${c.name} [${c.id}]`);
  return [
    'Você é o Wally, o assistente do Wallit, um app brasileiro para dividir faturas de cartão de crédito em família. Se perguntarem seu nome, você é o Wally.',
    `Você conversa com ${me.displayName}. Hoje é ${today}. Responda sempre em português do Brasil, de forma curta, clara e amigável, para alguém sem conhecimento técnico.`,
    'Use as ferramentas para consultar dados reais antes de responder; nunca invente valores. Se não houver dados, diga isso.',
    'Você só lê e explica: não consegue criar, editar, pagar ou apagar nada. Se pedirem, explique onde fazer isso no app.',
    'Não mostre ids para a pessoa. Valores em reais no formato R$ 1.234,56. Meses de fatura no formato AAAA-MM nas ferramentas.',
    'Simulações de compras novas usam a ferramenta simular_compra; deixe claro que é só uma simulação.',
    '',
    `Família: ${ctx.family.family.name}`,
    'Membros:',
    ...members,
    'Cartões:',
    ...cards,
    `Categorias: ${categories.join(', ')}`,
    '',
    'Resumo de agora:',
    homeText(home),
    'Compras recentes:',
    ...home.recentPurchases.slice(0, 8).map(purchaseLine),
  ].join('\n');
}

function validMessages(value: unknown): AssistantMessage[] {
  if (!Array.isArray(value) || value.length === 0) throw new AppError('validation', 'Escreva uma pergunta.');
  const messages = value.slice(-MAX_MESSAGES).map((item) => {
    const role = (item as { role?: unknown })?.role;
    const text = (item as { text?: unknown })?.text;
    if ((role !== 'user' && role !== 'assistant') || typeof text !== 'string' || !text.trim()) {
      throw new AppError('validation', 'Mensagem inválida.');
    }
    return { role, text: text.trim().slice(0, MAX_MESSAGE_LENGTH) } as AssistantMessage;
  });
  if (messages[messages.length - 1].role !== 'user') throw new AppError('validation', 'Escreva uma pergunta.');
  return messages;
}

const SIMULATION_GUIDE = [
  'A pessoa está agora na tela "Simular" e quer entender a simulação que está montando. Explique com calma e exemplos usando os números dela.',
  'Como a tela funciona:',
  '- "1. Seu cenário": a pessoa junta operações. Compra no cartão (valor total ou valor da parcela × número de parcelas, a fatura da primeira parcela e quem paga). Empréstimo (dinheiro recebido num mês, fora do cartão, pago em parcelas a partir de outro mês; é sempre só da pessoa). Quitar parcelas (antecipar para a fatura escolhida as parcelas futuras do cartão inteiro ou de uma compra; pode ser só um valor, começando pelas últimas parcelas e pelas dela primeiro).',
  '- "2. Hoje × com a simulação": mês a mês, o valor de hoje e o valor com o cenário. "Minha parte" mostra só a parte da pessoa nas faturas. "Cartão inteiro" mostra o total das faturas de todos os cartões da família. Nas duas, o valor "com a simulação" soma as parcelas de empréstimo e desconta o dinheiro recebido do empréstimo no mês.',
  '- Quitar adianta parcelas: a fatura escolhida sobe e as seguintes descem. O total pago não muda (o app não calcula desconto de antecipação do banco).',
  '- Limite disponível só aparece para cartões com limite cadastrado usados por uma compra simulada.',
  '- Nada é salvo: é só uma conta para ajudar a decidir.',
  'Ajude a pessoa a decidir: aponte o mês mais pesado, quanto muda por mês e no total, e riscos (ex.: parcelas de empréstimo somadas às faturas). Não diga o que ela deve fazer, mostre as consequências.',
].join('\n');

function operationText(ctx: Context, operation: ScenarioOperation, index: number): string {
  const card = (id: string) => ctx.cards.find((c) => c.id === id)?.name ?? 'cartão';
  if (operation.kind === 'purchase') {
    const payers = operation.shares?.length
      ? operation.shares.map((s) => memberName(ctx, s.memberId)).join(', ')
      : 'só eu';
    return `${index + 1}. Compra no ${card(operation.cardId)}: ${brl(operation.totalCents)} em ${operation.installmentCount}x, primeira parcela na fatura de ${ref(operation.startRef)}, paga(m): ${payers}`;
  }
  if (operation.kind === 'loan') {
    return `${index + 1}. Empréstimo: recebo ${brl(operation.receivedCents)} em ${ref(operation.receivedRef)} e pago ${operation.installmentCount}x de ${brl(operation.installmentCents)} a partir de ${ref(operation.startRef)}`;
  }
  const what = operation.purchaseId ? 'parcelas de uma compra' : 'parcelas futuras do cartão inteiro';
  const amount = operation.amountCents ? `, só ${brl(operation.amountCents)}` : '';
  const count = operation.count ? ` (últimas ${operation.count})` : '';
  return `${index + 1}. Quitar ${what}${count} no ${card(operation.cardId)}, trazendo para a fatura de ${ref(operation.targetRef)}${amount}`;
}

async function simulationContext(ctx: Context, read: Reader, raw: unknown): Promise<string> {
  const operations = Array.isArray((raw as { operations?: unknown })?.operations)
    ? ((raw as { operations: ScenarioOperation[] }).operations.slice(0, 20))
    : [];
  let result: string;
  try {
    // Recalculated here, always for the user's own family: the app's numbers are never trusted as-is.
    const scenario = await read<ScenarioResult>('purchases.simulateScenario', [{ familyId: ctx.family.family.id, operations }]);
    result = operations.length ? scenarioText(scenario) : `Ainda sem operações. Faturas de hoje:\n${scenarioText(scenario)}`;
  } catch (error) {
    result = `A simulação tem um problema: ${error instanceof AppError ? error.message : 'não deu para calcular'}`;
  }
  let described: string[];
  try {
    described = operations.map((operation, index) => operationText(ctx, operation, index));
  } catch {
    described = ['(não deu para ler as operações)'];
  }
  return [SIMULATION_GUIDE, '', 'Cenário montado agora:', ...(described.length ? described : ['(nenhuma operação)']), '', result].join('\n');
}

/** Answers the last user message, looking up the family's data as needed. */
export async function askAssistant(
  db: Db,
  userId: string,
  request: { familyId?: unknown; messages?: unknown; simulation?: unknown } | null,
): Promise<{ reply: string }> {
  const familyId = request?.familyId;
  if (!assistantConfigured()) throw new AppError('validation', 'O Wally ainda não foi ativado neste app.');
  if (typeof familyId !== 'string') throw new AppError('validation', 'Escolha uma família.');
  const messages = validMessages(request?.messages);

  const read: Reader = async <T>(name: OperationName, args: unknown[]) => (await runOperation(db, userId, name, args)).result as T;
  const [family, members, cards, categories, home] = await Promise.all([
    read<FamilySummary>('families.get', [familyId]),
    read<FamilyMember[]>('families.listMembers', [familyId]),
    read<{ card: Card }[]>('cards.listByFamily', [familyId]),
    read<Category[]>('categories.list', [familyId]),
    read<HomeSummary>('dashboard.home', [familyId]),
  ]);
  const ctx: Context = { family, members, cards: cards.map((c) => c.card), categories };
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  const system = request?.simulation
    ? `${systemPrompt(ctx, home, today)}\n\n${await simulationContext(ctx, read, request.simulation)}`
    : systemPrompt(ctx, home, today);

  const contents: Content[] = messages.map((m) => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text }] }));
  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const answer = await callGemini(system, contents);
    contents.push(answer);
    const calls = answer.parts.filter((p) => p.functionCall);
    if (!calls.length || round === MAX_TOOL_ROUNDS) {
      const reply = answer.parts
        .filter((p) => p.text && !p.thought)
        .map((p) => p.text)
        .join('')
        .trim();
      return { reply: reply || 'Não consegui montar uma resposta. Tente perguntar de outro jeito.' };
    }
    const responses: Part[] = [];
    for (const { functionCall } of calls) {
      const tool = TOOLS.find((t) => t.name === functionCall!.name);
      let output: string;
      try {
        output = tool ? await tool.run(functionCall!.args ?? {}, ctx, read) : 'Ferramenta desconhecida.';
      } catch (error) {
        output = error instanceof AppError ? `Erro: ${error.message}` : 'Erro ao consultar os dados.';
        if (!(error instanceof AppError)) console.error('[assistant] tool failed', functionCall!.name, error);
      }
      responses.push({ functionResponse: { name: functionCall!.name, response: { resultado: output } } });
    }
    contents.push({ role: 'user', parts: responses });
  }
  return { reply: 'Não consegui montar uma resposta. Tente perguntar de outro jeito.' };
}
