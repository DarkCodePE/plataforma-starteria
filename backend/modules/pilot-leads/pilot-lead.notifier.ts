/**
 * Pilot-lead notifier (issue #54): emails the team when a new lead is captured.
 *
 * The notification email is actionable — it carries the lead's contact details
 * so a human can follow up directly (the consented purpose). The accompanying
 * log line, by contrast, stays PII-free (ids/metadata only), preserving the
 * privacy-by-design stance of the AuditLog.
 *
 * Degrades gracefully: when SMTP is not configured (dev/test) or no recipients
 * are set, it logs the capture (non-PII) instead of sending. Sending is
 * fire-and-forget at the call site, so a transport failure never fails the
 * user's submit — we still log the error here for observability.
 */
import { config } from '../../config';
import { logger } from '../../shared/utils/logger';
import { mailer, type Mailer } from '../../shared/mail/mailer';
import type { PilotLeadNotice, PilotLeadNotifier } from './pilot-lead.service';

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function buildEmail(lead: PilotLeadNotice): { subject: string; text: string; html: string } {
  const org = lead.organization ?? '—';
  const phone = lead.phone ?? '—';
  const subject = `Nuevo pilot lead · ${lead.pilotCode}${lead.organization ? ` · ${lead.organization}` : ''}`;

  const text = [
    'Se registró un nuevo interés en el piloto de Starteria.',
    '',
    `Código:        ${lead.pilotCode}`,
    `Nombre:        ${lead.name}`,
    `Correo:        ${lead.email}`,
    `Teléfono:      ${phone}`,
    `Organización:  ${org}`,
    '',
    `ID interno:    ${lead.id}`,
  ].join('\n');

  const esc = (s: string): string =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = `
    <h2>Nuevo pilot lead</h2>
    <p>Se registró un nuevo interés en el piloto de Starteria.</p>
    <table cellpadding="4" style="border-collapse:collapse">
      <tr><td><strong>Código</strong></td><td>${esc(lead.pilotCode)}</td></tr>
      <tr><td><strong>Nombre</strong></td><td>${esc(lead.name)}</td></tr>
      <tr><td><strong>Correo</strong></td><td><a href="mailto:${esc(lead.email)}">${esc(lead.email)}</a></td></tr>
      <tr><td><strong>Teléfono</strong></td><td>${esc(phone)}</td></tr>
      <tr><td><strong>Organización</strong></td><td>${esc(org)}</td></tr>
    </table>
    <p style="color:#888;font-size:12px">ID interno: ${esc(lead.id)}</p>
  `.trim();

  return { subject, text, html };
}

export interface EmailNotifierOptions {
  /** Recipient list (defaults to config.pilotLeadNotifyTo). */
  to?: string[];
  /** Mailer to use (defaults to the shared SMTP mailer). DI for tests. */
  mailer?: Mailer;
  /** Explicit kill switch. Defaults fail closed from application config. */
  enabled?: boolean;
}

/**
 * Build a notifier that emails the team. Falls back to a non-PII log line when
 * the mailer is disabled or no recipients are configured.
 */
export function createEmailPilotLeadNotifier(options: EmailNotifierOptions = {}): PilotLeadNotifier {
  const to = options.to ?? config.pilotLeadNotifyTo;
  const transport = options.mailer ?? mailer;
  const enabled = options.enabled ?? config.pilotLeadEmailEnabled;

  return async (lead: PilotLeadNotice): Promise<void> => {
    // The bearer is deliberately excluded: logs must never authenticate a user.
    logger.info(
      { pilotLeadId: lead.id },
      'New pilot lead captured',
    );

    if (!enabled || !transport.enabled || to.length === 0) {
      logger.warn(
        { pilotLeadId: lead.id, recipients: to.length, mailerEnabled: transport.enabled, notifierEnabled: enabled },
        'Pilot lead notification not emailed (notifier disabled, mailer disabled or no recipients configured)',
      );
      return;
    }

    const { subject, text, html } = buildEmail(lead);
    try {
      await transport.send({ to, subject, text, html });
      logger.info({ pilotLeadId: lead.id, recipients: to.length }, 'Pilot lead notification emailed');
    } catch (err) {
      // Logged (no PII) but not rethrown beyond the service's fire-and-forget guard.
      logger.error({ pilotLeadId: lead.id, err }, 'Failed to email pilot lead notification');
      throw err;
    }
  };
}

/**
 * Applicant-facing confirmation email (the UI promises "te enviaremos una
 * confirmación a <su correo>"). Sent to the lead's own address — so the lead
 * receiving their own contact details is by-design, not a PII leak. Friendly,
 * sets expectations (we'll reach out when slots open), and carries the pilot
 * code so the applicant has a reference. No internal ids/draft leak to the
 * applicant.
 */
function buildConfirmationEmail(lead: PilotLeadNotice): { subject: string; text: string; html: string } {
  const subject = `Tu iniciativa en Starteria está en marcha · ${lead.pilotCode}`;
  // Link back to the "continue with your code" surface so the applicant can
  // resume the initiative. Base URL from the configured site origin.
  const siteUrl = (config.corsOrigin || '').replace(/\/+$/, '');
  const resumeUrl = `${siteUrl}/public/continuar`;
  const name = escapeHtml(lead.name);
  const code = escapeHtml(lead.pilotCode);
  const url = escapeHtml(resumeUrl);

  const text = [
    `Hola ${lead.name}, ¡tu iniciativa ya está en marcha! 🚀`,
    '',
    'Recibimos tu postulación al primer piloto de Starteria y tu propuesta quedó registrada.',
    '',
    `TU CÓDIGO DE POSTULACIÓN: ${lead.pilotCode}`,
    '',
    `Continúa tu iniciativa cuando quieras: entra a ${resumeUrl} e ingresa tu código.`,
    '',
    'Al continuar podrás:',
    '  • Trabajarla con IA — ordena y profundiza tu propuesta.',
    '  • Mentoría y foco — claridad sobre el siguiente paso.',
    '  • Próximos pasos claros — lista para tu líder o equipo.',
    '',
    'Cuando abramos cupos te avisaremos para llevarla más lejos.',
    '',
    'Nota: no compartas información sensible por este medio. Para trabajar con información confidencial, crea una cuenta y usa un espacio seguro.',
    '',
    '— Equipo Starteria',
  ].join('\n');

  // Bulletproof email HTML: table-based layout, inline styles, web-safe colors.
  // No external images or SVG (Gmail strips SVG; remote images need hosting),
  // so it renders consistently across Gmail/Outlook/Apple Mail out of the box.
  const preheader = 'Tu propuesta quedó registrada. Aquí está tu código para continuar tu iniciativa.';
  const benefit = (emoji: string, title: string, desc: string): string => `
                  <tr>
                    <td style="padding:10px 0;vertical-align:top;width:34px;font-size:20px;line-height:24px">${emoji}</td>
                    <td style="padding:10px 0;vertical-align:top">
                      <div style="font-size:15px;font-weight:700;color:#0f172a">${title}</div>
                      <div style="font-size:14px;line-height:21px;color:#64748b">${desc}</div>
                    </td>
                  </tr>`;

  const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9"><tr><td align="center" style="padding:28px 16px">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.08)">
      <!-- Header band -->
      <tr><td style="background:#4f46e5;background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);padding:26px 32px">
        <span style="font-size:18px;font-weight:800;color:#ffffff;letter-spacing:-0.2px">⚡ Starteria</span>
        <span style="font-size:12px;color:#dbeafe;float:right;padding-top:5px">Primer piloto</span>
      </td></tr>
      <!-- Body -->
      <tr><td style="padding:36px 32px 8px">
        <div style="font-size:12px;font-weight:800;letter-spacing:1px;color:#6366f1;text-transform:uppercase">Postulación al piloto</div>
        <h1 style="margin:8px 0 0;font-size:26px;line-height:32px;font-weight:850;color:#0f172a">¡Tu iniciativa está en marcha, ${name}! 🚀</h1>
        <p style="margin:14px 0 0;font-size:15px;line-height:23px;color:#475569">Recibimos tu postulación al primer piloto de Starteria y tu propuesta quedó registrada. Guarda este código — es tu llave para retomarla cuando quieras.</p>
      </td></tr>
      <!-- Code ticket -->
      <tr><td style="padding:22px 32px 4px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px dashed #c7d2fe;border-radius:14px"><tr><td style="padding:18px 22px;text-align:center">
          <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:#94a3b8;text-transform:uppercase">Tu código de postulación</div>
          <div style="margin-top:6px;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:26px;font-weight:800;letter-spacing:2px;color:#4338ca">${code}</div>
        </td></tr></table>
      </td></tr>
      <!-- CTA -->
      <tr><td style="padding:22px 32px 8px;text-align:center">
        <a href="${url}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-size:16px;font-weight:800;padding:14px 30px;border-radius:12px">Continuar mi iniciativa →</a>
        <p style="margin:14px 0 0;font-size:13px;line-height:20px;color:#94a3b8">o entra a <a href="${url}" style="color:#6366f1;text-decoration:none">${url}</a> e ingresa tu código.</p>
      </td></tr>
      <!-- Divider -->
      <tr><td style="padding:14px 32px"><div style="height:1px;background:#e2e8f0"></div></td></tr>
      <!-- Benefits -->
      <tr><td style="padding:4px 32px 8px">
        <div style="font-size:15px;font-weight:800;color:#0f172a">Al continuar, podrás:</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${benefit('🤖', 'Trabajarla con IA', 'Ordena, profundiza y fortalece tu propuesta en minutos.')}
${benefit('🧭', 'Mentoría y foco', 'Claridad sobre el siguiente paso y qué señales validar.')}
${benefit('✅', 'Próximos pasos claros', 'Una versión lista para compartir con tu líder o equipo.')}
        </table>
      </td></tr>
      <!-- Reassurance -->
      <tr><td style="padding:8px 32px 4px">
        <p style="margin:0;font-size:14px;line-height:21px;color:#475569">Cuando abramos cupos te avisaremos para llevar tu iniciativa más lejos. Mientras tanto, puedes seguir ordenándola con tu código.</p>
      </td></tr>
      <!-- Privacy -->
      <tr><td style="padding:16px 32px 28px">
        <p style="margin:0;font-size:12px;line-height:18px;color:#94a3b8">🔒 No compartas información sensible por este medio. Para trabajar con información confidencial, crea una cuenta y usa un espacio seguro.</p>
      </td></tr>
      <!-- Footer -->
      <tr><td style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0">
        <div style="font-size:13px;font-weight:700;color:#475569">Starteria</div>
        <div style="font-size:12px;color:#94a3b8;margin-top:2px">Convierte tu idea en una iniciativa lista para avanzar.</div>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

  return { subject, text, html };
}

export interface ConfirmationNotifierOptions {
  /** Mailer to use (defaults to the shared SMTP mailer). DI for tests. */
  mailer?: Mailer;
  /** Explicit kill switch. Defaults fail closed from application config. */
  enabled?: boolean;
}

/**
 * Build a notifier that emails the APPLICANT a confirmation of their pilot
 * submission. Falls back to a non-PII log line when the mailer is disabled.
 * Independent of the team notification: each is sent on a best-effort basis.
 */
export function createApplicantConfirmationNotifier(
  options: ConfirmationNotifierOptions = {},
): PilotLeadNotifier {
  const transport = options.mailer ?? mailer;
  const enabled = options.enabled ?? config.pilotLeadEmailEnabled;

  return async (lead: PilotLeadNotice): Promise<void> => {
    if (!enabled || !transport.enabled || !lead.email) {
      logger.warn(
        { pilotLeadId: lead.id, mailerEnabled: transport.enabled, notifierEnabled: enabled },
        'Pilot lead confirmation not emailed (notifier disabled, mailer disabled or no applicant email)',
      );
      return;
    }

    const { subject, text, html } = buildConfirmationEmail(lead);
    try {
      await transport.send({ to: lead.email, subject, text, html });
      logger.info({ pilotLeadId: lead.id }, 'Pilot lead confirmation emailed to applicant');
    } catch (err) {
      logger.error({ pilotLeadId: lead.id, err }, 'Failed to email pilot lead confirmation');
      throw err;
    }
  };
}

/**
 * Compose several notifiers into one, isolating failures: every notifier runs
 * even if a sibling throws (so a failed applicant confirmation never blocks the
 * team notification, and vice versa). Errors are logged per-notifier; the
 * combined notifier never rethrows — the service's fire-and-forget guard already
 * swallows, and here we explicitly want all-or-some delivery, not all-or-none.
 */
export function combinePilotLeadNotifiers(...notifiers: PilotLeadNotifier[]): PilotLeadNotifier {
  return async (lead: PilotLeadNotice): Promise<void> => {
    const results = await Promise.allSettled(notifiers.map((n) => n(lead)));
    for (const result of results) {
      if (result.status === 'rejected') {
        logger.error({ pilotLeadId: lead.id, err: result.reason }, 'A pilot lead notifier failed');
      }
    }
  };
}
