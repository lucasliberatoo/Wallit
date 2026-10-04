import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Repositories } from '../repositories';
import type { TokenStorage } from './client';
import { createHttpRepositories as createWith } from './repositories';

const TOKEN_KEY = 'wallit:auth-token';

const asyncStorageTokens: TokenStorage = {
  get: () => AsyncStorage.getItem(TOKEN_KEY),
  set: (token) => (token ? AsyncStorage.setItem(TOKEN_KEY, token) : AsyncStorage.removeItem(TOKEN_KEY)),
};

/** The API-backed repositories, keeping the session token on the device. */
export function createHttpRepositories(apiUrl: string): Repositories {
  return createWith(apiUrl, asyncStorageTokens);
}
