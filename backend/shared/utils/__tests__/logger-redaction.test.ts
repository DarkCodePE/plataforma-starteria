import { describe, expect, it } from 'vitest';
import pino from 'pino';
import { LOG_REDACT_PATHS } from '../logger';

describe('shared/utils/logger redaction', () => {
  it('redacts request and response credentials from structured logs', () => {
    expect(LOG_REDACT_PATHS).toEqual(expect.arrayContaining([
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-internal-token"]',
      'req.headers["x-starteria-entry-token"]',
      'req.headers["idempotency-key"]',
      'req.body',
      'res.headers["set-cookie"]',
      '*.password',
      '*.accessToken',
      '*.refreshToken',
      '*.token',
    ]));
  });

  it('does not serialize Entry credentials or commercial contact fields', () => {
    const lines: string[] = [];
    const probe = pino({ redact: { paths: LOG_REDACT_PATHS } }, { write: (line: string) => { lines.push(line); } });
    probe.info({ req: { headers: {
      'x-starteria-entry-token': 'private-entry-credential',
      authorization: 'Bearer private-auth-credential',
      'idempotency-key': 'private-idempotency-key',
    }, body: {
      email: 'private@example.org', name: 'Private Name', organization: 'Private Organization',
      decisionInViewPreview: 'Private decision text',
    } } }, 'conversion request');
    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toMatch(/private-entry-credential|private-auth-credential|private-idempotency-key|private@example.org|Private Name|Private Organization|Private decision text/);
  });
});
