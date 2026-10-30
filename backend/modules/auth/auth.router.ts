import { Router } from 'express';
import { prisma } from '../../shared/db/prisma';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { authenticate } from './auth.middleware';
import { validate } from '../../shared/middleware/validate';
import { registerSchema, loginSchema, googleSignInSchema } from './auth.schemas';
import { loginLimiter, loginEmailLimiter, registerEmailLimiter, googleLimiter, refreshLimiter } from './rate-limiter';

// Dependencies: cookie-parser must be applied at app level for req.cookies
const service = new AuthService(prisma);
const controller = new AuthController(service);

export const authRouter = Router();

// POST /api/v1/auth/register — Register new user (owner only)
// Per-email limiter runs after validate so it sees the normalized email.
authRouter.post('/register', validate(registerSchema), registerEmailLimiter, controller.register);

// POST /api/v1/auth/login — Login with email/password (per-IP + per-email rate limit)
authRouter.post('/login', loginLimiter, validate(loginSchema), loginEmailLimiter, controller.login);

// POST /api/v1/auth/google — Sign in or sign up via Google Identity Services.
// IP-based rate-limit only; per-email is not needed because forging a valid
// Google ID token requires Google's private key.
authRouter.post('/google', googleLimiter, validate(googleSignInSchema), controller.google);

// POST /api/v1/auth/refresh — Refresh access token via HTTP-only cookie
authRouter.post('/refresh', refreshLimiter, controller.refresh);

// POST /api/v1/auth/logout — Logout and invalidate refresh token family
authRouter.post('/logout', authenticate, controller.logout);

// GET  /api/v1/auth/me — Get current authenticated user
authRouter.get('/me', authenticate, controller.me);
