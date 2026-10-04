import { identityColors } from '@/theme/colors';
import { AppError } from '../errors';
import type { AuthRepository } from '../repositories';
import type { MockUser } from './database';
import { newId, type MockStore } from './store';

function publicUser({ password: _password, ...user }: MockUser) {
  return user;
}

export function createMockAuthRepository(store: MockStore): AuthRepository {
  const sessionFor = (user: MockUser) => ({ user: publicUser(user) });

  return {
    getSession: () =>
      store.run(() => {
        const user = store.db.users.find((u) => u.id === store.db.sessionUserId);
        return user ? sessionFor(user) : null;
      }),

    signIn: (email, password) =>
      store.run(
        () => {
          const user = store.db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
          if (!user || user.password !== password) {
            throw new AppError('invalid_credentials', 'Email ou senha incorretos.');
          }
          store.db.sessionUserId = user.id;
          return sessionFor(user);
        },
        { write: true },
      ),

    signUp: ({ name, email, password }) =>
      store.run(
        () => {
          const normalized = email.trim().toLowerCase();
          if (store.db.users.some((u) => u.email.toLowerCase() === normalized)) {
            throw new AppError('email_taken', 'Já existe uma conta com este email.');
          }
          const user: MockUser = {
            id: newId('usr'),
            name: name.trim(),
            email: normalized,
            password,
            avatarColor: identityColors[store.db.users.length % identityColors.length],
          };
          store.db.users.push(user);
          store.db.sessionUserId = user.id;
          return sessionFor(user);
        },
        { write: true },
      ),

    signOut: () =>
      store.run(
        () => {
          store.db.sessionUserId = null;
        },
        { write: true },
      ),

    requestPasswordReset: () =>
      // The real backend sends an email; the offline mock only acknowledges.
      store.run(() => undefined),

    updateProfile: (changes) =>
      store.run(
        () => {
          const user = store.require('users', store.currentUserId(), 'Usuário') as MockUser;
          Object.assign(user, changes);
          if (changes.name) {
            store.db.members
              .filter((m) => m.userId === user.id)
              .forEach((m) => {
                m.displayName = changes.name!;
              });
          }
          return publicUser(user);
        },
        { write: true },
      ),
  };
}
