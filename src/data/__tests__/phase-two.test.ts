import { createCoreRepositories, createDueReminders, seedDemoDatabase, Store } from '../core';
import { AppError } from '../errors';
import { createMockRepositories, DEMO_ACCOUNT } from '../mock';
import { addMonths } from '@/domain';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const MARIA = 'maria@wallit.app';
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function setup() {
  const repos = createMockRepositories({ latencyMs: 0 });
  await repos.reset();
  await repos.auth.signIn(DEMO_ACCOUNT.email, DEMO_ACCOUNT.password);
  const [family] = await repos.families.listMine();
  const familyId = family.family.id;
  const cards = await repos.cards.listByFamily(familyId);
  const principal = cards.find((c) => c.card.name === 'Cartão Principal')!;
  const secundario = cards.find((c) => c.card.name === 'Cartão Secundário')!;
  const members = await repos.families.listMembers(familyId);
  const byName = (name: string) => members.find((m) => m.displayName === name)!;
  const categories = await repos.categories.list(familyId);
  const signInAs = async (email: string) => {
    await repos.auth.signOut();
    await repos.auth.signIn(email, DEMO_ACCOUNT.password);
  };
  return { repos, familyId, principal, secundario, byName, category: categories[0], signInAs };
}

describe('payments confirmed by the holder', () => {
  it("keeps a member's transfer out of the received total until it is confirmed", async () => {
    const { repos, principal, signInAs } = await setup();
    const collecting = (await repos.invoices.listByCard(principal.card.id)).find((i) => i.invoice.status === 'collecting')!;
    // Maria (from the seed) has a transfer waiting for confirmation.
    const before = await repos.invoices.getDetails(collecting.invoice.id);
    const maria = before.balances.find((b) => b.member.displayName === 'Maria')!;
    expect(maria.awaitingCents).toBeGreaterThan(0);
    expect(maria.status).toBe('partial');

    // Maria can't mark more than what is left (her transfer is already waiting).
    await signInAs(MARIA);
    await expect(
      repos.payments.register({ invoiceId: collecting.invoice.id, memberId: maria.memberId, amountCents: 100 }),
    ).rejects.toThrow('aguardando');

    // The owner (holder has no account) confirms it.
    await signInAs(DEMO_ACCOUNT.email);
    const pending = before.payments.find((p) => p.status === 'pending')!;
    await repos.payments.confirm(pending.id);
    const after = await repos.invoices.getDetails(collecting.invoice.id);
    const mariaAfter = after.balances.find((b) => b.memberId === maria.memberId)!;
    expect(mariaAfter).toMatchObject({ status: 'paid', awaitingCents: 0, pendingCents: 0 });
    expect(after.totals.receivedCents).toBe(before.totals.receivedCents + pending.amountCents);

    await signInAs(MARIA);
    const notifications = await repos.notifications.list();
    expect(notifications[0]).toMatchObject({ type: 'payment_confirmed' });
  });

  it('notifies the owner when a member marks a payment on a card whose holder has no account', async () => {
    const { repos, principal, byName, signInAs } = await setup();
    await repos.invoices.changeStatus(principal.currentInvoice!.id, 'reviewing');
    await repos.invoices.changeStatus(principal.currentInvoice!.id, 'closed');
    const details = await repos.invoices.getDetails(principal.currentInvoice!.id);
    const maria = details.balances.find((b) => b.memberId === byName('Maria').id)!;

    await signInAs(MARIA);
    const payment = await repos.payments.register({ invoiceId: details.invoice.id, memberId: maria.memberId, amountCents: 1000 });
    expect(payment.status).toBe('pending');
    // Marking a payment starts collecting.
    expect((await repos.invoices.getDetails(details.invoice.id)).invoice.status).toBe('collecting');

    await signInAs(DEMO_ACCOUNT.email);
    const [latest] = await repos.notifications.list();
    expect(latest).toMatchObject({ type: 'payment_registered' });
    await repos.payments.reject(payment.id, 'Não caiu na conta');
    await expect(repos.payments.confirm(payment.id)).rejects.toBeInstanceOf(AppError);
  });

  it('only lets the holder or owner confirm payments', async () => {
    const { repos, principal, signInAs } = await setup();
    const collecting = (await repos.invoices.listByCard(principal.card.id)).find((i) => i.invoice.status === 'collecting')!;
    const pending = (await repos.invoices.getDetails(collecting.invoice.id)).payments.find((p) => p.status === 'pending')!;
    await signInAs(MARIA);
    await expect(repos.payments.confirm(pending.id)).rejects.toThrow('titular');
  });
});

describe('invoice review (conferência) and disputes', () => {
  it('lets each person confirm their purchases and blocks closing while a dispute is open', async () => {
    const { repos, secundario, signInAs } = await setup();
    const invoiceId = secundario.currentInvoice!.id;
    const details = await repos.invoices.getDetails(invoiceId);
    expect(details.invoice.status).toBe('reviewing');
    expect(details.reviewProgress.disputed).toBe(1);

    const mine = details.lines.filter((line) => line.review.awaitingMe);
    expect(mine.length).toBeGreaterThan(0);
    for (const line of mine) await repos.reviews.confirm(invoiceId, line.purchase.id);
    const afterConfirm = await repos.invoices.getDetails(invoiceId);
    expect(afterConfirm.lines.some((line) => line.review.awaitingMe)).toBe(false);

    await expect(repos.invoices.changeStatus(invoiceId, 'closed')).rejects.toThrow('contestação');

    const dispute = afterConfirm.lines.flatMap((line) => line.review.disputes)[0];
    expect(dispute.member.displayName).toBe('Maria');
    await repos.reviews.resolve(dispute.review.id, 'O frete foi estornado na fatura seguinte.');
    await repos.invoices.changeStatus(invoiceId, 'closed');

    await signInAs(MARIA);
    const types = (await repos.notifications.list()).map((n) => n.type);
    expect(types).toEqual(expect.arrayContaining(['dispute_resolved', 'amount_defined']));
  });

  it('only accepts answers from people involved in the purchase, during the review', async () => {
    const { repos, secundario, principal, signInAs } = await setup();
    const invoiceId = secundario.currentInvoice!.id;
    const spotify = (await repos.invoices.getDetails(invoiceId)).lines.find((l) => l.purchase.merchant === 'Spotify')!;
    await signInAs(MARIA);
    await expect(repos.reviews.dispute(invoiceId, spotify.purchase.id, { reason: 'not_recognized' })).rejects.toThrow('participa');

    const openLine = (await repos.invoices.getDetails(principal.currentInvoice!.id)).lines[0];
    await expect(repos.reviews.confirm(principal.currentInvoice!.id, openLine.purchase.id)).rejects.toThrow('conferência');
  });

  it('notifies the people involved when the review starts, and resets answers when a purchase changes', async () => {
    const { repos, principal, signInAs } = await setup();
    const invoiceId = principal.currentInvoice!.id;
    await repos.invoices.changeStatus(invoiceId, 'reviewing');

    await signInAs(MARIA);
    expect((await repos.notifications.list())[0]).toMatchObject({ type: 'review_started', link: `/invoice/${invoiceId}` });
    expect(await repos.notifications.unreadCount()).toBeGreaterThan(0);
    const amazon = (await repos.invoices.getDetails(invoiceId)).lines.find((l) => l.purchase.merchant === 'Amazon')!;
    await repos.reviews.confirm(invoiceId, amazon.purchase.id);
    await repos.notifications.markRead();
    expect(await repos.notifications.unreadCount()).toBe(0);

    await signInAs(DEMO_ACCOUNT.email);
    await repos.purchases.update(amazon.purchase.id, {
      shares: [
        { memberId: amazon.buyer.id, amountCents: 30000 },
        { memberId: amazon.shares.find((s) => s.member.displayName === 'Maria')!.member.id, amountCents: 15000 },
      ],
    });
    const line = (await repos.invoices.getDetails(invoiceId)).lines.find((l) => l.purchase.id === amazon.purchase.id)!;
    expect(line.review.pendingMembers.map((m) => m.displayName)).toEqual(expect.arrayContaining(['Lucas', 'Maria']));
  });
});

describe('merchant aliases', () => {
  it('learns aliases from purchases and fills the merchant from the statement name', async () => {
    const { repos, familyId, principal, byName, category } = await setup();
    const aliases = await repos.aliases.list(familyId);
    expect(aliases.find((a) => a.statementName === 'JANUARIO DA SILVEIRA')?.merchant).toBe('Mercado Três Amigos');

    const created = await repos.purchases.create({
      familyId,
      cardId: principal.card.id,
      merchant: '',
      statementName: 'Januário  da Silveira',
      totalCents: 5000,
      date: principal.currentInvoice!.closingDate.slice(0, 8) + '01',
      categoryId: category.id,
      buyerMemberId: byName('Lucas').id,
      installmentCount: 1,
      shares: [{ memberId: byName('Lucas').id, amountCents: 5000 }],
    });
    expect(created.purchase.merchant).toBe('Mercado Três Amigos');
  });

  it('renames purchases still showing the raw statement name', async () => {
    const { repos, familyId, principal, byName, category } = await setup();
    const raw = await repos.purchases.create({
      familyId,
      cardId: principal.card.id,
      merchant: 'PAG*JOSEDASILVA',
      statementName: 'PAG*JOSEDASILVA',
      totalCents: 2500,
      date: principal.currentInvoice!.closingDate.slice(0, 8) + '01',
      categoryId: category.id,
      buyerMemberId: byName('Lucas').id,
      installmentCount: 1,
      shares: [{ memberId: byName('Lucas').id, amountCents: 2500 }],
    });
    await repos.aliases.save(familyId, 'pag*josedasilva', 'Feira do Zé');
    expect((await repos.purchases.get(raw.purchase.id)).purchase.merchant).toBe('Feira do Zé');
  });
});

describe('notification settings', () => {
  it("respects a person's choice to stop receiving a kind of notification", async () => {
    const { repos, familyId, principal, byName, category, signInAs } = await setup();
    await signInAs(MARIA);
    await repos.auth.updateProfile({ notificationPrefs: { purchases: false } });
    const before = (await repos.notifications.list()).length;

    await signInAs(DEMO_ACCOUNT.email);
    await repos.purchases.create({
      familyId,
      cardId: principal.card.id,
      merchant: 'Padaria',
      totalCents: 2000,
      date: principal.currentInvoice!.closingDate.slice(0, 8) + '01',
      categoryId: category.id,
      buyerMemberId: byName('Lucas').id,
      installmentCount: 1,
      shares: [{ memberId: byName('Maria').id, amountCents: 2000 }],
    });
    await signInAs(MARIA);
    expect((await repos.notifications.list()).length).toBe(before);
  });
});

describe('attachments', () => {
  it('stores a receipt with the purchase and opens it', async () => {
    const { repos, familyId } = await setup();
    const [item] = await repos.purchases.search(familyId, { search: 'Amazon' });
    const attachment = await repos.attachments.add({ purchaseId: item.purchase.id, name: 'cupom.png', mimeType: 'image/png', dataUrl: PNG });
    expect(attachment.sizeBytes).toBeGreaterThan(0);
    expect((await repos.purchases.get(item.purchase.id)).attachments.map((a) => a.id)).toEqual([attachment.id]);
    expect((await repos.attachments.getData(attachment.id)).dataUrl).toBe(PNG);

    await expect(
      repos.attachments.add({ purchaseId: item.purchase.id, name: 'x.exe', mimeType: 'application/x-msdownload', dataUrl: 'data:application/x-msdownload;base64,AA==' }),
    ).rejects.toBeInstanceOf(AppError);

    await repos.attachments.remove(attachment.id);
    expect((await repos.purchases.get(item.purchase.id)).attachments).toHaveLength(0);
    await expect(repos.attachments.getData(attachment.id)).rejects.toBeInstanceOf(AppError);
  });
});

describe('statistics', () => {
  it('adds up spending by month, category and person consistently', async () => {
    const { repos, familyId, principal } = await setup();
    const to = principal.currentInvoice!.ref;
    const stats = await repos.statistics.get(familyId, { from: addMonths(to, -5), to });
    expect(stats.months).toHaveLength(6);
    const sum = (list: { totalCents: number }[]) => list.reduce((total, item) => total + item.totalCents, 0);
    expect(sum(stats.months)).toBe(stats.totalCents);
    expect(sum(stats.byCategory)).toBe(stats.totalCents);
    expect(sum(stats.byMember)).toBe(stats.totalCents);
    expect(stats.futureInstallmentsCents).toBeGreaterThan(0);

    const current = await repos.invoices.getDetails(principal.currentInvoice!.id);
    const onlyPrincipal = await repos.statistics.get(familyId, { from: to, to, cardId: principal.card.id });
    expect(onlyPrincipal.totalCents).toBe(current.totals.totalCents);
  });
});

describe('due date reminders', () => {
  it('reminds people who still owe, once', async () => {
    const store = new Store({ persistence: { load: async () => null, save: async () => undefined }, seed: seedDemoDatabase });
    await store.init();
    const collecting = store.db.invoices.find((i) => i.status === 'collecting')!;
    const [year, month, day] = collecting.dueDate.split('-').map(Number);
    const twoDaysBefore = new Date(Date.UTC(year, month - 1, day - 2)).toISOString().slice(0, 10);

    const reminders = createDueReminders(store, twoDaysBefore);
    const names = reminders.map((n) => store.member(n.recipientMemberId).displayName);
    expect(names).toEqual(['Lucas']);
    expect(reminders[0].body).toContain('Faltam');
    expect(createDueReminders(store, twoDaysBefore)).toHaveLength(0);

    // Only invoices due exactly in two days.
    expect(createDueReminders(store, collecting.dueDate)).toHaveLength(0);
  });

  it('works for the core repositories without the mock wrapper', async () => {
    const store = new Store({ persistence: { load: async () => null, save: async () => undefined }, seed: seedDemoDatabase });
    const repos = createCoreRepositories(store);
    await repos.auth.signIn(DEMO_ACCOUNT.email, DEMO_ACCOUNT.password);
    expect(await repos.notifications.unreadCount()).toBe(2);
  });
});
