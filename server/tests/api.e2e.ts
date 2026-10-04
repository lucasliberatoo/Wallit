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
import { closeDb, getDb } from '../db/client';
import { seedDemo } from '../seed';
import { restoreRewrittenUrl } from '../vercel';

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('Set TEST_DATABASE_URL to a throwaway Postgres database.');
// The database connection is opened lazily, on first use.
process.env.DATABASE_URL = url;

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
    truncate table audit_logs, payments, purchase_installments, purchase_shares, purchases, categories, invoices,
      cards, wallets, family_invites, family_members, families, verification, session, account, "user" cascade`);
  await seedDemo(getDb());
});

after(closeDb);

describe('API', () => {
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
    const maria = details.balances.find((b) => b.member.displayName === 'Maria')!;
    assert.equal(maria.status, 'partial');
    await rejects(repos.payments.register({ invoiceId: collecting.invoice.id, memberId: maria.memberId, amountCents: maria.pendingCents + 1 }));
    await repos.payments.register({ invoiceId: collecting.invoice.id, memberId: maria.memberId, amountCents: maria.pendingCents });
    const updated = await repos.invoices.getDetails(collecting.invoice.id);
    assert.equal(updated.balances.find((b) => b.memberId === maria.memberId)!.status, 'paid');
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
});
