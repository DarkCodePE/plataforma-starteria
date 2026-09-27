// Dependencies: jsonwebtoken, @types/jsonwebtoken
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../../config';
import { AppError } from '../../shared/errors/AppError';
import { Role } from '../../shared/types/user.types';

export interface TokenPayload {
  sub: string;
  /**
   * Stable authenticated-session lineage. Present on persisted production
   * tokens and optional only for legacy/development tokens without a
   * refresh-family binding.
   */
  sid?: string;
  /**
   * Rol PRIMARIO. Sigue siendo obligatorio: es la etiqueta de presentación, el eje
   * que usa `resolveProjectAccess`, y el respaldo que mantiene válidos los tokens
   * emitidos ANTES de ADR-029 (que no traen `roles`).
   */
  role: Role;
  /**
   * ADR-029: el conjunto de roles, del que se derivan los permisos en el servidor.
   *
   * Opcional a propósito: un token emitido antes de este cambio no lo trae, y debe
   * seguir siendo válido hasta expirar en vez de echar al usuario a mitad de sesión.
   * `authenticate` cae a `[role]` cuando falta.
   *
   * El token lleva ROLES, no permisos ya derivados: meterlos aquí congelaría la
   * tabla de derivación dentro de cada sesión viva, y corregirla exigiría esperar
   * a que expiren todas. Derivando en servidor, un cambio aplica en la siguiente
   * petición. El precio es el desfase de 15 min ante un cambio de ASIGNACIÓN,
   * que ya existía y se mitiga revocando los refresh tokens (ADR-028).
   */
  roles?: Role[];
  email: string;
  cohort?: string;
}

/**
 * Generate a JWT access token (HS256 for MVP, upgrade to RS256 per ADR-003).
 * Expiry: 15 minutes.
 */
export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
    issuer: 'starteria-api',
    audience: 'starteria-dashboard',
  });
}

/**
 * Generate a cryptographically secure opaque refresh token (128 hex chars).
 */
export function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString('hex');
}

/**
 * Verify and decode a JWT access token.
 * Throws AppError(401) on invalid or expired token.
 */
export function verifyAccessToken(token: string): TokenPayload & jwt.JwtPayload {
  try {
    return jwt.verify(token, config.jwtSecret, {
      issuer: 'starteria-api',
      audience: 'starteria-dashboard',
    }) as TokenPayload & jwt.JwtPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new AppError(401, 'Token expirado', 'TOKEN_EXPIRED');
    }
    throw new AppError(401, 'Token invalido', 'TOKEN_INVALID');
  }
}

/**
 * Hash a refresh token with SHA-256 for secure storage.
 * Never store plaintext refresh tokens.
 */
export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
