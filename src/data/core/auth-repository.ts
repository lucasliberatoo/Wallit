import { NOTIFICATION_CATEGORY_LABEL, type NotificationPrefs, PROFILE_PHOTO_MAX_LENGTH } from '../../domain';
import { identityColors } from '../../theme/colors';
import { AppError } from '../errors';
import type { AuthRepository } from '../repositories';
import type { StoredUser } from './database';
import { newId, type Store } from './store';

/** Keeps only known categories with boolean values. */
function cleanPrefs(prefs: NotificationPrefs): NotificationPrefs {
  return Object.fromEntries(
    Object.entries(prefs).filter(([key, value]) => key in NOTIFICATION_CATEGORY_LABEL && typeof value === 'boolean'),
  ) as NotificationPrefs;
}

function publicUser({ password: _password, ...user }: StoredUser) {
  return user;
}

export function createAuthRepository(store: Store): AuthRepository {
  const sessionFor = (user: StoredUser) => ({ user: publicUser(user) });

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
          const user: StoredUser = {
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
          const user = store.require('users', store.currentUserId(), 'Usuário') as StoredUser;
          const { photo, notificationPrefs, ...rest } = changes;
          if (notificationPrefs) user.notificationPrefs = { ...user.notificationPrefs, ...cleanPrefs(notificationPrefs) };
          if (photo !== undefined) {
            if (photo && (!photo.startsWith('data:image/') || photo.length > PROFILE_PHOTO_MAX_LENGTH)) {
              throw new AppError('validation', 'Essa foto não pôde ser usada. Escolha outra imagem.');
            }
            user.photo = photo || undefined;
          }
          Object.assign(user, rest);
          store.db.members
            .filter((m) => m.userId === user.id)
            .forEach((m) => {
              if (changes.name) m.displayName = changes.name;
              if (photo !== undefined) m.photo = user.photo;
            });
          return publicUser(user);
        },
        { write: true },
      ),
  };
}
