import { describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import {
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  verifyAccessToken,
  type TokenPayload,
} from '../token.service';
import { config } from '../../../config';
import { AppError } from '../../../shared/errors/AppError';

/**
 * token.service depends on backend/config, which reads JWT_SECRET from env
 * at module load time. To keep the test independent of which env vars the
 * runner happens to expose, we re-use whatever secret config landed on
 * (could be the dev fallback, could be a real test value) — the
 * roundtrip semantics are what we're verifying.
 */

const samplePayload: TokenPayload = {
  sub: 'user-123',
  sid: 'family-123',
  role: 'participante',
  email: 'a@test.local',
  cohort: 'cohort-2026-Q1',
};

describe('modules/auth/token.service', () => {
  describe('generateAccessToken', () => {
    it('returns a 3-segment JWT string with the issuer/audience claims', () => {
      const token = generateAccessToken(samplePayload);
      expect(token.split('.').length).toBe(3);
      const decoded = jwt.decode(token) as Record<string, unknown>;
      expect(decoded.sub).toBe('user-123');
      expect(decoded.sid).toBe('family-123');
      expect(decoded.role).toBe('participante');
      expect(decoded.email).toBe('a@test.local');
      expect(decoded.iss).toBe('starteria-api');
      expect(decoded.aud).toBe('starteria-dashboard');
    });
  });

  describe('verifyAccessToken', () => {
    it('roundtrips a freshly signed token back to its payload', () => {
      const token = generateAccessToken(samplePayload);
      const decoded = verifyAccessToken(token);
      expect(decoded.sub).toBe('user-123');
      expect(decoded.sid).toBe('family-123');
      expect(decoded.role).toBe('participante');
      expect(decoded.email).toBe('a@test.local');
    });

    it('throws AppError(401, TOKEN_INVALID) on a garbled token', () => {
      try {
        verifyAccessToken('not.a.token');
        throw new Error('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        expect((err as AppError).statusCode).toBe(401);
        expect((err as AppError).code).toBe('TOKEN_INVALID');
      }
    });

    it('throws AppError(401, TOKEN_EXPIRED) on an expired token', () => {
      // Sign a token with `exp` injected directly in the payload (past
      // unix timestamp). This is the deterministic way to force jwt's
      // TokenExpiredError branch. We pre-populate iat too so the lib
      // doesn't add a fresher one.
      const secret = config.jwtSecret;
      const past = Math.floor(Date.now() / 1000) - 60;
      const expired = jwt.sign(
        { ...samplePayload, iat: past - 60, exp: past },
        secret,
        {
          issuer: 'starteria-api',
          audience: 'starteria-dashboard',
        },
      );
      try {
        verifyAccessToken(expired);
        throw new Error('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        expect((err as AppError).statusCode).toBe(401);
        expect((err as AppError).code).toBe('TOKEN_EXPIRED');
      }
    });

    it('throws TOKEN_INVALID when audience does not match', () => {
      const secret = config.jwtSecret;
      const wrongAud = jwt.sign(samplePayload, secret, {
        issuer: 'starteria-api',
        audience: 'someone-else',
        expiresIn: '5m',
      });
      try {
        verifyAccessToken(wrongAud);
        throw new Error('should have thrown');
      } catch (err) {
        expect((err as AppError).code).toBe('TOKEN_INVALID');
      }
    });
  });

  describe('generateRefreshToken', () => {
    it('returns 128 hex chars (64 random bytes)', () => {
      const t = generateRefreshToken();
      expect(t).toMatch(/^[0-9a-f]{128}$/);
    });

    it('produces different values across invocations', () => {
      expect(generateRefreshToken()).not.toBe(generateRefreshToken());
    });
  });

  describe('hashRefreshToken', () => {
    it('produces a deterministic SHA-256 hex string of length 64', () => {
      const a = hashRefreshToken('plain-token');
      const b = hashRefreshToken('plain-token');
      expect(a).toBe(b);
      expect(a).toMatch(/^[0-9a-f]{64}$/);
    });

    it('produces different hashes for different inputs', () => {
      expect(hashRefreshToken('a')).not.toBe(hashRefreshToken('b'));
    });
  });
});
