import type { InvoiceLine } from '@/data';
import { sumCents } from '@/domain';
import { formatLongDate } from '@/utils/dates';

export type GroupBy = 'date' | 'category';

export interface LineGroup {
  key: string;
  title: string;
  totalCents: number;
  lines: InvoiceLine[];
}

export function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function filterLines(lines: InvoiceLine[], search: string): InvoiceLine[] {
  const term = normalizeText(search.trim());
  if (!term) return lines;
  return lines.filter((line) =>
    normalizeText(
      [
        line.purchase.merchant,
        line.purchase.statementName,
        line.category?.name,
        line.buyer.displayName,
        ...line.shares.map((s) => s.member.displayName),
      ]
        .filter(Boolean)
        .join(' '),
    ).includes(term),
  );
}

/** What one member pays of a line (0 when they are not a payer). */
export function memberShareCents(line: InvoiceLine, memberId: string): number {
  return sumCents(line.shares.filter((s) => s.member.id === memberId).map((s) => s.amountCents));
}

/** Lines a member pays part of: their own invoice inside the card's invoice. */
export function memberLines(lines: InvoiceLine[], memberId: string): InvoiceLine[] {
  return lines.filter((line) => memberShareCents(line, memberId) > 0);
}

/** "50%", "33,3%": the member's part of the line, for the explanation. */
export function sharePercentLabel(shareCents: number, totalCents: number): string {
  if (totalCents <= 0) return '0%';
  const percent = Math.round((shareCents / totalCents) * 1000) / 10;
  return `${String(percent).replace('.', ',')}%`;
}

/**
 * Groups lines by date or category. With `memberId`, each group's total is
 * that member's share, so the groups add up to what they owe.
 */
export function groupLines(lines: InvoiceLine[], groupBy: GroupBy, memberId?: string): LineGroup[] {
  const groups = new Map<string, LineGroup>();
  for (const line of lines) {
    const key = groupBy === 'date' ? line.purchase.date : (line.category?.id ?? 'none');
    const title = groupBy === 'date' ? formatLongDate(line.purchase.date) : (line.category?.name ?? 'Sem categoria');
    const group = groups.get(key) ?? { key, title, totalCents: 0, lines: [] };
    group.lines.push(line);
    groups.set(key, group);
  }
  const result = [...groups.values()].map((group) => ({
    ...group,
    totalCents: sumCents(group.lines.map((l) => (memberId ? memberShareCents(l, memberId) : l.installment.amountCents))),
  }));
  return groupBy === 'date' ? result.sort((a, b) => b.key.localeCompare(a.key)) : result.sort((a, b) => b.totalCents - a.totalCents);
}
