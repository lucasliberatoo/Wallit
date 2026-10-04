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
