import { computeInvoiceTotals, computeMemberBalances, validatePayment } from '../balances';

describe('member balances', () => {
  const debts = [
    { memberId: 'lucas', amountCents: 50000 },
    { memberId: 'lucas', amountCents: 30000 },
    { memberId: 'maria', amountCents: 60000 },
    { memberId: 'joao', amountCents: 30000 },
    { memberId: 'pedro', amountCents: 90000 },
    { memberId: 'avo', amountCents: 220000 },
  ];

  const balances = computeMemberBalances({
    memberIds: ['avo', 'lucas', 'maria', 'joao', 'pedro', 'ana'],
    holderMemberId: 'avo',
    debts,
    payments: [
      { memberId: 'lucas', amountCents: 80000 },
      { memberId: 'maria', amountCents: 60000 },
      { memberId: 'joao', amountCents: 10000 },
      { memberId: 'joao', amountCents: 5000 },
    ],
  });
  const byId = Object.fromEntries(balances.map((b) => [b.memberId, b]));

  it('sums what each person owes across purchases', () => {
    expect(byId.lucas.owedCents).toBe(80000);
    expect(byId.ana.owedCents).toBe(0);
  });

  it('marks full payment as paid', () => {
    expect(byId.lucas).toMatchObject({ paidCents: 80000, pendingCents: 0, status: 'paid' });
  });

  it('marks partial payments as partial, never as paid', () => {
    expect(byId.joao).toMatchObject({ paidCents: 15000, pendingCents: 15000, status: 'partial' });
  });

  it('marks unpaid and empty members', () => {
    expect(byId.pedro.status).toBe('pending');
    expect(byId.ana.status).toBe('none');
  });

  it('treats the holder share as settled', () => {
    expect(byId.avo).toMatchObject({ owedCents: 220000, pendingCents: 0, status: 'holder' });
  });

  it('computes invoice total, received and pending', () => {
    expect(computeInvoiceTotals(balances)).toMatchObject({
      totalCents: 480000,
      holderShareCents: 220000,
      receivableCents: 260000,
      receivedCents: 155000,
      pendingCents: 105000,
    });
  });

  it('reports full progress when nothing is receivable', () => {
    expect(computeInvoiceTotals([]).progress).toBe(1);
  });
});

describe('payment validation', () => {
  it('allows partial and complete payments', () => {
    expect(validatePayment({ owedCents: 80000, alreadyPaidCents: 0, amountCents: 30000 })).toBeNull();
    expect(validatePayment({ owedCents: 80000, alreadyPaidCents: 30000, amountCents: 50000 })).toBeNull();
  });

  it('never accepts more than what is pending', () => {
    expect(validatePayment({ owedCents: 80000, alreadyPaidCents: 30000, amountCents: 50001 })).toBe('exceeds_pending');
    expect(validatePayment({ owedCents: 80000, alreadyPaidCents: 80000, amountCents: 1 })).toBe('nothing_owed');
  });

  it('rejects zero and negative amounts', () => {
    expect(validatePayment({ owedCents: 80000, alreadyPaidCents: 0, amountCents: 0 })).toBe('invalid_amount');
    expect(validatePayment({ owedCents: 80000, alreadyPaidCents: 0, amountCents: -10 })).toBe('invalid_amount');
  });
});
