import { describe, expect, it, vi } from 'vitest';
import { HandoffEmailTransportGate, type HandoffEmailTransportSettings } from '../application/handoff-email-transport-gate';

const base = (overrides: Partial<HandoffEmailTransportSettings> = {}): HandoffEmailTransportSettings => ({
  mode: 'disabled',
  pilotEnabled: false,
  smtpHost: '',
  sender: '',
  verifiedSender: '',
  replyTo: '',
  publicBaseUrl: 'http://localhost:5173',
  recipientAllowlist: [],
  organizationAllowlist: [],
  actorAllowlist: [],
  maxSendsPerWindow: 2,
  windowSeconds: 3600,
  minIntervalSeconds: 30,
  invitationTtlHours: 168,
  ...overrides,
});

const request = {
  assignmentId: 'assignment-1',
  organizationId: 'org-a',
  actorId: 'lead-a',
  recipient: ' Volunteer.Gmail+pilot@gmail.com ',
};

describe('HandoffEmailTransportGate / KAN-188', () => {
  it('fails closed by default before any delivery can run', () => {
    const gate = new HandoffEmailTransportGate(base());
    expect(() => gate.authorize(request)).toThrowError(expect.objectContaining({ code: 'HANDOFF_EMAIL_DISABLED' }));
  });

  it('allows sandbox only through a local Mailpit host', () => {
    const gate = new HandoffEmailTransportGate(base({ mode: 'sandbox', smtpHost: 'mailpit', sender: 'Starteria Sandbox <sandbox@starteria.test>' }));
    expect(gate.authorize(request)).toMatchObject({ mode: 'sandbox', receiptSemantics: 'SMTP_ACCEPTED_ONLY' });
    expect(() => new HandoffEmailTransportGate(base({ mode: 'sandbox', smtpHost: 'smtp.example.com', sender: 'sandbox@starteria.test' })).authorize(request))
      .toThrowError(expect.objectContaining({ code: 'HANDOFF_EMAIL_SANDBOX_CONFIG_INVALID' }));
  });

  it('normalizes and allows only an exact pilot recipient plus authorized tenant and actor', () => {
    const gate = new HandoffEmailTransportGate(base({
      mode: 'pilot', pilotEnabled: true, smtpHost: 'smtp.provider.example',
      sender: 'Starteria <pilot@starteria.example>', verifiedSender: 'pilot@starteria.example', replyTo: 'support@starteria.example',
      publicBaseUrl: 'https://pilot.starteria.example', recipientAllowlist: ['volunteer.gmail+pilot@gmail.com'],
      organizationAllowlist: ['org-a'], actorAllowlist: ['lead-a'], minIntervalSeconds: 0,
    }));
    expect(gate.authorize(request)).toMatchObject({ mode: 'pilot', from: 'Starteria <pilot@starteria.example>', replyTo: 'support@starteria.example' });
    expect(() => gate.authorize({ ...request, recipient: 'someone@gmail.com' })).toThrowError(expect.objectContaining({ code: 'HANDOFF_EMAIL_RECIPIENT_NOT_ALLOWED' }));
    expect(() => gate.authorize({ ...request, organizationId: 'org-b' })).toThrowError(expect.objectContaining({ code: 'HANDOFF_EMAIL_TENANT_NOT_ALLOWED' }));
    expect(() => gate.authorize({ ...request, actorId: 'lead-b' })).toThrowError(expect.objectContaining({ code: 'HANDOFF_EMAIL_ACTOR_NOT_ALLOWED' }));
  });

  it.each([
    [{ pilotEnabled: false }, 'HANDOFF_EMAIL_PILOT_DISABLED'],
    [{ publicBaseUrl: 'http://pilot.starteria.example' }, 'HANDOFF_EMAIL_PUBLIC_URL_INVALID'],
    [{ publicBaseUrl: 'https://localhost:5173' }, 'HANDOFF_EMAIL_PUBLIC_URL_INVALID'],
    [{ verifiedSender: 'other@starteria.example' }, 'HANDOFF_EMAIL_PILOT_CONFIG_INVALID'],
    [{ sender: 'pilot@gmail.com', verifiedSender: 'pilot@gmail.com' }, 'HANDOFF_EMAIL_PILOT_CONFIG_INVALID'],
    [{ recipientAllowlist: [] }, 'HANDOFF_EMAIL_PILOT_CONFIG_INVALID'],
  ])('rejects incomplete or unsafe pilot configuration %#', (override, code) => {
    const settings = base({
      mode: 'pilot', pilotEnabled: true, smtpHost: 'smtp.provider.example',
      sender: 'pilot@starteria.example', verifiedSender: 'pilot@starteria.example', replyTo: 'support@starteria.example',
      publicBaseUrl: 'https://pilot.starteria.example', recipientAllowlist: ['volunteer.gmail+pilot@gmail.com'],
      organizationAllowlist: ['org-a'], actorAllowlist: ['lead-a'], minIntervalSeconds: 0,
      ...override,
    });
    expect(() => new HandoffEmailTransportGate(settings).authorize(request)).toThrowError(expect.objectContaining({ code }));
  });

  it('enforces cadence and a bounded send window without logging recipient PII', () => {
    let now = new Date('2026-10-25T10:00:00.000Z');
    const audit = { info: vi.fn(), warn: vi.fn() };
    const gate = new HandoffEmailTransportGate(base({
      mode: 'pilot', pilotEnabled: true, smtpHost: 'smtp.provider.example', sender: 'pilot@starteria.example',
      verifiedSender: 'pilot@starteria.example', replyTo: 'support@starteria.example', publicBaseUrl: 'https://pilot.starteria.example',
      recipientAllowlist: ['volunteer.gmail+pilot@gmail.com'], organizationAllowlist: ['org-a'], actorAllowlist: ['lead-a'],
      maxSendsPerWindow: 2, windowSeconds: 60, minIntervalSeconds: 10,
    }), () => now, audit);

    gate.authorize(request);
    gate.consumeSendQuota(request);
    expect(() => gate.consumeSendQuota({ ...request, assignmentId: 'assignment-2' })).toThrowError(expect.objectContaining({ code: 'HANDOFF_EMAIL_RATE_LIMITED' }));
    now = new Date('2026-10-25T10:00:11.000Z');
    gate.consumeSendQuota({ ...request, assignmentId: 'assignment-2' });
    now = new Date('2026-10-25T10:00:22.000Z');
    expect(() => gate.consumeSendQuota({ ...request, assignmentId: 'assignment-3' })).toThrowError(expect.objectContaining({ code: 'HANDOFF_EMAIL_RATE_LIMITED' }));
    expect(JSON.stringify(audit.info.mock.calls)).not.toContain('volunteer.gmail');
  });
});
