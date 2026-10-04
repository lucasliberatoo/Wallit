import AsyncStorage from '@react-native-async-storage/async-storage';

import { type Database, migrateDatabase } from '../core/database';
import type { Persistence } from '../core/store';

const STORAGE_KEY = 'wallit:mock-db';

/** Keeps the offline mock database on the device between app launches. */
export const asyncStoragePersistence: Persistence = {
  async load() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return migrateDatabase(JSON.parse(raw) as Database);
    } catch {
      return null;
    }
  },
  async save(db) {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch {
      // Persistence is a convenience for the offline mock; the app keeps working in memory.
    }
  },
};
