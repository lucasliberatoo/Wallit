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

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function filterLines(lines: InvoiceLine[], search: string): InvoiceLine[] {
  const term = normalize(search.trim());
  if (!term) return lines;
  return lines.filter((line) =>
    normalize(
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

export function groupLines(lines: InvoiceLine[], groupBy: GroupBy): LineGroup[] {
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
    totalCents: sumCents(group.lines.map((l) => l.installment.amountCents)),
  }));
  return groupBy === 'date' ? result.sort((a, b) => b.key.localeCompare(a.key)) : result.sort((a, b) => b.totalCents - a.totalCents);
}
