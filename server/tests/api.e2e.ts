/**
 * End-to-end tests of the API: the app's real HTTP repositories talking to the
 * Hono app (in-process) backed by a real Postgres.
 *
 *   TEST_DATABASE_URL=postgres://... npm run test:api
 */
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

import { DEMO_ACCOUNT } from '../../src/data/core';
import { AppError } from '../../src/data/errors';
import { createHttpRepositories } from '../../src/data/http/repositories';
import type { Repositories } from '../../src/data/repositories';
import { refKey } from '../../src/domain';
import { app } from '../app';
import { runDailyReminders } from '../cron';
import { closeDb, getDb } from '../db/client';
import * as t from '../db/schema';
import { seedDemo } from '../seed';
import { restoreRewrittenUrl } from '../vercel';

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('Set TEST_DATABASE_URL to a throwaway Postgres database.');
// The database connection is opened lazily, on first use.
process.env.DATABASE_URL = url;
// The reset link must point at a trusted origin.
process.env.TRUSTED_ORIGINS = 'http://wallit.test';

// Route the app's fetch calls straight into the Hono app.
globalThis.fetch = ((input: string, init?: RequestInit) => app.fetch(new Request(`http://wallit.test${input}`, init))) as typeof fetch;

function client(): Repositories {
  let token: string | null = null;
  return createHttpRepositories('/api', { get: async () => token, set: async (next) => void (token = next) });
}

async function signedIn(email = DEMO_ACCOUNT.email) {
  const repos = client();
  await repos.auth.signIn(email, DEMO_ACCOUNT.password);
  const [family] = await repos.families.listMine();
  const familyId = family.family.id;
  const members = await repos.families.listMembers(familyId);
  const byName = (name: string) => members.find((m) => m.displayName === name)!;
  const cards = await repos.cards.listByFamily(familyId);
  const principal = cards.find((c) => c.card.name === 'Cartão Principal')!;
  const [category] = await repos.categories.list(familyId);
  return { repos, familyId, byName, principal, category };
}

const purchaseDate = (closingDate: string) => closingDate.slice(0, 8) + '01';

async function rejects(promise: Promise<unknown>, code?: string) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof AppError, `expected AppError, got ${String(error)}`);
    if (code) assert.equal(error.code, code);
    return true;
  });
}

before(async () => {
  await migrate(getDb(), { migrationsFolder: 'server/db/migrations' });
});

beforeEach(async () => {
  await getDb().execute(sql`
    truncate table push_subscriptions, notifications, attachment_blobs, attachments, merchant_aliases, purchase_reviews,
      audit_logs, payments, purchase_installments, purchase_shares, purchases, categories, invoices,
      cards, wallets, family_invites, family_members, families, verification, session, account, "user" cascade`);
  await seedDemo(getDb());
});

after(closeDb);

describe('API', () => {
  it('resets a forgotten password through the emailed token', async () => {
    const repos = client();
    assert.deepEqual(await repos.auth.options(), { google: false, passwordResetEmail: false });
    await repos.auth.requestPasswordReset(DEMO_ACCOUNT.email, 'http://wallit.test/redefinir-senha');
    const rows = await getDb().execute<{ identifier: string }>(sql`select identifier from verification`);
    const token = rows.rows.map((row) => row.identifier).find((id) => id.startsWith('reset-password:'))?.split(':')[1];
    assert.ok(token, 'reset token stored');
    await rejects(repos.auth.resetPassword('wrong-token', 'nova-senha'), 'validation');
    await repos.auth.resetPassword(token, 'nova-senha');
    await rejects(repos.auth.signIn(DEMO_ACCOUNT.email, DEMO_ACCOUNT.password), 'invalid_credentials');
    const session = await repos.auth.signIn(DEMO_ACCOUNT.email, 'nova-senha');
    assert.equal(session.user.email, DEMO_ACCOUNT.email);
  });

  it('signs in with the demo account and loads the Silva family', async () => {
    const { repos, familyId, principal } = await signedIn();
    const session = await repos.auth.getSession();
    assert.equal(session?.user.email, DEMO_ACCOUNT.email);
    const members = await repos.families.listMembers(familyId);
    assert.deepEqual(
      members.map((m) => m.displayName),
      ['Lucas', 'Maria', 'João', 'Ana', 'Avó'],
    );
    assert.equal(principal.holder.displayName, 'Avó');
    const home = await repos.dashboard.home(familyId);
    assert.ok(home);
  });

  it('rejects wrong passwords and calls without a session', async () => {
    await rejects(client().auth.signIn(DEMO_ACCOUNT.email, 'errada'), 'invalid_credentials');
    await rejects(client().families.listMine(), 'unauthorized');
  });

  it('rejects unknown operations', async () => {
    const { repos } = await signedIn();
    await rejects((repos.families as unknown as { constructor: () => Promise<void> }).constructor(), 'not_found');
  });

  it('creates a shared purchase and charges each person their share', async () => {
    const { repos, familyId, byName, principal, category } = await signedIn();
    const invoiceId = principal.currentInvoice!.id;
    const before = await repos.invoices.getDetails(invoiceId);
    await repos.purchases.create({
      familyId,
      cardId: principal.card.id,
      merchant: 'Farmácia',
      totalCents: 12000,
      date: purchaseDate(principal.currentInvoice!.closingDate),
      categoryId: category.id,
      buyerMemberId: byName('Ana').id,
      installmentCount: 1,
      shares: [
        { memberId: byName('Avó').id, amountCents: 6000 },
        { memberId: byName('Ana').id, amountCents: 6000 },
      ],
    });
    const after = await repos.invoices.getDetails(invoiceId);
    assert.equal(after.totals.totalCents - before.totals.totalCents, 12000);
    const owed = (invoice: typeof after, name: string) => invoice.balances.find((b) => b.member.displayName === name)!.owedCents;
    assert.equal(owed(after, 'Ana') - owed(before, 'Ana'), 6000);
  });

  it('rejects a split that does not add up and saves nothing', async () => {
    const { repos, familyId, byName, principal, category } = await signedIn();
    const count = async () => (await repos.purchases.search(familyId, {})).length;
    const before = await count();
    await rejects(
      repos.purchases.create({
        familyId,
        cardId: principal.card.id,
        merchant: 'Farmácia',
        totalCents: 12000,
        date: purchaseDate(principal.currentInvoice!.closingDate),
        categoryId: category.id,
        buyerMemberId: byName('Ana').id,
        installmentCount: 1,
        shares: [{ memberId: byName('Ana').id, amountCents: 5000 }],
      }),
      'validation',
    );
    assert.equal(await count(), before);
  });

  it('places installments in consecutive invoices, created on demand', async () => {
    const { repos, familyId, byName, principal, category } = await signedIn();
    const details = await repos.purchases.create({
      familyId,
      cardId: principal.card.id,
      merchant: 'Notebook',
      totalCents: 240000,
      date: purchaseDate(principal.currentInvoice!.closingDate),
      categoryId: category.id,
      buyerMemberId: byName('Maria').id,
      installmentCount: 12,
      shares: [
        { memberId: byName('Maria').id, amountCents: 160000 },
        { memberId: byName('João').id, amountCents: 80000 },
      ],
    });
    assert.equal(new Set(details.installments.map((i) => refKey(i.invoice.ref))).size, 12);
    assert.ok(details.installments.every((i) => i.installment.amountCents === 20000));
    const reloaded = await repos.purchases.get(details.purchase.id);
    assert.equal(reloaded.installments.length, 12);
  });

  it('accepts partial payments and never more than what is owed', async () => {
    const { repos, principal } = await signedIn();
    const invoices = await repos.invoices.listByCard(principal.card.id);
    const collecting = invoices.find((i) => i.invoice.status === 'collecting')!;
    const details = await repos.invoices.getDetails(collecting.invoice.id);
    const lucas = details.balances.find((b) => b.member.displayName === 'Lucas')!;
    assert.equal(lucas.status, 'partial');
    await rejects(repos.payments.register({ invoiceId: collecting.invoice.id, memberId: lucas.memberId, amountCents: lucas.pendingCents + 1 }));
    await repos.payments.register({ invoiceId: collecting.invoice.id, memberId: lucas.memberId, amountCents: lucas.pendingCents });
    const updated = await repos.invoices.getDetails(collecting.invoice.id);
    assert.equal(updated.balances.find((b) => b.memberId === lucas.memberId)!.status, 'paid');
  });

  it('edits a purchase, regenerates its installments and records the change', async () => {
    const { repos, familyId } = await signedIn();
    const [item] = await repos.purchases.search(familyId, { search: 'Celular' });
    const original = await repos.purchases.get(item.purchase.id);
    const newTotal = original.purchase.totalCents + 1000;
    const shares = original.shares.map((s, index) => ({ memberId: s.member.id, amountCents: s.amountCents + (index === 0 ? 1000 : 0) }));
    const edited = await repos.purchases.update(item.purchase.id, { totalCents: newTotal, shares });
    assert.equal(edited.purchase.totalCents, newTotal);
    assert.equal(
      edited.installments.reduce((sum, i) => sum + i.installment.amountCents, 0),
      newTotal,
    );
    assert.ok(edited.history.some((log) => log.changes.some((c) => c.field === 'Valor')));
  });

  it('keeps the seeded audit trail with the actor name', async () => {
    const { repos, familyId } = await signedIn();
    const mercado = await repos.purchases.search(familyId, { search: 'Mercado' });
    const histories = await Promise.all(mercado.map((r) => repos.purchases.get(r.purchase.id)));
    const change = histories.flatMap((h) => h.history.flatMap((log) => log.changes)).find((c) => c.field === 'Valor');
    assert.deepEqual(change, { field: 'Valor', from: 'R$ 340,00', to: 'R$ 320,00' });
  });

  it('protects purchases of closed invoices from regular members', async () => {
    const { repos, familyId } = await signedIn('maria@wallit.app');
    const results = await repos.purchases.search(familyId, {});
    const details = await Promise.all(results.map((r) => repos.purchases.get(r.purchase.id)));
    const locked = details.find((d) => d.installments.every((i) => i.invoice.status === 'paid'))!;
    assert.equal(locked.canEdit, false);
    await rejects(repos.purchases.update(locked.purchase.id, { merchant: 'X' }));
  });

  it('isolates families and lets people join with an invite code', async () => {
    const lucas = await signedIn();
    const pedro = client();
    await pedro.auth.signUp({ name: 'Pedro', email: 'pedro@example.com', password: '123456' });
    assert.deepEqual(await pedro.families.listMine(), []);
    await rejects(pedro.families.get(lucas.familyId));
    const [someone] = await lucas.repos.purchases.search(lucas.familyId, {});
    await rejects(pedro.purchases.get(someone.purchase.id));
    await rejects(
      pedro.purchases.cancel(someone.purchase.id),
    );

    const { code } = await lucas.repos.families.createInvite(lucas.familyId);
    await pedro.families.joinByCode(code.toLowerCase());
    const [joined] = await pedro.families.listMine();
    assert.equal(joined.family.id, lucas.familyId);
    assert.equal(joined.me.role, 'member');
  });

  it('rejects duplicate sign-ups', async () => {
    await rejects(client().auth.signUp({ name: 'Outro', email: DEMO_ACCOUNT.email, password: '123456' }), 'email_taken');
  });

  it('updates the profile and the name shown in the family', async () => {
    const { repos, familyId } = await signedIn();
    await repos.auth.updateProfile({ name: 'Lucas Silva', pixKey: '11999999999' });
    const session = await repos.auth.getSession();
    assert.equal(session?.user.name, 'Lucas Silva');
    assert.equal(session?.user.pixKey, '11999999999');
    const members = await repos.families.listMembers(familyId);
    assert.ok(members.some((m) => m.displayName === 'Lucas Silva'));
  });

  it('saves the profile photo and shows it to the family', async () => {
    const lucas = await signedIn();
    const photo = 'data:image/jpeg;base64,' + 'A'.repeat(2000);
    await lucas.repos.auth.updateProfile({ photo });
    assert.equal((await lucas.repos.auth.getSession())?.user.photo, photo);
    const maria = await signedIn('maria@wallit.app');
    const members = await maria.repos.families.listMembers(maria.familyId);
    assert.equal(members.find((m) => m.displayName === 'Lucas')?.photo, photo);

    await rejects(lucas.repos.auth.updateProfile({ photo: 'https://example.com/x.png' }), 'validation');
    await rejects(lucas.repos.auth.updateProfile({ photo: 'data:image/jpeg;base64,' + 'A'.repeat(300_000) }), 'validation');

    await lucas.repos.auth.updateProfile({ photo: '' });
    assert.equal((await lucas.repos.auth.getSession())?.user.photo, undefined);
    const after = await maria.repos.families.listMembers(maria.familyId);
    assert.equal(after.find((m) => m.displayName === 'Lucas')?.photo, undefined);
  });

  it('does not lose writes when two purchases are saved at the same time', async () => {
    const { repos, familyId, byName, principal, category } = await signedIn();
    const before = (await repos.purchases.search(familyId, {})).length;
    const create = (merchant: string) =>
      repos.purchases.create({
        familyId,
        cardId: principal.card.id,
        merchant,
        totalCents: 1000,
        date: purchaseDate(principal.currentInvoice!.closingDate),
        categoryId: category.id,
        buyerMemberId: byName('Lucas').id,
        installmentCount: 3,
        shares: [{ memberId: byName('Lucas').id, amountCents: 1000 }],
      });
    await Promise.all([create('Padaria'), create('Banca'), create('Feira')]);
    assert.equal((await repos.purchases.search(familyId, {})).length, before + 3);
  });

  it('restores the original path after the Vercel rewrite', async () => {
    const rewritten = restoreRewrittenUrl(new Request('https://wallit.test/api?__path=auth/get-session&x=1'));
    assert.equal(rewritten.url, 'https://wallit.test/api/auth/get-session?x=1');
    const untouched = new Request('https://wallit.test/api/health');
    assert.equal(restoreRewrittenUrl(untouched), untouched);
    const res = await app.fetch(restoreRewrittenUrl(new Request('https://wallit.test/api?__path=health')));
    const body = (await res.json()) as { ok: boolean; checks: Record<string, string> };
    assert.deepEqual(body, { ok: true, checks: { api: 'ok', database: 'ok', auth: 'ok' } });
  });

  it('signs out', async () => {
    const { repos } = await signedIn();
    await repos.auth.signOut();
    assert.equal(await repos.auth.getSession(), null);
  });

  it('refuses unbalanced purchases at the database level', async () => {
    const { repos, familyId } = await signedIn();
    const [item] = await repos.purchases.search(familyId, {});
    await assert.rejects(
      getDb().execute(sql`update purchase_shares set amount_cents = amount_cents + 1 where purchase_id = ${item.purchase.id}`),
      (error: Error) => /shares add up/.test(String((error.cause as Error | undefined)?.message)),
    );
  });

  it('counts a member transfer only after the holder confirms it, and notifies both sides', async () => {
    const maria = await signedIn('maria@wallit.app');
    const invoiceId = maria.principal.currentInvoice!.id;
    const lucas = await signedIn();
    await lucas.repos.invoices.changeStatus(invoiceId, 'reviewing');
    await lucas.repos.invoices.changeStatus(invoiceId, 'closed');

    const before = await maria.repos.invoices.getDetails(invoiceId);
    const payment = await maria.repos.payments.register({ invoiceId, memberId: before.me.id, amountCents: 1000, note: 'PIX' });
    assert.equal(payment.status, 'pending');
    const waiting = await maria.repos.invoices.getDetails(invoiceId);
    assert.equal(waiting.invoice.status, 'collecting');
    assert.equal(waiting.totals.receivedCents, before.totals.receivedCents);
    assert.equal(waiting.totals.awaitingCents, 1000);

    // The holder (Avó) has no account: the owner gets the notice and confirms.
    const [notice] = await lucas.repos.notifications.list();
    assert.equal(notice.type, 'payment_registered');
    await rejects(maria.repos.payments.confirm(payment.id), 'forbidden');
    await lucas.repos.payments.confirm(payment.id);
    const confirmed = await maria.repos.invoices.getDetails(invoiceId);
    assert.equal(confirmed.totals.receivedCents, before.totals.receivedCents + 1000);
    assert.equal((await maria.repos.notifications.list())[0].type, 'payment_confirmed');
  });

  it('runs an invoice review with a dispute that blocks closing until answered', async () => {
    const lucas = await signedIn();
    const maria = await signedIn('maria@wallit.app');
    const invoiceId = lucas.principal.currentInvoice!.id;
    await lucas.repos.invoices.changeStatus(invoiceId, 'reviewing');
    assert.equal((await maria.repos.notifications.list())[0].type, 'review_started');

    const details = await maria.repos.invoices.getDetails(invoiceId);
    const mine = details.lines.filter((line) => line.review.awaitingMe);
    assert.ok(mine.length >= 2);
    await maria.repos.reviews.confirm(invoiceId, mine[0].purchase.id);
    const dispute = await maria.repos.reviews.dispute(invoiceId, mine[1].purchase.id, { reason: 'wrong_amount', note: 'Cobrado duas vezes' });
    await rejects(lucas.repos.invoices.changeStatus(invoiceId, 'closed'), 'validation');
    await rejects(maria.repos.reviews.resolve(dispute.id, 'ok'), 'forbidden');
    await lucas.repos.reviews.resolve(dispute.id, 'Estorno pedido ao banco');
    await lucas.repos.invoices.changeStatus(invoiceId, 'closed');

    const reloaded = await lucas.repos.purchases.get(mine[1].purchase.id);
    assert.equal(reloaded.disputes[0].review.resolutionNote, 'Estorno pedido ao banco');
    const types = (await maria.repos.notifications.list()).map((n) => n.type);
    assert.ok(types.includes('dispute_resolved') && types.includes('amount_defined'));
    await maria.repos.notifications.markRead();
    assert.equal(await maria.repos.notifications.unreadCount(), 0);
  });

  it('stores attachments apart from the purchase and opens them only for the family', async () => {
    const lucas = await signedIn();
    const [item] = await lucas.repos.purchases.search(lucas.familyId, { search: 'Amazon' });
    const dataUrl = 'data:image/jpeg;base64,' + 'B'.repeat(4000);
    const attachment = await lucas.repos.attachments.add({ purchaseId: item.purchase.id, name: 'cupom.jpg', mimeType: 'image/jpeg', dataUrl });
    assert.equal((await lucas.repos.purchases.get(item.purchase.id)).attachments[0].id, attachment.id);
    assert.equal((await lucas.repos.attachments.getData(attachment.id)).dataUrl, dataUrl);

    const pedro = client();
    await pedro.auth.signUp({ name: 'Pedro', email: 'pedro2@example.com', password: '123456' });
    await rejects(pedro.attachments.getData(attachment.id));

    await rejects(
      lucas.repos.attachments.add({ purchaseId: item.purchase.id, name: 'x', mimeType: 'image/jpeg', dataUrl: 'data:image/jpeg;base64,' + 'A'.repeat(3_000_001) }),
      'validation',
    );
  });

  it('learns aliases and keeps notification settings in the session', async () => {
    const lucas = await signedIn();
    const aliases = await lucas.repos.aliases.list(lucas.familyId);
    assert.ok(aliases.some((a) => a.statementName === 'JANUARIO DA SILVEIRA' && a.merchant === 'Mercado Três Amigos'));
    await lucas.repos.aliases.save(lucas.familyId, 'uber *trip', 'Uber');
    assert.equal((await lucas.repos.aliases.list(lucas.familyId)).filter((a) => a.statementName === 'UBER *TRIP').length, 1);

    await lucas.repos.auth.updateProfile({ notificationPrefs: { purchases: false, reminders: true } });
    const session = await lucas.repos.auth.getSession();
    assert.deepEqual(session?.user.notificationPrefs, { purchases: false, reminders: true });
  });

  it('computes statistics on the server like on the device', async () => {
    const lucas = await signedIn();
    const ref = lucas.principal.currentInvoice!.ref;
    const stats = await lucas.repos.statistics.get(lucas.familyId, { from: ref, to: ref, cardId: lucas.principal.card.id });
    const details = await lucas.repos.invoices.getDetails(lucas.principal.currentInvoice!.id);
    assert.equal(stats.totalCents, details.totals.totalCents);
  });

  it('sends due date reminders once, from the daily job', async () => {
    const lucas = await signedIn();
    const invoices = await lucas.repos.invoices.listByCard(lucas.principal.card.id);
    const collecting = invoices.find((i) => i.invoice.status === 'collecting')!.invoice;
    const [year, month, day] = collecting.dueDate.split('-').map(Number);
    const twoDaysBefore = new Date(Date.UTC(year, month - 1, day - 2)).toISOString().slice(0, 10);

    const first = await runDailyReminders(getDb(), twoDaysBefore);
    assert.equal(first.families, 1);
    const again = await runDailyReminders(getDb(), twoDaysBefore);
    assert.equal(again.sent, 0);
    const reminders = (await lucas.repos.notifications.list()).filter((n) => n.type === 'due_reminder');
    assert.equal(reminders.length, 1);
  });

  it('accepts Web Push subscriptions from signed-in users', async () => {
    const lucas = await signedIn();
    const key = await lucas.repos.push.publicKey();
    assert.ok(key && Buffer.from(key, 'base64url').length === 65);
    await lucas.repos.push.subscribe({ endpoint: 'https://push.example.com/abc', keys: { p256dh: 'x', auth: 'y' } });
    assert.equal((await getDb().select().from(t.pushSubscriptions)).length, 1);
    await rejects(client().push.subscribe({ endpoint: 'https://push.example.com/abc', keys: { p256dh: 'x', auth: 'y' } }));
    await lucas.repos.push.unsubscribe('https://push.example.com/abc');
    assert.equal((await getDb().select().from(t.pushSubscriptions)).length, 0);
  });
});
