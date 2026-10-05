import { createMockRepositories, DEMO_ACCOUNT } from '../mock';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

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
  return { repos, familyId, cards, byName, category: categories[0] };
}

describe('shared purchases in installments', () => {
  it('splits every installment between the people, not only the total', async () => {
    const { repos, familyId, cards, byName, category } = await setup();
    const lucas = byName('Lucas');
    const maria = byName('Maria');
    const created = await repos.purchases.create({
      familyId,
      cardId: cards[0].card.id,
      merchant: 'Geladeira',
      totalCents: 30000,
      date: new Date().toISOString().slice(0, 10),
      categoryId: category.id,
      buyerMemberId: lucas.id,
      installmentCount: 3,
      shares: [
        { memberId: lucas.id, amountCents: 15000 },
        { memberId: maria.id, amountCents: 15000 },
      ],
    });

    for (const { invoice } of created.installments) {
      const details = await repos.invoices.getDetails(invoice.id);
      const line = details.lines.find((l) => l.purchase.id === created.purchase.id)!;
      expect(line.installment.amountCents).toBe(10000);
      expect(line.shares.map((s) => [s.member.displayName, s.amountCents])).toEqual([
        ['Lucas', 5000],
        ['Maria', 5000],
      ]);
    }
  });
});

describe('who sees how much each person owes', () => {
  it('lets the owner hide other people’s balances from members', async () => {
    const { repos, familyId, cards } = await setup();
    const invoiceId = cards[0].currentInvoice!.id;
    const all = await repos.invoices.getDetails(invoiceId);
    expect(all.balances.length).toBeGreaterThan(1);

    await repos.families.updateSettings(familyId, { balancesVisibility: 'managers' });
    await repos.auth.signOut();
    await repos.auth.signIn('maria@wallit.app', DEMO_ACCOUNT.password);

    const mine = await repos.invoices.getDetails(invoiceId);
    expect(mine.balancesRestricted).toBe(true);
    expect(mine.balances.map((b) => b.member.displayName)).toEqual(['Maria']);
    expect(mine.payments.every((p) => p.member.displayName === 'Maria')).toBe(true);
    await expect(repos.families.updateSettings(familyId, { balancesVisibility: 'everyone' })).rejects.toThrow();
  });
});
