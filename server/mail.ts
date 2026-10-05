import nodemailer, { type Transporter } from 'nodemailer';

/**
 * Sends email through any SMTP server (a Gmail app password works for free).
 * Without SMTP_HOST/SMTP_USER/SMTP_PASS nothing is sent and the request is only logged.
 */
let transporter: Transporter | null | undefined;

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    transporter = null;
    return null;
  }
  const port = Number(SMTP_PORT ?? 465);
  transporter = nodemailer.createTransport({ host: SMTP_HOST, port, secure: port === 465, auth: { user: SMTP_USER, pass: SMTP_PASS } });
  return transporter;
}

export function emailConfigured(): boolean {
  return getTransporter() !== null;
}

export async function sendMail(message: { to: string; subject: string; text: string; html: string }): Promise<void> {
  const mailer = getTransporter();
  if (!mailer) {
    console.info(`[mail] SMTP not configured; "${message.subject}" was not sent`);
    return;
  }
  const from = process.env.MAIL_FROM ?? `Wallit <${process.env.SMTP_USER}>`;
  await mailer.sendMail({ from, ...message });
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

export function passwordResetEmail(name: string, url: string) {
  const first = name.split(' ')[0] ?? '';
  return {
    subject: 'Criar uma nova senha no Wallit',
    text: `Oi, ${first}!\n\nPara criar uma nova senha no Wallit, abra este link (vale por 1 hora):\n${url}\n\nSe não foi você que pediu, pode ignorar este email.`,
    html: `<div style="font-family:Arial,sans-serif;font-size:15px;color:#101828;max-width:480px">
<p>Oi, ${escapeHtml(first)}!</p>
<p>Para criar uma nova senha no Wallit, toque no botão abaixo. O link vale por 1 hora.</p>
<p><a href="${escapeHtml(url)}" style="display:inline-block;background:#155EEF;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold">Criar nova senha</a></p>
<p style="color:#667085;font-size:13px">Se não foi você que pediu, pode ignorar este email.</p>
</div>`,
  };
}
