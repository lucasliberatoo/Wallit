import { allocateProportionally, formatBRL, parseMoneyInput, splitEvenly, sumCents } from '../money';

describe('money', () => {
  it('formats BRL with thousands separator', () => {
    expect(formatBRL(0)).toBe('R$ 0,00');
    expect(formatBRL(5990)).toBe('R$ 59,90');
    expect(formatBRL(482000)).toBe('R$ 4.820,00');
    expect(formatBRL(123456789)).toBe('R$ 1.234.567,89');
    expect(formatBRL(-5000)).toBe('-R$ 50,00');
    expect(formatBRL(5000, { symbol: false })).toBe('50,00');
  });

  it('parses typed digits from the right', () => {
    expect(parseMoneyInput('')).toBe(0);
    expect(parseMoneyInput('1')).toBe(1);
    expect(parseMoneyInput('12000')).toBe(12000);
    expect(parseMoneyInput('R$ 1.200,50')).toBe(120050);
  });

  it('splits evenly with leftover cents on the first parts', () => {
    expect(splitEvenly(10000, 3)).toEqual([3334, 3333, 3333]);
    expect(sumCents(splitEvenly(10000, 3))).toBe(10000);
    expect(splitEvenly(12000, 2)).toEqual([6000, 6000]);
  });

  it('allocates proportionally and always sums to the total', () => {
    expect(allocateProportionally(20000, [4000, 8000])).toEqual([6667, 13333]);
    for (const total of [1, 7, 999, 12345, 100001]) {
      const parts = allocateProportionally(total, [1, 2, 3, 7]);
      expect(sumCents(parts)).toBe(total);
      expect(parts.every((part) => part >= 0)).toBe(true);
    }
  });

  it('rejects invalid weights', () => {
    expect(() => allocateProportionally(100, [])).toThrow();
    expect(() => allocateProportionally(100, [0, 0])).toThrow();
  });
});
