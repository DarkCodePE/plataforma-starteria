import { PrismaClient, Prisma } from '@prisma/client';
import crypto from 'crypto';
import { AppError } from '../../shared/errors/AppError';
import { logger } from '../../shared/utils/logger';
import { hashPassword, verifyPassword } from './password.service';
import { rolesForUser, permissionsForRoles, type Permission } from '../../shared/authz/permissions';
import type { Role } from '../../shared/types/user.types';
import {
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  TokenPayload,
} from './token.service';
import { RegisterInput } from './auth.schemas';
import { verifyGoogleIdToken } from './google.service';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Precomputed bcrypt hash of the empty string.
 * Used to perform a constant-time dummy compare in the user-not-found branch
 * of loginUser, preventing a timing oracle that would let an attacker
 * enumerate registered emails.
 * Generated with bcrypt.hashSync('', 12).
 */
const DUMMY_PASSWORD_HASH =
  '$2b$12$bYvQg0n/JmnjjzZw9Vvj7uqQfL5WvB5kEcc0iH6m8YwJ4gI8xT0Xm';

const DEMO_PASSWORD = 'demo123';
const DEMO_USERS: Record<string, SafeUser> = Object.fromEntries(
  Object.entries({
  'participante@starteria.io': {
    id: 'demo-participante',
    name: 'Ana Rodriguez',
    email: 'participante@starteria.io',
    role: 'participante',
    initials: 'AR',
  },
  'mentor@starteria.io': {
    id: 'demo-mentor',
    name: 'Carlos Mendez',
    email: 'mentor@starteria.io',
    role: 'mentor',
    initials: 'CM',
  },
  'admin@starteria.io': {
    id: 'demo-admin',
    name: 'Laura Perez',
    email: 'admin@starteria.io',
    role: 'admin',
    initials: 'LP',
  },
  'portfolio@starteria.io': {
    id: 'demo-portfolio',
    name: 'Valeria Castro',
    email: 'portfolio@starteria.io',
    role: 'portfolio_lead',
    initials: 'VC',
  },
  'sponsor@starteria.io': {
    id: 'demo-sponsor',
    name: 'Roberto Jimenez',
    email: 'sponsor@starteria.io',
    role: 'sponsor',
    initials: 'RJ',
  },
  // ADR-029: los usuarios demo pasan por la MISMA derivación que los reales, para
  // que el modo demo no sea un universo con otras reglas de autorización.
  }).map(([email, u]) => [email, toSafeUser(u)]),
) as Record<string, SafeUser>;

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface SafeUser {
  id: string;
  name: string;
  email: string;
  /** Rol PRIMARIO. El frontend lo usa como ETIQUETA, nunca para decidir acceso (ADR-029). */
  role: string;
  /** ADR-029: el conjunto de roles. Es lo que permite pertenecer a las dos superficies. */
  roles: Role[];
  /**
   * ADR-029: permisos YA DERIVADOS en el servidor.
   *
   * El frontend recibe permisos, no la tabla de derivación: esa tabla es superficie
   * de seguridad y vive en un solo sitio. Duplicarla en el cliente repetiría el
   * defecto que ADR-028 denunció (la misma regla en dos archivos que no se enteran
   * el uno del otro).
   */
  permissions: Permission[];
  initials: string;
  cohort?: string | null;
}

/**
 * Serializa un usuario para la respuesta HTTP, derivando roles y permisos.
 * Punto ÚNICO: antes había cuatro literales idénticos y cualquiera podía quedarse
 * sin un campo nuevo sin que nada fallara.
 */
function toSafeUser(user: {
  id: string;
  name: string;
  email: string;
  role: string;
  roles?: Role[] | null;
  initials: string;
  cohortId?: string | null;
}): SafeUser {
  const roles = [...rolesForUser({ role: user.role as Role, roles: user.roles })];

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    roles,
    permissions: [...permissionsForRoles(roles)],
    initials: user.initials,
    cohort: user.cohortId,
  };
}

type AuthenticatedResult = { user: SafeUser; tokens: AuthTokens; waitlisted?: false };
type WaitlistedResult = { user: SafeUser; waitlisted: true };
type AuthResult = AuthenticatedResult | WaitlistedResult;

function isDevelopment(): boolean {
  return process.env.NODE_ENV !== 'production';
}

function isLikelyDatabaseConnectionError(err: unknown): boolean {
  const code = (err as { code?: unknown })?.code;
  const message = String((err as { message?: unknown })?.message ?? '').toLowerCase();

  return (
    code === 'P1000' ||
    code === 'P1001' ||
    code === 'P1002' ||
    code === 'P1017' ||
    message.includes("can't reach database") ||
    message.includes('connect') ||
    message.includes('connection')
  );
}

function issueDevTokenPair(user: SafeUser): AuthTokens {
  const payload: TokenPayload = {
    sub: user.id,
    role: user.role as TokenPayload['role'],
    email: user.email,
    ...(user.cohort ? { cohort: user.cohort } : {}),
  };

  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(),
  };
}

function computeInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

export class AuthService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Register a new user. Only 'participante' can self-register;
   * other roles must be created by an admin.
   */
  async registerUser(
    data: RegisterInput,
  ): Promise<AuthResult> {
    // Only participante can self-register
    if (data.role !== 'participante') {
      throw AppError.registerRoleForbidden();
    }

    let existing;
    try {
      existing = await this.prisma.user.findUnique({
        where: { email: data.email.toLowerCase() },
      });
      if (existing) {
        throw AppError.emailTaken();
      }
    } catch (err) {
      if (isDevelopment() && isLikelyDatabaseConnectionError(err)) {
        const user: SafeUser = toSafeUser({
          id: `demo-${data.email.toLowerCase()}`,
          name: data.name,
          email: data.email.toLowerCase(),
          role: data.role,
          initials: computeInitials(data.name),
        });

        logger.warn({ email: user.email }, 'Database unavailable; using development auth fallback for registration');

        return { user, waitlisted: true };
      }

      throw err;
    }

    const passwordHash = await hashPassword(data.password);
    const initials = computeInitials(data.name);

    // Waitlist bypass, SOLO para entornos de test/e2e vía env (opt-in explícito). El stack
    // e2e corre con NODE_ENV=production (imagen 'production'), así que NO se puede gatear por
    // NODE_ENV: la seguridad es que AUTH_DISABLE_WAITLIST simplemente no se define en el
    // entorno productivo real. Permite que la suite e2e (register → login) obtenga token.
    const waitlistDisabled = process.env.AUTH_DISABLE_WAITLIST === 'true';

    const user = await this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email.toLowerCase(),
        passwordHash,
        // ADR-029: se escriben las DOS columnas de la fase 1 en el mismo create,
        // para que ninguna fila nueva nazca sin `roles`.
        role: data.role,
        roles: [data.role],
        initials,
        isActive: waitlistDisabled,
      },
    });

    if (waitlistDisabled) {
      logger.warn({ userId: user.id }, 'AUTH_DISABLE_WAITLIST activo: usuario registrado ACTIVO (solo test/e2e)');
    } else {
      logger.info({ userId: user.id }, 'User registered on waitlist');
    }

    return {
      user: toSafeUser(user),
      waitlisted: true,
    };
  }

  /**
   * Authenticate user with email/password.
   * Enforces account lockout after 5 failed attempts.
   */
  async loginUser(
    email: string,
    password: string,
  ): Promise<{ user: SafeUser; tokens: AuthTokens }> {
    let user;
    try {
      user = await this.prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });
    } catch (err) {
      const demoUser = DEMO_USERS[email.toLowerCase()];
      if (isDevelopment() && isLikelyDatabaseConnectionError(err) && demoUser && password === DEMO_PASSWORD) {
        logger.warn({ email: demoUser.email }, 'Database unavailable; using development auth fallback for login');
        return { user: demoUser, tokens: issueDevTokenPair(demoUser) };
      }

      if (isDevelopment() && isLikelyDatabaseConnectionError(err)) {
        logger.warn({ email: email.toLowerCase() }, 'Database unavailable; login fallback requires a demo account or registration');
        throw AppError.unauthorized(
          'No encontramos una cuenta activa con este correo en este entorno.',
          'AUTH_LOGIN_NEEDS_ACCOUNT',
          { hint: 'Para probar Starteria como usuario nuevo, usa Regístrate y crea la cuenta con esta misma dirección.' },
        );
      }

      throw err;
    }

    if (!user) {
      // Timing-oracle guard: run a dummy bcrypt compare so the response time
      // for "user not found" matches "wrong password". Result is discarded.
      await verifyPassword(password, DUMMY_PASSWORD_HASH);
      throw AppError.invalidCredentials();
    }

    if (!user.isActive) {
      throw AppError.authWaitlisted();
    }

    // Google-OAuth-only accounts have passwordHash === null. Send a distinct
    // error so the UI can prompt the user to use the Google button instead of
    // looping them on "wrong password" forever.
    if (!user.passwordHash) {
      // Timing-oracle guard: same dummy compare so attackers cannot use latency
      // to enumerate which emails are Google-only vs password-backed.
      await verifyPassword(password, DUMMY_PASSWORD_HASH);
      throw AppError.authGoogleOnly();
    }

    // Check lockout
    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      // Timing-oracle guard: match the response time of the wrong-password
      // branch so attackers cannot distinguish "locked" from "wrong password"
      // by latency. Result is discarded.
      await verifyPassword(password, user.passwordHash);
      const retrySeconds = Math.max(
        1,
        Math.ceil((new Date(user.lockedUntil).getTime() - Date.now()) / 1000),
      );
      throw AppError.accountLocked(retrySeconds);
    }

    const passwordValid = await verifyPassword(password, user.passwordHash);

    if (!passwordValid) {
      const failedAttempts = (user.failedLoginAttempts || 0) + 1;
      const updateData: Record<string, unknown> = { failedLoginAttempts: failedAttempts };
      let lockedUntil: Date | null = null;

      if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
        lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
        updateData.lockedUntil = lockedUntil;
        logger.warn({ userId: user.id, failedAttempts }, 'Account locked after failed attempts');
      }

      await this.prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });

      if (lockedUntil) {
        const retrySeconds = Math.max(
          1,
          Math.ceil((lockedUntil.getTime() - Date.now()) / 1000),
        );
        throw AppError.accountLocked(retrySeconds);
      }

      throw AppError.invalidCredentials();
    }

    // Reset failed attempts on successful login
    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }

    const tokens = await this.issueTokenPair(user.id, user.email, user.role, user.roles, user.cohortId);

    logger.info({ userId: user.id }, 'User logged in');

    return {
      user: toSafeUser(user),
      tokens,
    };
  }

  /**
   * Validate a refresh token, rotate it, and issue a new token pair.
   * Implements token family reuse detection.
   */
  async refreshTokens(rawRefreshToken: string): Promise<AuthTokens> {
    const tokenHash = hashRefreshToken(rawRefreshToken);

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!storedToken) {
      throw AppError.refreshInvalid();
    }

    // Token already revoked — potential reuse attack. Revoke entire family.
    if (storedToken.revokedAt) {
      logger.warn(
        { family: storedToken.family, userId: storedToken.userId },
        'Refresh token reuse detected — revoking entire family',
      );
      await this.prisma.refreshToken.updateMany({
        where: { family: storedToken.family },
        data: { revokedAt: new Date() },
      });
      throw AppError.refreshReused();
    }

    // Token expired
    if (new Date(storedToken.expiresAt) < new Date()) {
      await this.prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date() },
      });
      throw AppError.refreshExpired();
    }

    // Revoke current token
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    // Issue new pair with same token family
    const { user } = storedToken;
    const tokens = await this.issueTokenPair(
      user.id,
      user.email,
      user.role,
      user.roles,
      user.cohortId,
      storedToken.family,
    );

    return tokens;
  }

  /**
   * Logout: revoke all tokens in the refresh token's family.
   */
  async logoutUser(rawRefreshToken: string): Promise<void> {
    const tokenHash = hashRefreshToken(rawRefreshToken);

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (storedToken) {
      // Revoke entire token family
      await this.prisma.refreshToken.updateMany({
        where: { family: storedToken.family },
        data: { revokedAt: new Date() },
      });
      logger.info({ userId: storedToken.userId }, 'User logged out — token family revoked');
    }
  }

  /**
   * Sign in (or create) a user from a Google ID token (GIS flow).
   *
   * Resolution order:
   *  1. Find by googleId  → return existing user, issue tokens (re-login path).
   *  2. Find by email     → link googleId to existing user (the email-already-in-system path).
   *  3. Else              → create new user with passwordHash=null + googleId set.
   *
   * Race: if two requests with the same googleId pass step 1 and reach step 3
   * simultaneously, the second fails with Prisma P2002 (unique violation). We
   * catch it and re-run the find by googleId path.
   */
  async googleSignInOrCreate(
    idToken: string,
  ): Promise<AuthResult> {
    const payload = await verifyGoogleIdToken(idToken);

    if (!payload.emailVerified) {
      throw AppError.googleEmailUnverified();
    }

    // 1. Existing Google-linked account
    let user = await this.prisma.user.findUnique({
      where: { googleId: payload.googleId },
    });

    // 2. Existing email/password account — link googleId
    if (!user) {
      const byEmail = await this.prisma.user.findUnique({
        where: { email: payload.email },
      });
      if (byEmail) {
        user = await this.prisma.user.update({
          where: { id: byEmail.id },
          data: {
            googleId: payload.googleId,
            // Hydrate avatar only if user doesn't already have one.
            avatarUrl: byEmail.avatarUrl || payload.picture || null,
          },
        });
        logger.info(
          { userId: user.id, googleId: payload.googleId },
          'Linked Google account to existing user',
        );
      }
    }

    // 3. Brand-new user
    if (!user) {
      const initials = computeInitials(payload.name || payload.email.split('@')[0]);
      try {
        user = await this.prisma.user.create({
          data: {
            email: payload.email,
            name: payload.name || payload.email.split('@')[0],
            passwordHash: null,
            googleId: payload.googleId,
            avatarUrl: payload.picture ?? null,
            // ADR-029: las dos columnas, igual que en el registro con contraseña.
            role: 'participante',
            roles: ['participante'],
            initials,
            isActive: false,
          },
        });
        logger.info(
          { userId: user.id, googleId: payload.googleId },
          'Created new waitlisted user via Google sign-in',
        );
      } catch (err) {
        // Race: another request created the same googleId between our lookup
        // and our insert. Re-fetch and continue.
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          user = await this.prisma.user.findUnique({
            where: { googleId: payload.googleId },
          });
          if (!user) {
            // Extremely unlikely (race ran into a DIFFERENT unique violation).
            throw err;
          }
        } else {
          throw err;
        }
      }
    }

    if (!user.isActive) {
      return {
        user: toSafeUser(user),
        waitlisted: true,
      };
    }

    const tokens = await this.issueTokenPair(user.id, user.email, user.role, user.roles, user.cohortId);

    return {
      user: toSafeUser(user),
      tokens,
    };
  }

  /**
   * Get user profile by ID (without sensitive fields).
   */
  async getUserById(userId: string): Promise<SafeUser | null> {
    if (isDevelopment() && userId.startsWith('demo-')) {
      return Object.values(DEMO_USERS).find((user) => user.id === userId) ?? null;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) return null;

    return toSafeUser(user);
  }

  // --- Private helpers ---

  private async issueTokenPair(
    userId: string,
    email: string,
    role: string,
    // ADR-029: el conjunto va al token para que el servidor derive los permisos.
    // Opcional porque las filas sin migrar aún no lo tienen; `authenticate` cae
    // a `[role]` en ese caso.
    roles: TokenPayload['roles'],
    cohort?: string | null,
    existingFamily?: string,
  ): Promise<AuthTokens> {
    // The access-token session identity must be established before signing.
    // Refresh rotation supplies the existing family; a new login gets a new
    // family, preserving isolation between independent sessions.
    const family = existingFamily || crypto.randomUUID();

    const payload: TokenPayload = {
      sub: userId,
      sid: family,
      role: role as TokenPayload['role'],
      ...(roles && roles.length > 0 ? { roles } : {}),
      email,
      ...(cohort ? { cohort } : {}),
    };

    const accessToken = generateAccessToken(payload);
    const rawRefreshToken = generateRefreshToken();

    await this.prisma.refreshToken.create({
      data: {
        tokenHash: hashRefreshToken(rawRefreshToken),
        userId,
        family,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return { accessToken, refreshToken: rawRefreshToken };
  }
}
