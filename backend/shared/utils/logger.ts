import pino from 'pino';
import { config } from '../../config';

export const LOG_REDACT_PATHS = [
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
];

const PILOT_CODE_IN_URL = /(?<=\/api\/v1\/public\/pilot-leads\/)ST-PILOT-[A-F0-9]{64}(?=\/|\?|$)/gi;

export function redactSensitiveRequestUrl(url: string | undefined): string | undefined {
  return url?.replace(PILOT_CODE_IN_URL, '[REDACTED]');
}

export const logger = pino({
  level: config.logLevel,
  redact: {
    paths: LOG_REDACT_PATHS,
  },
  transport:
    config.nodeEnv === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
});
