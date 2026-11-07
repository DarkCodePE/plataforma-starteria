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

export interface MailDeliveryReceipt {
  acceptedByTransport: boolean;
  acceptedRecipients: string[];
  rejectedRecipients: string[];
  providerMessageRef?: string;
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

function recipientAddress(value: unknown): string | null {
  if (typeof value === 'string') return value.trim().toLowerCase();
  if (value && typeof value === 'object' && 'address' in value && typeof value.address === 'string') {
    return value.address.trim().toLowerCase();
  }
  return null;
}

export async function sendMailWithReceipt(message: MailMessage): Promise<MailDeliveryReceipt> {
  const from = message.from || config.smtp.from;
  if (!config.smtp.host || !from) {
    logger.warn({ subject: message.subject }, 'Mailer disabled (SMTP or sender not configured) — email not sent');
    return { acceptedByTransport: false, acceptedRecipients: [], rejectedRecipients: [] };
  }
  const receipt = await getTransport().sendMail({
    from,
    replyTo: message.replyTo || undefined,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
  const expectedRecipients = (Array.isArray(message.to) ? message.to : [message.to])
    .map((recipient) => recipient.trim().toLowerCase());
  const acceptedRecipients = (Array.isArray(receipt.accepted) ? receipt.accepted : [])
    .map(recipientAddress)
    .filter((recipient): recipient is string => Boolean(recipient));
  const rejectedRecipients = (Array.isArray(receipt.rejected) ? receipt.rejected : [])
    .map(recipientAddress)
    .filter((recipient): recipient is string => Boolean(recipient));
  const acceptedSet = new Set(acceptedRecipients);
  return {
    acceptedByTransport: expectedRecipients.every((recipient) => acceptedSet.has(recipient)),
    acceptedRecipients,
    rejectedRecipients,
    providerMessageRef: receipt.messageId,
  };
}

/** Test seam: reset the cached transport between suites. */
export function __resetMailerTransportForTests(): void {
  cachedTransport = null;
}
