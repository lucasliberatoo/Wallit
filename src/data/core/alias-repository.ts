import { can, type ID, type MerchantAlias, normalizeStatementName, type Purchase } from '../../domain';
import { AppError } from '../errors';
import type { AliasRepository } from '../repositories';
import { newId, nowISO, type Store } from './store';

export function findAlias(store: Store, familyId: ID, statementName: string | undefined): MerchantAlias | undefined {
  if (!statementName) return undefined;
  const key = normalizeStatementName(statementName);
  return key ? store.db.aliases.find((a) => a.familyId === familyId && a.statementName === key) : undefined;
}

/**
 * Creates or updates the alias, and renames purchases still showing the raw
 * statement name, so "JANUARIO DA SILVEIRA" shows up as "Mercado Três Amigos".
 */
export function saveAlias(store: Store, familyId: ID, statementName: string, merchant: string, actorUserId: ID): MerchantAlias {
  const key = normalizeStatementName(statementName);
  const name = merchant.trim();
  if (!key) throw new AppError('validation', 'Informe o nome que aparece na fatura.');
  if (!name) throw new AppError('validation', 'Informe como vocês conhecem o lugar.');

  let alias = findAlias(store, familyId, statementName);
  if (alias) {
    alias.merchant = name;
  } else {
    alias = { id: newId('als'), familyId, statementName: key, merchant: name, createdBy: actorUserId, createdAt: nowISO() };
    store.db.aliases.push(alias);
  }

  const raw = (purchase: Purchase) => normalizeStatementName(purchase.merchant) === key;
  for (const purchase of store.db.purchases) {
    if (purchase.familyId !== familyId || !purchase.statementName) continue;
    if (normalizeStatementName(purchase.statementName) === key && raw(purchase)) purchase.merchant = name;
  }
  return alias;
}

/** Remembers the place's name when a purchase has a different statement name. */
export function learnAlias(store: Store, purchase: Purchase, actorUserId: ID): void {
  if (!purchase.statementName) return;
  if (normalizeStatementName(purchase.statementName) === normalizeStatementName(purchase.merchant)) return;
  const existing = findAlias(store, purchase.familyId, purchase.statementName);
  if (existing?.merchant === purchase.merchant) return;
  saveAlias(store, purchase.familyId, purchase.statementName, purchase.merchant, actorUserId);
}

export function createAliasRepository(store: Store): AliasRepository {
  const requireEditor = (familyId: ID) => {
    const me = store.requireMembership(familyId);
    if (!can(me.role, 'purchase.create')) throw new AppError('forbidden', 'Você não pode alterar apelidos.');
  };

  return {
    list: (familyId) =>
      store.run(() => {
        store.requireMembership(familyId);
        return store.db.aliases.filter((a) => a.familyId === familyId).sort((a, b) => a.merchant.localeCompare(b.merchant, 'pt-BR'));
      }),

    save: (familyId, statementName, merchant) =>
      store.run(
        () => {
          requireEditor(familyId);
          const alias = saveAlias(store, familyId, statementName, merchant, store.currentUserId());
          store.audit({
            familyId,
            entity: 'alias',
            entityId: alias.id,
            action: 'updated',
            summary: `${alias.statementName} agora aparece como ${alias.merchant}`,
            changes: [],
          });
          return alias;
        },
        { write: true },
      ),

    remove: (aliasId) =>
      store.run(
        () => {
          const alias = store.require('aliases', aliasId, 'Apelido') as MerchantAlias;
          requireEditor(alias.familyId);
          // Purchases keep the name they already show; only future matches change.
          store.db.aliases = store.db.aliases.filter((a) => a.id !== aliasId);
          store.audit({
            familyId: alias.familyId,
            entity: 'alias',
            entityId: alias.id,
            action: 'removed',
            summary: `Apelido removido: ${alias.statementName}`,
            changes: [],
          });
        },
        { write: true },
      ),
  };
}
