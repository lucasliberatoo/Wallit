import { createMockRepositories, DEMO_ACCOUNT } from '../../../data/mock';
import { sumCents } from '../../../domain';
import { filterLines, groupLines, memberLines, memberShareCents, sharePercentLabel } from '../group-lines';

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

describe('a member’s own invoice', () => {
  it('adds up, by date and by category, to exactly what each person owes', async () => {
    const { repos, familyId, cards, byName, category } = await setup();
    const lucas = byName('Lucas');
    const maria = byName('Maria');
    // A split purchase in installments: the case where the name search didn't add up.
    const created = await repos.purchases.create({
      familyId,
      cardId: cards[0].card.id,
      merchant: 'Geladeira',
      totalCents: 30001,
      date: new Date().toISOString().slice(0, 10),
      categoryId: category.id,
      buyerMemberId: lucas.id,
      installmentCount: 3,
      shares: [
        { memberId: lucas.id, amountCents: 20001 },
        { memberId: maria.id, amountCents: 10000 },
      ],
    });

    const details = await repos.invoices.getDetails(created.installments[0].invoice.id);
    for (const balance of details.balances) {
      const lines = memberLines(details.lines, balance.memberId);
      for (const groupBy of ['date', 'category'] as const) {
        const groups = groupLines(lines, groupBy, balance.memberId);
        expect(sumCents(groups.map((g) => g.totalCents))).toBe(balance.owedCents);
      }
    }

    // Searching Maria's name lists whole purchases, so it adds up to more than her part.
    const searched = groupLines(filterLines(details.lines, 'Maria'), 'date');
    const balanceOfMaria = details.balances.find((b) => b.memberId === maria.id)!;
    expect(sumCents(searched.map((g) => g.totalCents))).toBeGreaterThan(balanceOfMaria.owedCents);

    const line = details.lines.find((l) => l.purchase.id === created.purchase.id)!;
    expect(memberShareCents(line, maria.id) + memberShareCents(line, lucas.id)).toBe(line.installment.amountCents);
  });

  it('explains the part as a percentage of the installment', () => {
    expect(sharePercentLabel(5000, 10000)).toBe('50%');
    expect(sharePercentLabel(3333, 10000)).toBe('33,3%');
    expect(sharePercentLabel(10000, 10000)).toBe('100%');
    expect(sharePercentLabel(0, 0)).toBe('0%');
  });
});
