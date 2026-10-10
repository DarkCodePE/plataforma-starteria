/**
 * roleLabels.test.ts — la tarjeta de usuario decía "Participante" para viewer y colaborador,
 * porque `User.role` los colapsa en `owner`. La etiqueta sale del rol de plataforma.
 */
import { describe, it, expect } from 'vitest';
import { userRoleLabel } from '../roleLabels';
import { mapBackendUser } from '../../context/AppContext';
import type { AuthUser } from '../../services/auth.service';

const desde = (role: AuthUser['role']) =>
  userRoleLabel(mapBackendUser({ id: 'u1', name: 'Ana', email: 'a@x.com', role, initials: 'AN' } as AuthUser));

describe('userRoleLabel', () => {
  it.each([
    ['participante', 'Participante'],
    ['colaborador', 'Colaborador'],
    ['viewer', 'Lector'],
    ['sponsor', 'Sponsor'],
    ['portfolio_lead', 'Portfolio Lead'],
    ['admin', 'Administrador'],
    ['mentor', 'Mentor'],
  ] as const)('%s se muestra como %s', (role, label) => {
    expect(desde(role)).toBe(label);
  });

  it('si el selector demo cambió el rol interno, manda ese', () => {
    expect(userRoleLabel({ role: 'mentor', platformRole: 'viewer' })).toBe('Mentor');
  });

  it('sin usuario cae en Participante', () => {
    expect(userRoleLabel(null)).toBe('Participante');
  });
});
