import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Linking, Platform, Share } from 'react-native';

import { AppError, type MonthlyReport } from '@/data';
import { reportCsv, reportFileName, reportHtml, reportText } from './report-format';

async function shareFile(uri: string, mimeType: string, title: string) {
  if (!(await Sharing.isAvailableAsync())) throw new AppError('validation', 'Não há app para compartilhar este arquivo.');
  await Sharing.shareAsync(uri, {
    mimeType,
    dialogTitle: title,
    UTI: mimeType === 'application/pdf' ? 'com.adobe.pdf' : 'public.comma-separated-values-text',
  });
}

/** PDF: shared from the phone (WhatsApp, Drive…); on the web the print dialog offers "Salvar como PDF". */
export async function shareReportPdf(report: MonthlyReport): Promise<void> {
  const html = reportHtml(report);
  if (Platform.OS === 'web') {
    const page = window.open('', '_blank');
    if (!page) throw new AppError('validation', 'O navegador bloqueou a janela. Permita pop-ups para o Wallit e tente de novo.');
    page.document.write(html);
    page.document.close();
    page.focus();
    setTimeout(() => page.print(), 300);
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  const file = new File(Paths.cache, reportFileName(report, 'pdf'));
  if (file.exists) file.delete();
  new File(uri).move(file);
  await shareFile(file.uri, 'application/pdf', 'Relatório do mês');
}

/** Spreadsheet (CSV) that opens in Excel and Google Sheets. */
export async function shareReportCsv(report: MonthlyReport): Promise<void> {
  const csv = reportCsv(report);
  const name = reportFileName(report, 'csv');
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(csv);
  await shareFile(file.uri, 'text/csv', 'Planilha do mês');
}

/** Summary text straight to WhatsApp (share sheet on the phone). */
export async function shareReportText(report: MonthlyReport): Promise<void> {
  const text = reportText(report);
  if (Platform.OS === 'web') {
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    if (!window.open(url, '_blank')) await Linking.openURL(url);
    return;
  }
  await Share.share({ message: text });
}
