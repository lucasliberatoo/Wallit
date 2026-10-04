import { monthName, parseISODate } from '@/domain';

const SHORT_MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** 05/09 */
export function formatShortDate(date: string): string {
  const { month, day } = parseISODate(date);
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
}

/** 05/09/2026 */
export function formatDate(date: string): string {
  const { year } = parseISODate(date);
  return `${formatShortDate(date)}/${year}`;
}

/** 05 de setembro */
export function formatLongDate(date: string): string {
  const { month, day } = parseISODate(date);
  return `${String(day).padStart(2, '0')} de ${monthName(month)}`;
}

/** 12 out */
export function formatDayMonth(date: string): string {
  const { month, day } = parseISODate(date);
  return `${day} ${SHORT_MONTHS[month - 1]}`;
}

/** 10/08/2026 18:32 */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function todayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function greeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function addDaysISO(date: string, days: number): string {
  const { year, month, day } = parseISODate(date);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** Parses "05/09/2026" (or "05/09", assuming the current year) into ISO. */
export function parseBRDate(text: string, referenceYear = new Date().getFullYear()): string | null {
  const match = text.trim().match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  let year = match[3] ? Number(match[3]) : referenceYear;
  if (year < 100) year += 2000;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

/** "agora", "há 5 min", "há 3 h", "ontem", "há 4 dias", then the date. */
export function formatRelative(iso: string, now = new Date()): string {
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'ontem';
  if (days < 7) return `há ${days} dias`;
  return formatDateTime(iso);
}
