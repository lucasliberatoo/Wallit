import type { HomeSummary } from '@/data';

/** Home screen widgets exist only in the Android app; elsewhere this does nothing. */
export async function updateWidget(_familyName: string | null, _home: HomeSummary | null, _hidden: boolean): Promise<void> {}
