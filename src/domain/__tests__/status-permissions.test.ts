import { canTransition, isInvoiceLocked, nextInvoiceStatus } from '../invoice-status';
import { can } from '../permissions';

describe('invoice status', () => {
  it('follows the flow', () => {
    expect(nextInvoiceStatus('open')).toBe('reviewing');
    expect(nextInvoiceStatus('collecting')).toBe('paid');
    expect(nextInvoiceStatus('archived')).toBeNull();
    expect(canTransition('open', 'paid')).toBe(false);
    expect(canTransition('closed', 'open')).toBe(true);
  });

  it('locks purchases once closed', () => {
    expect(isInvoiceLocked('open')).toBe(false);
    expect(isInvoiceLocked('reviewing')).toBe(false);
    expect(isInvoiceLocked('closed')).toBe(true);
    expect(isInvoiceLocked('paid')).toBe(true);
  });
});

describe('permissions', () => {
  it('lets only owners manage members', () => {
    expect(can('owner', 'member.manage')).toBe(true);
    expect(can('member', 'member.manage')).toBe(false);
  });

  it('gives holder powers only on own cards', () => {
    expect(can('member', 'payment.register', { isCardHolder: true })).toBe(true);
    expect(can('member', 'payment.register')).toBe(false);
    expect(can('guest', 'payment.register', { isCardHolder: true })).toBe(false);
  });
});
