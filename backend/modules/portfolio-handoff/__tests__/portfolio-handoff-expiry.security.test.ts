import { describe, expect, it } from 'vitest';
import { parseExpiry } from '../portfolio-handoff-invitation.router';

describe('handoff invitation expiry bounds', () => {
  const current = new Date('2026-10-25T10:00:00.000Z');
  const now = () => current;

  it('accepts expiry inside the configured 1h..168h range', () => {
    expect(parseExpiry('2026-10-25T12:00:00.000Z', now)).toEqual(new Date('2026-10-25T12:00:00.000Z'));
  });

  it.each([
    ['too short', '2026-10-25T10:59:59.000Z'],
    ['too long', '2026-11-01T10:00:01.000Z'],
  ])('rejects %s expiry before any invitation is created', (_label, expiresAt) => {
    expect(() => parseExpiry(expiresAt, now)).toThrowError(expect.objectContaining({ code: 'HANDOFF_EXPIRY_OUT_OF_RANGE' }));
  });
});
