import { describeSplit, isSplitComplete, splitEqually, validateSplit } from '../split';

const share = (memberId: string, amountCents: number) => ({ memberId, amountCents });

describe('purchase split', () => {
  it('accepts an exact split (60 + 60 = 120)', () => {
    const result = validateSplit(12000, [share('avo', 6000), share('filha', 6000)]);
    expect(result.status).toBe('complete');
    expect(result.difference).toBe(0);
    expect(describeSplit(result)).toBe('Divisão completa');
  });

  it('accepts a three-way exact split (200 + 150 + 150 = 500)', () => {
    expect(isSplitComplete(50000, [share('lucas', 20000), share('maria', 15000), share('joao', 15000)])).toBe(true);
  });

  it('flags an incomplete split (60 + 50 = 110)', () => {
    const result = validateSplit(12000, [share('avo', 6000), share('filha', 5000)]);
    expect(result.status).toBe('missing');
    expect(result.difference).toBe(1000);
    expect(describeSplit(result)).toBe('Faltam R$ 10,00 para completar a compra.');
  });

  it('flags the 450 of 500 example with the missing amount', () => {
    const result = validateSplit(50000, [share('lucas', 20000), share('maria', 10000), share('joao', 15000)]);
    expect(describeSplit(result)).toBe('Faltam R$ 50,00 para completar a compra.');
  });

  it('flags an exceeding split (60 + 80 = 140)', () => {
    const result = validateSplit(12000, [share('avo', 6000), share('filha', 8000)]);
    expect(result.status).toBe('exceeding');
    expect(result.difference).toBe(-2000);
    expect(describeSplit(result)).toBe('A divisão passou R$ 20,00 do valor da compra.');
  });

  it('rejects negative values, duplicates, empty shares and missing participants', () => {
    expect(validateSplit(12000, [share('a', -100), share('b', 12100)]).issues).toContain('invalid_amount');
    expect(validateSplit(12000, [share('a', 6000), share('a', 6000)]).issues).toContain('duplicate_member');
    expect(validateSplit(12000, [share('a', 12000), share('b', 0)]).issues).toContain('empty_share');
    expect(validateSplit(12000, []).status).toBe('invalid');
    expect(validateSplit(0, [share('a', 0)]).status).toBe('invalid');
  });

  it('splits equally with exact cents', () => {
    const shares = splitEqually(10000, ['a', 'b', 'c']);
    expect(shares.map((s) => s.amountCents)).toEqual([3334, 3333, 3333]);
    expect(isSplitComplete(10000, shares)).toBe(true);
  });
});
