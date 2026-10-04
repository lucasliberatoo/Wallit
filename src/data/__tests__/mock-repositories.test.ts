import { createMockRepositories, DEMO_ACCOUNT } from '../mock';
import { AppError } from '../errors';
import { refKey } from '@/domain';

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
  const members = await repos.families.listMembers(familyId);
  const byName = (name: string) => members.find((m) => m.displayName === name)!;
  const cards = await repos.cards.listByFamily(familyId);
  const principal = cards.find((c) => c.card.name === 'Cartão Principal')!;
  const categories = await repos.categories.list(familyId);
  return { repos, familyId, byName, principal, category: categories[0] };
}

describe('mock backend (end-to-end business rules)', () => {
  it('seeds Família Silva with 5 members and 2 cards', async () => {
    const { repos, familyId, principal } = await setup();
    expect((await repos.families.listMembers(familyId)).map((m) => m.displayName)).toEqual(['Lucas', 'Maria', 'João', 'Ana', 'Avó']);
    expect(principal.holder.displayName).toBe('Avó');
    expect(principal.totals.totalCents).toBeGreaterThan(0);
  });

  it('creates a shared purchase and charges each person their share', async () => {
    const { repos, familyId, byName, principal, category } = await setup();
    const before = await repos.invoices.getDetails(principal.currentInvoice!.id);
    const details = await repos.purchases.create({
      familyId,
      cardId: principal.card.id,
      merchant: 'Farmácia',
      totalCents: 12000,
      date: principal.currentInvoice!.closingDate.slice(0, 8) + '01',
      categoryId: category.id,
      buyerMemberId: byName('Ana').id,
      installmentCount: 1,
      shares: [
        { memberId: byName('Avó').id, amountCents: 6000 },
        { memberId: byName('Ana').id, amountCents: 6000 },
      ],
    });
    expect(details.shares.map((s) => s.amountCents)).toEqual([6000, 6000]);
    const after = await repos.invoices.getDetails(principal.currentInvoice!.id);
    expect(after.totals.totalCents - before.totals.totalCents).toBe(12000);
    const owed = (invoice: typeof after, name: string) => invoice.balances.find((b) => b.member.displayName === name)!.owedCents;
    expect(owed(after, 'Ana') - owed(before, 'Ana')).toBe(6000);
  });

  it('rejects a purchase whose split does not add up', async () => {
    const { repos, familyId, byName, principal, category } = await setup();
    await expect(
      repos.purchases.create({
        familyId,
        cardId: principal.card.id,
        merchant: 'Farmácia',
        totalCents: 12000,
        date: '2026-10-01',
        categoryId: category.id,
        buyerMemberId: byName('Ana').id,
        installmentCount: 1,
        shares: [
          { memberId: byName('Avó').id, amountCents: 6000 },
          { memberId: byName('Ana').id, amountCents: 5000 },
        ],
      }),
    ).rejects.toThrow('Faltam R$ 10,00 para completar a compra.');
  });

  it('places each installment in a different consecutive invoice', async () => {
    const { repos, familyId, byName, principal, category } = await setup();
    const details = await repos.purchases.create({
      familyId,
      cardId: principal.card.id,
      merchant: 'Notebook',
      totalCents: 240000,
      date: '2026-10-01',
      categoryId: category.id,
      buyerMemberId: byName('Maria').id,
      installmentCount: 12,
      shares: [{ memberId: byName('Maria').id, amountCents: 240000 }],
    });
    const keys = details.installments.map((i) => refKey(i.invoice.ref));
    expect(new Set(keys).size).toBe(12);
    expect(details.installments.every((i) => i.installment.amountCents === 20000)).toBe(true);
  });

  it('supports partial payments and never accepts more than what is owed', async () => {
    const { repos, principal } = await setup();
    const invoices = await repos.invoices.listByCard(principal.card.id);
    const collecting = invoices.find((i) => i.invoice.status === 'collecting')!;
    const details = await repos.invoices.getDetails(collecting.invoice.id);
    const maria = details.balances.find((b) => b.member.displayName === 'Maria')!;
    expect(maria.status).toBe('partial');

    await expect(
      repos.payments.register({ invoiceId: collecting.invoice.id, memberId: maria.memberId, amountCents: maria.pendingCents + 1 }),
    ).rejects.toBeInstanceOf(AppError);

    await repos.payments.register({ invoiceId: collecting.invoice.id, memberId: maria.memberId, amountCents: maria.pendingCents });
    const updated = await repos.invoices.getDetails(collecting.invoice.id);
    expect(updated.balances.find((b) => b.memberId === maria.memberId)!.status).toBe('paid');
  });

  it('records edits in the audit history', async () => {
    const { repos, familyId } = await setup();
    const [item] = await repos.purchases.search(familyId, { search: 'Mercado Três Amigos' });
    const edited = await repos.purchases.update(item.purchase.id, { totalCents: item.purchase.totalCents });
    expect(edited.history.length).toBeGreaterThan(0);
    const mercado = (await repos.purchases.search(familyId, { search: 'Mercado' })).map((r) => r.purchase.id);
    const histories = await Promise.all(mercado.map((id) => repos.purchases.get(id)));
    const corrected = histories.find((h) => h.history.some((log) => log.changes.some((c) => c.field === 'Valor')))!;
    const change = corrected.history.flatMap((log) => log.changes).find((c) => c.field === 'Valor')!;
    expect(change).toMatchObject({ from: 'R$ 340,00', to: 'R$ 320,00' });
  });

  it('protects purchases of closed invoices from regular members', async () => {
    const { repos, familyId } = await setup();
    await repos.auth.signOut();
    await repos.auth.signIn('maria@wallit.app', DEMO_ACCOUNT.password);
    const results = await repos.purchases.search(familyId, {});
    const lockedDetails = await Promise.all(results.map((r) => repos.purchases.get(r.purchase.id)));
    const locked = lockedDetails.find((d) => d.installments.every((i) => i.invoice.status === 'paid'))!;
    expect(locked.canEdit).toBe(false);
    await expect(repos.purchases.update(locked.purchase.id, { merchant: 'X' })).rejects.toBeInstanceOf(AppError);
  });

  it('isolates families: users only see families they belong to', async () => {
    const { repos } = await setup();
    await repos.auth.signOut();
    await repos.auth.signUp({ name: 'Pedro', email: 'pedro@example.com', password: '123456' });
    expect(await repos.families.listMine()).toEqual([]);
  });
});
