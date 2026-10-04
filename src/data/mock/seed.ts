import {
  addMonths,
  type Card,
  closingDateFor,
  type FamilyMember,
  type ID,
  type Invoice,
  type InvoiceRef,
  type InvoiceStatus,
  invoiceRefForDate,
  parseISODate,
  reaisToCents,
  type ShareInput,
  splitEqually,
} from '@/domain';
import { palette } from '@/theme/colors';
import type { MockUser } from './database';
import { insertPurchase, updatePurchaseRecord } from './purchase-core';
import { seedDefaultCategories } from './seed-categories';
import { newId, type MockStore } from './store';
import { invoiceDetails, todayISO } from './views';

export const DEMO_ACCOUNT = { email: 'lucas@wallit.app', password: 'wallit123' };

const addDays = (date: string, days: number): string => {
  const { year, month, day } = parseISODate(date);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return d.toISOString().slice(0, 10);
};

/** A date inside the purchase period of an invoice, never in the future. */
function dateInPeriod(ref: InvoiceRef, closingDay: number, dayOffset: number): string {
  const periodStart = closingDateFor(addMonths(ref, -1), closingDay);
  const periodEnd = addDays(closingDateFor(ref, closingDay), -1);
  const today = todayISO();
  const candidate = addDays(periodStart, dayOffset);
  const limit = periodEnd < today ? periodEnd : today;
  return candidate > limit ? limit : candidate;
}

/**
 * Família Silva: realistic data to explore every flow. Dates are relative to
 * today, so the current invoice always has fresh purchases.
 */
export function seedMockDatabase(store: MockStore): void {
  const db = store.db;
  const createdAt = new Date(Date.now() - 1000 * 60 * 60 * 24 * 200).toISOString();

  const users: MockUser[] = [
    { id: newId('usr'), name: 'Lucas', email: DEMO_ACCOUNT.email, password: DEMO_ACCOUNT.password, avatarColor: palette.blue600, pixKey: 'lucas@wallit.app' },
    { id: newId('usr'), name: 'Maria', email: 'maria@wallit.app', password: DEMO_ACCOUNT.password, avatarColor: palette.violet600 },
  ];
  db.users.push(...users);
  db.sessionUserId = users[0].id;

  const familyId = newId('fam');
  db.families.push({ id: familyId, name: 'Família Silva', color: palette.orange500, createdBy: users[0].id, createdAt });

  const member = (displayName: string, role: FamilyMember['role'], avatarColor: string, userId: ID | null = null): FamilyMember => {
    const m: FamilyMember = { id: newId('mem'), familyId, userId, displayName, role, avatarColor, status: 'active', joinedAt: createdAt };
    db.members.push(m);
    return m;
  };
  const lucas = member('Lucas', 'owner', palette.blue600, users[0].id);
  const maria = member('Maria', 'member', palette.violet600, users[1].id);
  const joao = member('João', 'member', palette.green600, null);
  const ana = member('Ana', 'member', '#E31B54', null);
  const avo = member('Avó', 'titular', palette.orange500, null);
  avo.nickname = 'Vó Cida';

  seedDefaultCategories(store, familyId);
  const category = (name: string) => db.categories.find((c) => c.familyId === familyId && c.name === name)!.id;

  const walletId = newId('wal');
  db.wallets.push({ id: walletId, familyId, name: 'Carteira da Família', createdAt });

  const card = (name: string, holder: FamilyMember, theme: Card['theme'], closingDay: number, dueDay: number, brand: Card['brand'], limit: number): Card => {
    const c: Card = {
      id: newId('crd'), familyId, walletId, name, holderMemberId: holder.id, theme, brand,
      limitCents: reaisToCents(limit), closingDay, dueDay, status: 'active', createdAt,
    };
    db.cards.push(c);
    return c;
  };
  const principal = card('Cartão Principal', avo, 'midnight', 25, 5, 'mastercard', 12000);
  const secundario = card('Cartão Secundário', lucas, 'ocean', 10, 17, 'visa', 4000);

  const today = todayISO();
  const current = invoiceRefForDate(today, principal.closingDay);
  const previous = addMonths(current, -1);
  const older = addMonths(current, -2);

  const buy = (params: {
    card: Card;
    merchant: string;
    statementName?: string;
    value: number;
    date: string;
    category: string;
    buyer: FamilyMember;
    shares?: [FamilyMember, number][];
    equally?: FamilyMember[];
    installments?: number;
    note?: string;
  }) => {
    const totalCents = reaisToCents(params.value);
    const shares: ShareInput[] = params.equally
      ? splitEqually(totalCents, params.equally.map((m) => m.id))
      : (params.shares ?? [[params.buyer, params.value]]).map(([m, v]) => ({ memberId: m.id, amountCents: reaisToCents(v) }));
    return insertPurchase(
      store,
      {
        familyId,
        cardId: params.card.id,
        merchant: params.merchant,
        statementName: params.statementName,
        totalCents,
        date: params.date,
        categoryId: category(params.category),
        buyerMemberId: params.buyer.id,
        installmentCount: params.installments ?? 1,
        shares,
        note: params.note,
      },
      users[0].id,
      `${params.date}T15:00:00.000Z`,
    );
  };

  const inCurrent = (offset: number) => dateInPeriod(current, principal.closingDay, offset);
  const inPrevious = (offset: number) => dateInPeriod(previous, principal.closingDay, offset);
  const inOlder = (offset: number) => dateInPeriod(older, principal.closingDay, offset);

  // Long-running installments started months ago.
  buy({ card: principal, merchant: 'Notebook', statementName: 'MAGAZINE LUIZA 05/12', value: 2400, date: dateInPeriod(addMonths(current, -4), 25, 6), category: 'Eletrônicos', buyer: maria, installments: 12 });
  buy({ card: principal, merchant: 'Celular', statementName: 'SAMSUNG STORE', value: 1800, date: dateInPeriod(addMonths(current, -2), 25, 3), category: 'Eletrônicos', buyer: joao, installments: 10 });

  // Older invoice (paid).
  buy({ card: principal, merchant: 'Mercado Três Amigos', statementName: 'JANUARIO DA SILVEIRA', value: 412.35, date: inOlder(2), category: 'Mercado', buyer: avo, shares: [[avo, 212.35], [lucas, 200]] });
  buy({ card: principal, merchant: 'Farmácia São João', value: 96.4, date: inOlder(8), category: 'Farmácia', buyer: ana, shares: [[ana, 48.2], [avo, 48.2]] });
  buy({ card: principal, merchant: 'Netflix', value: 59.9, date: inOlder(10), category: 'Assinaturas', buyer: maria, equally: [maria, joao, ana] });

  // Previous invoice (receiving payments).
  buy({ card: principal, merchant: 'Mercado Três Amigos', statementName: 'JANUARIO DA SILVEIRA', value: 389.7, date: inPrevious(1), category: 'Mercado', buyer: lucas, shares: [[lucas, 189.7], [avo, 200]] });
  buy({ card: principal, merchant: 'Posto Ipiranga', statementName: 'AUTO POSTO SAO JORGE', value: 250, date: inPrevious(4), category: 'Combustível', buyer: joao });
  buy({ card: principal, merchant: 'Netflix', value: 59.9, date: inPrevious(10), category: 'Assinaturas', buyer: maria, equally: [maria, joao, ana] });
  buy({ card: principal, merchant: 'Restaurante Sabor Caseiro', statementName: 'SABOR CASEIRO LTDA', value: 186, date: inPrevious(12), category: 'Alimentação', buyer: lucas, equally: [lucas, maria, ana] });
  buy({ card: principal, merchant: 'Amazon', statementName: 'AMAZON BR MARKETPLACE', value: 132.9, date: inPrevious(15), category: 'Casa', buyer: ana });

  // Current invoice (open).
  const mercado = buy({ card: principal, merchant: 'Mercado Três Amigos', statementName: 'JANUARIO DA SILVEIRA', value: 340, date: inCurrent(1), category: 'Mercado', buyer: lucas, shares: [[lucas, 170], [avo, 170]] });
  buy({ card: principal, merchant: 'Farmácia São João', value: 120, date: inCurrent(2), category: 'Farmácia', buyer: ana, shares: [[ana, 60], [avo, 60]] });
  buy({ card: principal, merchant: 'Amazon', statementName: 'AMAZON BR MARKETPLACE', value: 450, date: inCurrent(3), category: 'Casa', buyer: lucas, shares: [[lucas, 250], [maria, 200]], note: 'Air fryer e utensílios' });
  buy({ card: principal, merchant: 'Posto Ipiranga', statementName: 'AUTO POSTO SAO JORGE', value: 200, date: inCurrent(4), category: 'Combustível', buyer: joao });
  buy({ card: principal, merchant: 'Netflix', value: 59.9, date: inCurrent(5), category: 'Assinaturas', buyer: maria, equally: [maria, joao, ana] });
  buy({ card: principal, merchant: 'iFood', statementName: 'IFD*IFOOD.COM AGENCIA', value: 87.5, date: inCurrent(6), category: 'Alimentação', buyer: lucas });
  buy({ card: principal, merchant: 'Renner', statementName: 'LOJAS RENNER SA', value: 239.9, date: inCurrent(6), category: 'Roupas', buyer: ana, installments: 2 });
  buy({ card: principal, merchant: 'Uber', statementName: 'UBER *TRIP', value: 34.8, date: inCurrent(7), category: 'Transporte', buyer: joao });
  buy({ card: principal, merchant: 'Drogasil', value: 45.3, date: inCurrent(8), category: 'Saúde', buyer: avo });

  // Secondary card (Lucas is the holder).
  const secondaryRef = invoiceRefForDate(today, secundario.closingDay);
  const inSecondary = (offset: number) => dateInPeriod(secondaryRef, secundario.closingDay, offset);
  buy({ card: secundario, merchant: 'Spotify', statementName: 'SPOTIFY BRASIL', value: 21.9, date: inSecondary(2), category: 'Assinaturas', buyer: lucas });
  buy({ card: secundario, merchant: 'Mercado Livre', statementName: 'MERCADOLIVRE*3PRODUTOS', value: 189, date: inSecondary(5), category: 'Casa', buyer: maria, shares: [[maria, 89], [lucas, 100]] });
  buy({ card: secundario, merchant: 'Academia Fit', value: 99.9, date: inSecondary(8), category: 'Saúde', buyer: ana });

  // An edit to show the audit trail: R$ 340 corrected to R$ 320.
  updatePurchaseRecord(store, mercado, {
    familyId, cardId: principal.id, merchant: mercado.merchant, statementName: mercado.statementName,
    totalCents: reaisToCents(320), date: mercado.date, categoryId: mercado.categoryId, buyerMemberId: lucas.id,
    installmentCount: 1, shares: [{ memberId: lucas.id, amountCents: 16000 }, { memberId: avo.id, amountCents: 16000 }],
    note: 'Valor corrigido conforme cupom',
  }, users[0].id);

  // Statuses and payments for past invoices.
  const pay = (invoice: Invoice, memberId: ID, cents: number) => {
    db.payments.push({ id: newId('pay'), invoiceId: invoice.id, memberId, amountCents: cents, paidAt: `${invoice.dueDate}T12:00:00.000Z`, registeredBy: users[0].id });
  };
  const settle = (invoice: Invoice, status: InvoiceStatus) => {
    for (const balance of invoiceDetails(store, invoice).balances) {
      if (balance.pendingCents > 0) pay(invoice, balance.memberId, balance.pendingCents);
    }
    invoice.status = status;
  };

  for (const invoice of db.invoices) {
    const isPast = invoice.dueDate < today && invoice.cardId === principal.id;
    if (isPast && invoice.id !== store.findInvoice(principal.id, previous)?.id) settle(invoice, 'paid');
  }

  const previousInvoice = store.findInvoice(principal.id, previous);
  if (previousInvoice) {
    const balances = invoiceDetails(store, previousInvoice).balances;
    const owed = (m: FamilyMember) => balances.find((b) => b.memberId === m.id)?.owedCents ?? 0;
    pay(previousInvoice, lucas.id, owed(lucas));
    pay(previousInvoice, maria.id, Math.round(owed(maria) / 2));
    pay(previousInvoice, ana.id, owed(ana));
    previousInvoice.status = 'collecting';
  }

  // Secondary card's previous invoices are already settled.
  for (const invoice of db.invoices.filter((i) => i.cardId === secundario.id && i.dueDate < today)) settle(invoice, 'paid');

  db.sessionUserId = null;
}
