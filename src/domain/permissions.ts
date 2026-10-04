import type { Role } from './types';

export type Action =
  | 'family.manage'
  | 'member.manage'
  | 'wallet.create'
  | 'card.create'
  | 'card.manage'
  | 'invoice.changeStatus'
  | 'invoice.editLocked'
  | 'payment.register'
  | 'purchase.create'
  | 'purchase.edit'
  | 'category.manage'
  | 'family.view';

/**
 * Role-based rules. `isCardHolder` grants the titular powers over their own
 * cards, so a person can be holder in one family and a regular member in another.
 * Kept as data so it can become granular (per-user overrides) later.
 */
const ROLE_ACTIONS: Record<Role, readonly Action[]> = {
  owner: [
    'family.manage',
    'member.manage',
    'wallet.create',
    'card.create',
    'card.manage',
    'invoice.changeStatus',
    'invoice.editLocked',
    'payment.register',
    'purchase.create',
    'purchase.edit',
    'category.manage',
    'family.view',
  ],
  titular: ['card.create', 'purchase.create', 'purchase.edit', 'category.manage', 'family.view'],
  member: ['purchase.create', 'purchase.edit', 'family.view'],
  guest: ['family.view'],
};

const HOLDER_ACTIONS: readonly Action[] = ['card.manage', 'invoice.changeStatus', 'invoice.editLocked', 'payment.register'];

export function can(role: Role, action: Action, context: { isCardHolder?: boolean } = {}): boolean {
  if (ROLE_ACTIONS[role].includes(action)) return true;
  return Boolean(context.isCardHolder) && role !== 'guest' && HOLDER_ACTIONS.includes(action);
}

export const ROLE_LABEL: Record<Role, string> = {
  owner: 'Dono',
  titular: 'Titular',
  member: 'Membro',
  guest: 'Convidado',
};
