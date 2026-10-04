import { addMonths, closingDateFor, dueDateFor, formatRef, invoiceRefForDate, refKey } from '../invoice-period';

describe('invoice period', () => {
  it('assigns purchases to the closing month', () => {
    expect(refKey(invoiceRefForDate('2026-08-10', 25))).toBe('2026-08');
    expect(refKey(invoiceRefForDate('2026-08-25', 25))).toBe('2026-09');
    expect(refKey(invoiceRefForDate('2026-12-28', 25))).toBe('2027-01');
  });

  it('clamps closing day 31 to short months', () => {
    expect(closingDateFor({ year: 2026, month: 2 }, 31)).toBe('2026-02-28');
    expect(refKey(invoiceRefForDate('2026-02-28', 31))).toBe('2026-03');
  });

  it('computes the due date in the following month when needed', () => {
    expect(dueDateFor({ year: 2026, month: 8 }, 25, 5)).toBe('2026-09-05');
    expect(dueDateFor({ year: 2026, month: 8 }, 3, 10)).toBe('2026-08-10');
  });

  it('adds months across years', () => {
    expect(addMonths({ year: 2026, month: 11 }, 3)).toEqual({ year: 2027, month: 2 });
    expect(addMonths({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
  });

  it('formats a ref', () => {
    expect(formatRef({ year: 2026, month: 8 }, { capitalize: true })).toBe('Agosto/2026');
  });
});
