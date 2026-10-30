import { createHash } from 'node:crypto';
import { AppError } from '../../../shared/errors/AppError';

export type HandoffEmailTransportMode = 'disabled' | 'sandbox' | 'pilot';

export type HandoffEmailTransportSettings = {
  mode: HandoffEmailTransportMode;
  pilotEnabled: boolean;
  smtpHost: string;
  sender: string;
  verifiedSender: string;
  replyTo: string;
  publicBaseUrl: string;
  recipientAllowlist: readonly string[];
  organizationAllowlist: readonly string[];
  actorAllowlist: readonly string[];
  maxSendsPerWindow: number;
  windowSeconds: number;
  minIntervalSeconds: number;
  invitationTtlHours: number;
};

export type HandoffEmailAuthorizationRequest = {
  assignmentId: string;
  organizationId: string;
  actorId: string;
  recipient: string;
};

export type HandoffEmailAuthorization = {
  mode: Exclude<HandoffEmailTransportMode, 'disabled'>;
  from: string;
  replyTo?: string;
  publicBaseUrl: string;
  receiptSemantics: 'SMTP_ACCEPTED_ONLY';
  invitationTtlHours: number;
};

type AuditLogger = {
  info(fields: Record<string, unknown>, message: string): void;
  warn(fields: Record<string, unknown>, message: string): void;
};

const LOCAL_SMTP_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'mailpit', 'host.docker.internal']);
const CONSUMER_MAIL_DOMAINS = new Set(['gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com', 'yahoo.com']);

export class HandoffEmailTransportGate {
  private readonly sendsByScope = new Map<string, number[]>();

  constructor(
    private readonly settings: HandoffEmailTransportSettings,
    private readonly now: () => Date = () => new Date(),
    private readonly audit: AuditLogger = { info: () => undefined, warn: () => undefined },
  ) {}

  authorize(input: HandoffEmailAuthorizationRequest): HandoffEmailAuthorization {
    const recipient = normalizeMailbox(input.recipient);
    const auditFields = {
      mode: this.settings.mode,
      assignmentHash: stableHash(input.assignmentId),
      organizationHash: stableHash(input.organizationId),
      actorHash: stableHash(input.actorId),
      recipientHash: stableHash(recipient),
    };

    if (this.settings.mode === 'disabled') {
      this.audit.warn(auditFields, 'Handoff email blocked: transport disabled');
      throw unavailable('El transporte de invitaciones esta deshabilitado.', 'HANDOFF_EMAIL_DISABLED');
    }

    if (this.settings.mode === 'sandbox') {
      if (!LOCAL_SMTP_HOSTS.has(this.settings.smtpHost.trim().toLowerCase()) || !normalizeMailbox(this.settings.sender)) {
        this.audit.warn(auditFields, 'Handoff email blocked: invalid sandbox transport');
        throw unavailable('El sandbox de correo requiere Mailpit local y un remitente configurado.', 'HANDOFF_EMAIL_SANDBOX_CONFIG_INVALID');
      }
      this.audit.info(auditFields, 'Handoff email authorized for sandbox SMTP receipt');
      return {
        mode: 'sandbox',
        from: this.settings.sender,
        replyTo: this.settings.replyTo || undefined,
        publicBaseUrl: this.settings.publicBaseUrl,
        receiptSemantics: 'SMTP_ACCEPTED_ONLY',
        invitationTtlHours: this.settings.invitationTtlHours,
      };
    }

    this.assertPilotConfiguration(auditFields);
    if (!this.settings.recipientAllowlist.map(normalizeMailbox).includes(recipient)) {
      this.audit.warn(auditFields, 'Handoff email blocked: recipient is not allowlisted');
      throw AppError.forbidden('El destinatario no esta autorizado para el piloto.', 'HANDOFF_EMAIL_RECIPIENT_NOT_ALLOWED');
    }
    if (!this.settings.organizationAllowlist.map(normalizeIdentifier).includes(normalizeIdentifier(input.organizationId))) {
      this.audit.warn(auditFields, 'Handoff email blocked: tenant is not allowlisted');
      throw AppError.forbidden('La organizacion no esta autorizada para el piloto.', 'HANDOFF_EMAIL_TENANT_NOT_ALLOWED');
    }
    if (!this.settings.actorAllowlist.map(normalizeIdentifier).includes(normalizeIdentifier(input.actorId))) {
      this.audit.warn(auditFields, 'Handoff email blocked: actor is not allowlisted');
      throw AppError.forbidden('El actor no esta autorizado para el piloto.', 'HANDOFF_EMAIL_ACTOR_NOT_ALLOWED');
    }

    this.audit.info(auditFields, 'Handoff email authorized for external SMTP receipt');
    return {
      mode: 'pilot',
      from: this.settings.sender,
      replyTo: this.settings.replyTo,
      publicBaseUrl: this.settings.publicBaseUrl,
      receiptSemantics: 'SMTP_ACCEPTED_ONLY',
      invitationTtlHours: this.settings.invitationTtlHours,
    };
  }

  consumeSendQuota(input: HandoffEmailAuthorizationRequest): void {
    if (this.settings.mode !== 'pilot') return;
    const recipient = normalizeMailbox(input.recipient);
    const auditFields = {
      mode: this.settings.mode,
      assignmentHash: stableHash(input.assignmentId),
      organizationHash: stableHash(input.organizationId),
      actorHash: stableHash(input.actorId),
      recipientHash: stableHash(recipient),
    };
    this.consumeRateLimit(`${normalizeIdentifier(input.organizationId)}:${normalizeIdentifier(input.actorId)}`, auditFields);
  }

  private assertPilotConfiguration(auditFields: Record<string, unknown>): void {
    if (!this.settings.pilotEnabled) {
      this.audit.warn(auditFields, 'Handoff email blocked: pilot kill switch is off');
      throw unavailable('El envio externo del piloto no esta habilitado.', 'HANDOFF_EMAIL_PILOT_DISABLED');
    }
    const sender = normalizeMailbox(this.settings.sender);
    const verifiedSender = normalizeMailbox(this.settings.verifiedSender);
    const replyTo = normalizeMailbox(this.settings.replyTo);
    const invalidConfig = !this.settings.smtpHost.trim()
      || LOCAL_SMTP_HOSTS.has(this.settings.smtpHost.trim().toLowerCase())
      || !sender || !verifiedSender || sender !== verifiedSender
      || !replyTo || isConsumerMailbox(sender) || isConsumerMailbox(replyTo)
      || this.settings.recipientAllowlist.length === 0
      || this.settings.organizationAllowlist.length === 0
      || this.settings.actorAllowlist.length === 0
      || !Number.isInteger(this.settings.maxSendsPerWindow) || this.settings.maxSendsPerWindow < 1
      || !Number.isInteger(this.settings.windowSeconds) || this.settings.windowSeconds < 1
      || !Number.isInteger(this.settings.minIntervalSeconds) || this.settings.minIntervalSeconds < 0;
    if (!Number.isInteger(this.settings.invitationTtlHours) || this.settings.invitationTtlHours < 1) {
      this.audit.warn(auditFields, 'Handoff email blocked: invalid invitation TTL');
      throw unavailable('La caducidad de la invitacion no esta configurada.', 'HANDOFF_EMAIL_PILOT_CONFIG_INVALID');
    }
    if (invalidConfig) {
      this.audit.warn(auditFields, 'Handoff email blocked: pilot configuration is incomplete or unsafe');
      throw unavailable('La configuracion del piloto externo esta incompleta o no es segura.', 'HANDOFF_EMAIL_PILOT_CONFIG_INVALID');
    }
    if (!isPublicHttpsUrl(this.settings.publicBaseUrl)) {
      this.audit.warn(auditFields, 'Handoff email blocked: invitation URL is not public HTTPS');
      throw unavailable('La URL publica de invitaciones debe ser HTTPS y no puede ser local o privada.', 'HANDOFF_EMAIL_PUBLIC_URL_INVALID');
    }
  }

  private consumeRateLimit(scope: string, auditFields: Record<string, unknown>): void {
    const now = this.now().getTime();
    const windowMs = this.settings.windowSeconds * 1000;
    const minIntervalMs = this.settings.minIntervalSeconds * 1000;
    const recent = (this.sendsByScope.get(scope) ?? []).filter((timestamp) => timestamp > now - windowMs);
    const retryAfterMs = recent.length > 0 ? minIntervalMs - (now - recent[recent.length - 1]) : 0;
    if (retryAfterMs > 0 || recent.length >= this.settings.maxSendsPerWindow) {
      const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs > 0 ? retryAfterMs / 1000 : (recent[0] + windowMs - now) / 1000));
      this.audit.warn({ ...auditFields, retryAfterSeconds }, 'Handoff email blocked: pilot cadence exceeded');
      throw new AppError(429, 'Se alcanzo el limite de envios del piloto.', 'HANDOFF_EMAIL_RATE_LIMITED', true, { retryAfterSeconds });
    }
    recent.push(now);
    this.sendsByScope.set(scope, recent);
  }
}

function unavailable(message: string, code: string): AppError {
  return new AppError(503, message, code);
}

function normalizeIdentifier(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeMailbox(value: string): string {
  const trimmed = value.trim().toLowerCase();
  const displayMatch = trimmed.match(/<([^<>]+)>$/);
  const mailbox = (displayMatch?.[1] ?? trimmed).trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mailbox) ? mailbox : '';
}

function isConsumerMailbox(mailbox: string): boolean {
  return CONSUMER_MAIL_DOMAINS.has(mailbox.split('@')[1] ?? '');
}

function isPublicHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return false;
    const host = url.hostname.toLowerCase();
    if (LOCAL_SMTP_HOSTS.has(host) || host.endsWith('.localhost') || host === '0.0.0.0') return false;
    if (/^10\./.test(host) || /^192\.168\./.test(host) || /^127\./.test(host)) return false;
    const match172 = host.match(/^172\.(\d{1,3})\./);
    if (match172 && Number(match172[1]) >= 16 && Number(match172[1]) <= 31) return false;
    return host.includes('.');
  } catch {
    return false;
  }
}

function stableHash(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex').slice(0, 16);
}
