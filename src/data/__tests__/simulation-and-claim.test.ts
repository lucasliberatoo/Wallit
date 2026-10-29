import { addMonths, compareRefs, type InvoiceRef, invoiceRefForDate, isInvoiceLocked } from '../../domain';
import type { ScenarioMonth } from '../models';
import { createMockRepositories, DEMO_ACCOUNT } from '../mock';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const today = () => new Date().toISOString().slice(0, 10);

async function setup() {
  const repos = createMockRepositories({ latencyMs: 0 });
  await repos.reset();
  await repos.auth.signIn(DEMO_ACCOUNT.email, DEMO_ACCOUNT.password);
  const [family] = await repos.families.listMine();
  const familyId = family.family.id;
  const cards = await repos.cards.listByFamily(familyId);
  const members = await repos.families.listMembers(familyId);
  const byName = (name: string) => members.find((m) => m.displayName === name)!;
  const categories = await repos.categories.list(familyId);
  return { repos, familyId, card: cards[0].card, byName, category: categories[0] };
}

/** First invoice still open on the card, where simulations may start. */
async function openRef(repos: Awaited<ReturnType<typeof setup>>['repos'], cardId: string) {
  const invoices = await repos.invoices.listByCard(cardId);
  const card = (await repos.cards.get(cardId)).card;
  let ref = invoiceRefForDate(today(), card.closingDay);
  while (invoices.some((i) => compareRefs(i.invoice.ref, ref) === 0 && isInvoiceLocked(i.invoice.status))) ref = addMonths(ref, 1);
  return ref;
}

const delta = (m: ScenarioMonth, view: 'cards' | 'mine') => m[view].afterCents - m[view].beforeCents;
const monthOf = (months: ScenarioMonth[], ref: InvoiceRef) => months.find((m) => compareRefs(m.ref, ref) === 0)!;

describe('scenario simulation', () => {
  it('shows a purchase month by month, for the whole card and for my part, without saving anything', async () => {
    const { repos, familyId, card, byName } = await setup();
    const lucas = byName('Lucas');
    const maria = byName('Maria');
    const before = await repos.invoices.listByCard(card.id);
    const start = addMonths(await openRef(repos, card.id), 1);

    const result = await repos.purchases.simulateScenario({
      familyId,
      operations: [
        {
          kind: 'purchase',
          cardId: card.id,
          totalCents: 60000,
          installmentCount: 3,
          startRef: start,
          shares: [
            { memberId: lucas.id, amountCents: 30000 },
            { memberId: maria.id, amountCents: 30000 },
          ],
        },
      ],
    });

    for (let i = 0; i < 3; i += 1) {
      const month = monthOf(result.months, addMonths(start, i));
      expect(delta(month, 'cards')).toBe(20000);
      expect(delta(month, 'mine')).toBe(10000);
    }
    expect(delta(monthOf(result.months, addMonths(start, -1)), 'cards')).toBe(0);
    expect(result.limits[0].availableAfterCents).toBe(result.limits[0].availableBeforeCents - 60000);
    expect(await repos.invoices.listByCard(card.id)).toEqual(before);
  });

  it('compares paying off the card with a loan against keeping the installments', async () => {
    const { repos, familyId, card, byName, category } = await setup();
    const lucas = byName('Lucas');
    await repos.purchases.create({
      familyId,
      cardId: card.id,
      merchant: 'Sofá',
      totalCents: 600000,
      date: today(),
      categoryId: category.id,
      buyerMemberId: lucas.id,
      installmentCount: 6,
      shares: [{ memberId: lucas.id, amountCents: 600000 }],
    });
    const target = await openRef(repos, card.id);

    const result = await repos.purchases.simulateScenario({
      familyId,
      operations: [
        { kind: 'payoff', cardId: card.id, targetRef: target },
        {
          kind: 'loan',
          receivedCents: 1000000,
          receivedRef: target,
          installmentCents: 100000,
          installmentCount: 10,
          startRef: addMonths(target, 1),
        },
      ],
    });

    const [payoff] = result.payoffs;
    expect(payoff.movedCents).toBeGreaterThanOrEqual(500000);
    const first = monthOf(result.months, target);
    expect(delta(first, 'cards')).toBe(payoff.movedCents);
    expect(first.loanReceivedCents).toBe(1000000);
    // Paying off only moves money between months; the loan is paid over the next 10.
    expect(result.months.reduce((sum, m) => sum + delta(m, 'cards'), 0)).toBe(0);
    expect(result.months.filter((m) => m.loanPaymentsCents === 100000)).toHaveLength(10);
    for (const month of result.months.filter((m) => compareRefs(m.ref, target) > 0)) {
      expect(month.cards.afterCents).toBeLessThanOrEqual(month.cards.beforeCents);
    }
  });

  it('paying off the whole card also covers purchases simulated before it', async () => {
    const { repos, familyId, card } = await setup();
    const target = await openRef(repos, card.id);
    const result = await repos.purchases.simulateScenario({
      familyId,
      operations: [
        { kind: 'purchase', cardId: card.id, totalCents: 30000, installmentCount: 3, startRef: addMonths(target, 1) },
        { kind: 'payoff', cardId: card.id, targetRef: target },
      ],
    });
    expect(result.months.reduce((sum, m) => sum + delta(m, 'cards'), 0)).toBe(30000);
    expect(delta(monthOf(result.months, target), 'cards')).toBe(result.payoffs[0].movedCents);
    expect(result.payoffs[0].movedCents).toBeGreaterThanOrEqual(30000);
  });

  it('pays off only a chosen amount, from the last installments', async () => {
    const { repos, familyId, card, byName, category } = await setup();
    const lucas = byName('Lucas');
    await repos.purchases.create({
      familyId,
      cardId: card.id,
      merchant: 'TV',
      totalCents: 600000,
      date: today(),
      categoryId: category.id,
      buyerMemberId: lucas.id,
      installmentCount: 6,
      shares: [{ memberId: lucas.id, amountCents: 600000 }],
    });
    const target = await openRef(repos, card.id);
    const result = await repos.purchases.simulateScenario({
      familyId,
      operations: [{ kind: 'payoff', cardId: card.id, targetRef: target, amountCents: 150000 }],
    });
    expect(result.payoffs[0].movedCents).toBe(150000);
    expect(delta(monthOf(result.months, target), 'cards')).toBe(150000);
    expect(result.months.reduce((sum, m) => sum + delta(m, 'cards'), 0)).toBe(0);
    // My installments go first, from the last one: the TV's 6th leaves entirely, the 5th by half.
    const tvLast = addMonths(invoiceRefForDate(today(), card.closingDay), 5);
    expect(delta(monthOf(result.months, tvLast), 'mine')).toBe(-100000);
    expect(delta(monthOf(result.months, addMonths(tvLast, -1)), 'mine')).toBe(-50000);
    // The whole amount is mine to pay in the target invoice.
    expect(delta(monthOf(result.months, target), 'mine')).toBe(150000);
  });

  it('does not start a simulation in an invoice that is already closed', async () => {
    const { repos, familyId, card } = await setup();
    const target = await openRef(repos, card.id);
    await expect(
      repos.purchases.simulateScenario({
        familyId,
        operations: [{ kind: 'purchase', cardId: card.id, totalCents: 1000, installmentCount: 1, startRef: addMonths(target, -1) }],
      }),
    ).rejects.toThrow('Simulação 1');
  });

  it('simulates anticipating installments: the last invoices go down, the open one goes up', async () => {
    const { repos, familyId, card, byName, category } = await setup();
    const lucas = byName('Lucas');
    const created = await repos.purchases.create({
      familyId,
      cardId: card.id,
      merchant: 'Notebook',
      totalCents: 120000,
      date: today(),
      categoryId: category.id,
      buyerMemberId: lucas.id,
      installmentCount: 6,
      shares: [{ memberId: lucas.id, amountCents: 120000 }],
    });
    const available = created.anticipation!.available;
    expect(created.anticipation!.allowed).toBe(true);

    const simulation = await repos.purchases.simulateAnticipation(created.purchase.id, available);
    const target = simulation.months.find((m) => compareRefs(m.ref, created.anticipation!.targetRef) === 0)!;
    expect(target.addedCents).toBe(available * 20000);
    expect(simulation.months.filter((m) => m.addedCents < 0)).toHaveLength(available);
    expect(simulation.months.reduce((sum, m) => sum + m.addedCents, 0)).toBe(0);

    // Nothing moved for real.
    const after = await repos.purchases.get(created.purchase.id);
    expect(after.anticipation!.available).toBe(available);
  });
});

describe('inviting someone already in the family to have an account', () => {
  it('lets them take over their profile, keeping their purchases', async () => {
    const { repos, familyId, card, byName, category } = await setup();
    const joao = byName('João');
    const lucas = byName('Lucas');
    await repos.purchases.create({
      familyId,
      cardId: card.id,
      merchant: 'Tênis do João',
      totalCents: 30000,
      date: today(),
      categoryId: category.id,
      buyerMemberId: lucas.id,
      installmentCount: 1,
      shares: [{ memberId: joao.id, amountCents: 30000 }],
    });
    const { code } = await repos.families.createInvite(familyId, joao.id);

    await repos.auth.signOut();
    await repos.auth.signUp({ name: 'João Silva', email: 'joao@example.com', password: '123456' });
    const family = await repos.families.joinByCode(code);
    expect(family.id).toBe(familyId);

    const [mine] = await repos.families.listMine();
    expect(mine.me.id).toBe(joao.id);
    expect(mine.me.displayName).toBe('João');
    const members = await repos.families.listMembers(familyId);
    expect(members.filter((m) => m.displayName.startsWith('João'))).toHaveLength(1);

    const purchases = await repos.purchases.search(familyId, { memberId: joao.id });
    expect(purchases.map((p) => p.purchase.merchant)).toContain('Tênis do João');

    // The link is personal and works once.
    await repos.auth.signOut();
    await repos.auth.signUp({ name: 'Outra pessoa', email: 'outra@example.com', password: '123456' });
    await expect(repos.families.joinByCode(code)).rejects.toMatchObject({ code: 'invalid_invite' });
  });

  it('refuses a personal invite for someone who already has an account', async () => {
    const { repos, familyId, byName } = await setup();
    await expect(repos.families.createInvite(familyId, byName('Maria').id)).rejects.toThrow('já tem conta');
  });
});
