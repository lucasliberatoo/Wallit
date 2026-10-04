import { can, type Family, type FamilyMember, ROLE_LABEL } from '../../domain';
import { identityColors } from '../../theme/colors';
import { AppError } from '../errors';
import type { FamilySummary } from '../models';
import type { FamilyRepository } from '../repositories';
import { newId, nowISO, type Store } from './store';
import type { StoredUser } from './database';
import { seedDefaultCategories } from './seed-categories';

export function createFamilyRepository(store: Store): FamilyRepository {
  const summary = (family: Family, me: FamilyMember): FamilySummary => ({
    family,
    me,
    memberCount: store.activeMembers(family.id).length,
    walletCount: store.db.wallets.filter((w) => w.familyId === family.id && !w.deletedAt).length,
  });

  const requireManager = (familyId: string) => {
    const me = store.requireMembership(familyId);
    if (!can(me.role, 'member.manage')) throw new AppError('forbidden', 'Apenas o dono da família pode fazer isso.');
    return me;
  };

  return {
    listMine: () =>
      store.run(() => {
        const userId = store.currentUserId();
        return store.db.members
          .filter((m) => m.userId === userId && m.status === 'active')
          .map((me) => summary(store.require('families', me.familyId, 'Família') as Family, me));
      }),

    get: (familyId) =>
      store.run(() => summary(store.require('families', familyId, 'Família') as Family, store.requireMembership(familyId))),

    create: ({ name, color }) =>
      store.run(
        () => {
          const user = store.require('users', store.currentUserId(), 'Usuário') as StoredUser;
          if (!name.trim()) throw new AppError('validation', 'Dê um nome para a família.');
          const family: Family = { id: newId('fam'), name: name.trim(), color, createdBy: user.id, createdAt: nowISO() };
          store.db.families.push(family);
          store.db.members.push({
            id: newId('mem'),
            familyId: family.id,
            userId: user.id,
            displayName: user.name,
            role: 'owner',
            avatarColor: user.avatarColor,
            photo: user.photo,
            status: 'active',
            joinedAt: nowISO(),
          });
          seedDefaultCategories(store, family.id);
          store.audit({
            familyId: family.id,
            entity: 'family',
            entityId: family.id,
            action: 'created',
            summary: `Família criada: ${family.name}`,
            changes: [],
          });
          return family;
        },
        { write: true },
      ),

    listMembers: (familyId) =>
      store.run(() => {
        store.requireMembership(familyId);
        return store.activeMembers(familyId);
      }),

    addMember: ({ familyId, displayName, role }) =>
      store.run(
        () => {
          requireManager(familyId);
          if (!displayName.trim()) throw new AppError('validation', 'Informe o nome.');
          const member: FamilyMember = {
            id: newId('mem'),
            familyId,
            userId: null,
            displayName: displayName.trim(),
            role,
            avatarColor: identityColors[store.activeMembers(familyId).length % identityColors.length],
            status: 'active',
            joinedAt: nowISO(),
          };
          store.db.members.push(member);
          store.audit({
            familyId,
            entity: 'member',
            entityId: member.id,
            action: 'created',
            summary: `${member.displayName} entrou como ${ROLE_LABEL[role]}`,
            changes: [],
          });
          return member;
        },
        { write: true },
      ),

    updateMemberRole: (memberId, role) =>
      store.run(
        () => {
          const member = store.member(memberId);
          requireManager(member.familyId);
          const before = member.role;
          member.role = role;
          store.audit({
            familyId: member.familyId,
            entity: 'member',
            entityId: member.id,
            action: 'updated',
            summary: `Papel de ${member.displayName} alterado`,
            changes: [{ field: 'Papel', from: ROLE_LABEL[before], to: ROLE_LABEL[role] }],
          });
          return member;
        },
        { write: true },
      ),

    removeMember: (memberId) =>
      store.run(
        () => {
          const member = store.member(memberId);
          requireManager(member.familyId);
          member.status = 'removed';
          store.audit({
            familyId: member.familyId,
            entity: 'member',
            entityId: member.id,
            action: 'cancelled',
            summary: `${member.displayName} saiu da família`,
            changes: [],
          });
        },
        { write: true },
      ),

    leave: (familyId) =>
      store.run(
        () => {
          const me = store.requireMembership(familyId);
          const owners = store.activeMembers(familyId).filter((m) => m.role === 'owner');
          if (me.role === 'owner' && owners.length === 1 && store.activeMembers(familyId).length > 1) {
            throw new AppError('validation', 'Passe o papel de dono para outra pessoa antes de sair.');
          }
          me.status = 'removed';
        },
        { write: true },
      ),

    createInvite: (familyId) =>
      store.run(
        () => {
          requireManager(familyId);
          const code = Math.random().toString(36).slice(2, 8).toUpperCase();
          store.db.invites.push({ code, familyId, createdAt: nowISO() });
          return { code };
        },
        { write: true },
      ),

    joinByCode: (code) =>
      store.run(
        () => {
          const invite = store.db.invites.find((i) => i.code === code.trim().toUpperCase());
          if (!invite) throw new AppError('invalid_invite', 'Convite inválido ou expirado.');
          const user = store.require('users', store.currentUserId(), 'Usuário') as StoredUser;
          const family = store.require('families', invite.familyId, 'Família') as Family;
          const existing = store.db.members.find((m) => m.familyId === family.id && m.userId === user.id);
          if (existing) {
            existing.status = 'active';
            existing.photo = user.photo;
          } else {
            store.db.members.push({
              id: newId('mem'),
              familyId: family.id,
              userId: user.id,
              displayName: user.name,
              role: 'member',
              avatarColor: user.avatarColor,
              photo: user.photo,
              status: 'active',
              joinedAt: nowISO(),
            });
          }
          return family;
        },
        { write: true },
      ),
  };
}
