import { z } from 'zod/v3';
import { PLATFORM_ROLES } from '../../shared/types/user.types';

export const registerSchema = z.object({
  email: z.string().email('Correo electronico invalido'),
  password: z
    .string()
    .min(8, 'La contrasena debe tener al menos 8 caracteres')
    .regex(/[A-Z]/, 'Debe contener al menos una mayuscula')
    .regex(/[a-z]/, 'Debe contener al menos una minuscula')
    .regex(/[0-9]/, 'Debe contener al menos un numero'),
  name: z
    .string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede superar 100 caracteres')
    .transform((v) => v.trim()),
  role: z.enum(PLATFORM_ROLES).default('participante'),
});

export const loginSchema = z.object({
  email: z.string().email('Correo electronico invalido'),
  password: z.string().min(1, 'La contrasena es requerida'),
});

export const googleSignInSchema = z.object({
  // Google ID tokens are JWTs that are typically 800-1500 chars long. Lower bound
  // protects against obvious garbage; the real validation happens server-side
  // via google-auth-library.verifyIdToken().
  idToken: z.string().min(20, 'Token de Google invalido'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type GoogleSignInInput = z.infer<typeof googleSignInSchema>;
