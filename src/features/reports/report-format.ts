import type { MonthlyReport } from '@/data';
import { formatBRL, formatRef, INVOICE_STATUS_LABEL } from '@/domain';
import { formatDate } from '@/utils/dates';

/** Pure builders for the monthly report: no React Native imports, so they are easy to test. */

export function reportTitle(report: MonthlyReport): string {
  return `${report.familyName} · ${formatRef(report.ref, { capitalize: true })}`;
}

export function reportFileName(report: MonthlyReport, extension: string): string {
  const family = report.familyName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  const month = `${report.ref.year}-${String(report.ref.month).padStart(2, '0')}`;
  return `wallit-${family || 'familia'}-${month}.${extension}`;
}

/** Short text for the family WhatsApp group. */
export function reportText(report: MonthlyReport): string {
  const lines = [`*Wallit · ${reportTitle(report)}*`, ''];
  for (const person of report.people) {
    const status =
      person.holderOf.length > 0 && person.pendingCents === 0
        ? 'titular'
        : person.pendingCents === 0
          ? 'pago ✅'
          : `falta ${formatBRL(person.pendingCents)}`;
    lines.push(`• ${person.member.displayName}: gastou ${formatBRL(person.spentCents)}, pagou ${formatBRL(person.paidCents)} (${status})`);
  }
  lines.push('');
  for (const invoice of report.invoices) {
    lines.push(`💳 ${invoice.cardName}: ${formatBRL(invoice.totalCents)}, vence ${formatDate(invoice.dueDate)}`);
  }
  return lines.join('\n');
}

const csvCell = (value: string | number) => {
  const text = String(value);
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
const csvMoney = (cents: number) => formatBRL(cents, { symbol: false });

/**
 * Spreadsheet (CSV with ";" and decimal comma, as Excel and Google Sheets
 * expect in Portuguese). The BOM keeps accents readable in Excel.
 */
export function reportCsv(report: MonthlyReport): string {
  const rows: (string | number)[][] = [
    [`Wallit - ${reportTitle(report)}`],
    [],
    ['Pessoa', 'Gastou (R$)', 'Pagou (R$)', 'Aguardando confirmação (R$)', 'Falta pagar (R$)', 'Comprou no cartão (R$)', 'Titular de'],
    ...report.people.map((p) => [
      p.member.displayName,
      csvMoney(p.spentCents),
      csvMoney(p.paidCents),
      csvMoney(p.awaitingCents),
      csvMoney(p.pendingCents),
      csvMoney(p.boughtCents),
      p.holderOf.join(', '),
    ]),
    ['Total', csvMoney(report.totals.spentCents), csvMoney(report.totals.paidCents), '', csvMoney(report.totals.pendingCents)],
    [],
    ['Cartão', 'Titular', 'Vencimento', 'Situação', 'Total (R$)'],
    ...report.invoices.map((i) => [
      i.cardName,
      i.holderName,
      formatDate(i.dueDate),
      INVOICE_STATUS_LABEL[i.status],
      csvMoney(i.totalCents),
    ]),
    [],
    ['Data', 'Estabelecimento', 'Cartão', 'Quem comprou', 'Categoria', 'Parcela', 'Valor (R$)', 'Divisão'],
    ...report.lines.map((l) => [
      formatDate(l.date),
      l.merchant,
      l.cardName,
      l.buyerName,
      l.categoryName ?? '',
      l.installment ?? 'à vista',
      csvMoney(l.amountCents),
      l.shares.map((s) => `${s.name} ${csvMoney(s.amountCents)}`).join(' / '),
    ]),
  ];
  return '﻿' + rows.map((row) => row.map(csvCell).join(';')).join('\r\n');
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

/** Printable page; it becomes the PDF (expo-print on the phone, "Salvar como PDF" on the web). */
export function reportHtml(report: MonthlyReport): string {
  const e = escapeHtml;
  const people = report.people
    .map(
      (p) => `<tr>
  <td><b>${e(p.member.displayName)}</b>${p.holderOf.length ? `<br><small>Titular: ${e(p.holderOf.join(', '))}</small>` : ''}</td>
  <td class="n">${formatBRL(p.spentCents)}</td>
  <td class="n">${formatBRL(p.paidCents)}</td>
  <td class="n ${p.pendingCents > 0 ? 'due' : 'ok'}">${p.pendingCents > 0 ? formatBRL(p.pendingCents) : 'Em dia'}</td>
</tr>`,
    )
    .join('');
  const invoices = report.invoices
    .map(
      (i) =>
        `<tr><td>${e(i.cardName)}</td><td>${e(i.holderName)}</td><td>${formatDate(i.dueDate)}</td><td>${INVOICE_STATUS_LABEL[i.status]}</td><td class="n">${formatBRL(i.totalCents)}</td></tr>`,
    )
    .join('');
  const lines = report.lines
    .map(
      (l) => `<tr>
  <td>${formatDate(l.date)}</td>
  <td>${e(l.merchant)}${l.installment ? ` <small>(${l.installment})</small>` : ''}<br><small>${e(l.cardName)} · comprou ${e(l.buyerName)}</small></td>
  <td><small>${l.shares.map((s) => `${e(s.name)} ${formatBRL(s.amountCents)}`).join('<br>')}</small></td>
  <td class="n">${formatBRL(l.amountCents)}</td>
</tr>`,
    )
    .join('');
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(`Wallit - ${reportTitle(report)}`)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; color: #101828; margin: 24px; font-size: 13px; }
  h1 { font-size: 22px; margin: 0; color: #155EEF; }
  h2 { font-size: 15px; margin: 24px 0 8px; }
  .sub { color: #667085; margin: 4px 0 16px; }
  .totals { display: flex; gap: 12px; }
  .totals div { flex: 1; border: 1px solid #EAECF0; border-radius: 10px; padding: 10px 12px; }
  .totals span { display: block; color: #667085; font-size: 11px; }
  .totals b { font-size: 16px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 11px; color: #667085; font-weight: 600; border-bottom: 1px solid #D0D5DD; padding: 6px 4px; }
  td { border-bottom: 1px solid #EAECF0; padding: 6px 4px; vertical-align: top; }
  .n { text-align: right; white-space: nowrap; }
  .due { color: #B42318; font-weight: 600; }
  .ok { color: #067647; }
  small { color: #667085; }
  .note { color: #667085; font-size: 11px; margin-top: 24px; }
  tr { page-break-inside: avoid; }
</style></head>
<body>
  <h1>Wallit</h1>
  <p class="sub">${e(reportTitle(report))}${report.restricted ? ' · só a sua parte' : ''}</p>
  <div class="totals">
    <div><span>Gasto total</span><b>${formatBRL(report.totals.spentCents)}</b></div>
    <div><span>Já pago</span><b>${formatBRL(report.totals.paidCents)}</b></div>
    <div><span>Falta pagar</span><b>${formatBRL(report.totals.pendingCents)}</b></div>
  </div>
  <h2>Por pessoa</h2>
  <table><thead><tr><th>Pessoa</th><th class="n">Gastou</th><th class="n">Pagou</th><th class="n">Falta</th></tr></thead><tbody>${people}</tbody></table>
  <h2>Faturas do mês</h2>
  <table><thead><tr><th>Cartão</th><th>Titular</th><th>Vence</th><th>Situação</th><th class="n">Total</th></tr></thead><tbody>${invoices}</tbody></table>
  <h2>Compras</h2>
  <table><thead><tr><th>Data</th><th>Compra</th><th>Divisão</th><th class="n">Valor</th></tr></thead><tbody>${lines}</tbody></table>
  <p class="note">O titular paga o banco direto, então a parte dele já conta como paga. Gerado pelo Wallit em ${formatDate(report.generatedAt.slice(0, 10))}.</p>
</body></html>`;
}
