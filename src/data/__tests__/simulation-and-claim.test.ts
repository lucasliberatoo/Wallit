import { addMonths, compareRefs, invoiceRefForDate } from '../../domain';
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

describe('purchase simulation', () => {
  it('shows each next invoice before and after, without saving anything', async () => {
    const { repos, familyId, card, byName } = await setup();
    const lucas = byName('Lucas');
    const maria = byName('Maria');
    const before = await repos.invoices.listByCard(card.id);

    const simulation = await repos.purchases.simulate({
      familyId,
      cardId: card.id,
      totalCents: 60000,
      installmentCount: 3,
      shares: [
        { memberId: lucas.id, amountCents: 30000 },
        { memberId: maria.id, amountCents: 30000 },
      ],
    });

    expect(simulation.months).toHaveLength(3);
    const first = invoiceRefForDate(today(), card.closingDay);
    simulation.months.forEach((month, index) => {
      expect(compareRefs(month.ref, addMonths(first, index))).toBe(0);
      expect(month.addedCents).toBe(20000);
      expect(month.myAddedCents).toBe(10000);
    });
    expect(simulation.myTotalCents).toBe(30000);
    expect(simulation.limit?.availableAfterCents).toBe(simulation.limit!.availableBeforeCents - 60000);

    // The current invoice's "before" is what is really there.
    const current = before.find((item) => compareRefs(item.invoice.ref, first) === 0);
    if (current) expect(simulation.months[0].beforeCents).toBe(current.totals.totalCents);

    expect(await repos.invoices.listByCard(card.id)).toEqual(before);
  });

  it('warns when the purchase goes over the card limit', async () => {
    const { repos, familyId, card } = await setup();
    const simulation = await repos.purchases.simulate({
      familyId,
      cardId: card.id,
      totalCents: card.limitCents! + 100,
      installmentCount: 10,
    });
    expect(simulation.limit!.availableAfterCents).toBeLessThan(0);
    // Without shares, everything is on whoever simulates.
    expect(simulation.myTotalCents).toBe(card.limitCents! + 100);
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
    expect(simulation.limit).toBeNull();

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
