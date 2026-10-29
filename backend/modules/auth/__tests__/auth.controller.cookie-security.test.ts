import { describe, expect, it } from 'vitest';
import { REFRESH_COOKIE_OPTIONS } from '../auth.controller';

describe('refresh cookie security policy', () => {
  it('uses the approved eight-hour lifetime and an auth-scoped path that includes logout', () => {
    expect(REFRESH_COOKIE_OPTIONS).toMatchObject({
      httpOnly: true,
      sameSite: 'strict',
      path: '/api/v1/auth',
      maxAge: 8 * 60 * 60 * 1000,
    });
  });
});
