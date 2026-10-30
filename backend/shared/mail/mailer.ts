/**
 * Thin SMTP mail transport (nodemailer) wired from config.
 *
 * Lazily creates a single shared transport on first send. When SMTP is not
 * configured (no `SMTP_HOST`) the mailer reports `enabled: false` so callers can
 * degrade gracefully (e.g. log instead of send) — this is the dev default and
 * keeps tests/CI hermetic without any SMTP server.
 */
import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../../config';
import { logger } from '../utils/logger';

export interface MailMessage {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  from?: string;
  replyTo?: string;
}

export interface Mailer {
  /** Whether an SMTP transport is configured (host + from address present). */
  readonly enabled: boolean;
  /** Send a message. Resolves to false (and logs) when the mailer is disabled. */
  send(message: MailMessage): Promise<boolean>;
}

let cachedTransport: Transporter | null = null;

function getTransport(): Transporter {
  if (!cachedTransport) {
    cachedTransport = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: config.smtp.user
        ? { user: config.smtp.user, pass: config.smtp.pass }
        : undefined,
    });
  }
  return cachedTransport;
}

/** The process-wide mailer, backed by config-driven SMTP. */
export const mailer: Mailer = {
  get enabled(): boolean {
    return Boolean(config.smtp.host && config.smtp.from);
  },

  async send(message: MailMessage): Promise<boolean> {
    if (!config.smtp.host || !(message.from || config.smtp.from)) {
      logger.warn({ subject: message.subject }, 'Mailer disabled (SMTP not configured) — email not sent');
      return false;
    }
    const receipt = await sendMailWithReceipt(message);
    return receipt.acceptedByTransport;
  },
};

export async function sendMailWithReceipt(message: MailMessage): Promise<{ acceptedByTransport: boolean; providerMessageRef?: string }> {
  const from = message.from || config.smtp.from;
  if (!config.smtp.host || !from) {
    logger.warn({ subject: message.subject }, 'Mailer disabled (SMTP or sender not configured) — email not sent');
    return { acceptedByTransport: false };
  }
  const receipt = await getTransport().sendMail({
    from,
    replyTo: message.replyTo || undefined,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
  return { acceptedByTransport: true, providerMessageRef: receipt.messageId };
}

/** Test seam: reset the cached transport between suites. */
export function __resetMailerTransportForTests(): void {
  cachedTransport = null;
}
