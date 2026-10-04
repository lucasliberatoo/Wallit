import type { ISODate } from './types';

/**
 * Identifies an invoice by its closing month. "Fatura de agosto/2026" closes
 * in August and is due on the card's due day (usually early September).
 */
export interface InvoiceRef {
  year: number;
  /** 1-12 */
  month: number;
}

const MONTH_NAMES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
] as const;

export function refKey(ref: InvoiceRef): string {
  return `${ref.year}-${String(ref.month).padStart(2, '0')}`;
}

export function refFromKey(key: string): InvoiceRef {
  const [year, month] = key.split('-').map(Number);
  return { year, month };
}

export function addMonths(ref: InvoiceRef, months: number): InvoiceRef {
  const index = ref.year * 12 + (ref.month - 1) + months;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function compareRefs(a: InvoiceRef, b: InvoiceRef): number {
  return a.year - b.year || a.month - b.month;
}

export function monthName(month: number): string {
  return MONTH_NAMES[month - 1];
}

export function formatRef(ref: InvoiceRef, options: { capitalize?: boolean } = {}): string {
  const name = monthName(ref.month);
  const label = options.capitalize ? name[0].toUpperCase() + name.slice(1) : name;
  return `${label}/${ref.year}`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function toISODate(year: number, month: number, day: number): ISODate {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function parseISODate(date: ISODate): { year: number; month: number; day: number } {
  const [year, month, day] = date.slice(0, 10).split('-').map(Number);
  return { year, month, day };
}

/** Day clamped to the month length (closing day 31 in February -> 28/29). */
function clampedDate(ref: InvoiceRef, day: number): ISODate {
  return toISODate(ref.year, ref.month, Math.min(day, daysInMonth(ref.year, ref.month)));
}

export function closingDateFor(ref: InvoiceRef, closingDay: number): ISODate {
  return clampedDate(ref, closingDay);
}

/** The due date falls in the following month when the due day is not after the closing day. */
export function dueDateFor(ref: InvoiceRef, closingDay: number, dueDay: number): ISODate {
  const dueRef = dueDay > closingDay ? ref : addMonths(ref, 1);
  return clampedDate(dueRef, dueDay);
}

/**
 * Which invoice a purchase made on `date` belongs to. Purchases made on or
 * after the closing day go to the next month's invoice.
 */
export function invoiceRefForDate(date: ISODate, closingDay: number): InvoiceRef {
  const { year, month, day } = parseISODate(date);
  const ref = { year, month };
  const closing = Math.min(closingDay, daysInMonth(year, month));
  return day >= closing ? addMonths(ref, 1) : ref;
}

export function isValidDayOfMonth(day: number): boolean {
  return Number.isInteger(day) && day >= 1 && day <= 31;
}
