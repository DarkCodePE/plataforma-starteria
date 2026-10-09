/**
 * workspaces.test.ts — la elección de zona (ADR-029 §5).
 *
 * Lo que estos tests protegen es que el switcher no se convierta en una jaula
 * nueva: quien tiene una sola zona no ve UI, y ninguna combinación de storage
 * corrupto puede dejar a nadie sin navegación.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  availableWorkspaces,
  shouldShowSwitcher,
  resolveInitialWorkspace,
  rememberWorkspace,
} from '../workspaces';

const participante = { permissions: ['project:own'] };
const portfolioLead = { permissions: ['portfolio:read', 'portfolio:write'] };
const dobleRol = { permissions: ['project:own', 'portfolio:read', 'portfolio:write'] };
const mentor = { permissions: ['mentor:panel'] };

beforeEach(() => window.localStorage.clear());

describe('availableWorkspaces', () => {
  it('el doble rol tiene las dos zonas', () => {
    expect(availableWorkspaces(dobleRol).map((w) => w.id)).toEqual(['iniciativas', 'portafolio']);
  });

  it('un participante sólo tiene el workspace', () => {
    expect(availableWorkspaces(participante).map((w) => w.id)).toEqual(['iniciativas']);
  });

  it('un portfolio lead puro tiene las dos: el workspace es la zona por defecto', () => {
    expect(availableWorkspaces(portfolioLead).map((w) => w.id)).toEqual([
      'iniciativas',
      'portafolio',
    ]);
  });

  it('un mentor conserva el workspace aunque no tenga project:own', () => {
    // Gatear la zona por defecto con `project:own` dejaría a mentor y sponsor sin
    // NINGUNA zona. Hoy viven bajo AppLayout y su navegación no cambia.
    expect(availableWorkspaces(mentor).map((w) => w.id)).toEqual(['iniciativas']);
  });

  it('sin sesión queda la zona por defecto, nunca cero zonas', () => {
    expect(availableWorkspaces(null).map((w) => w.id)).toEqual(['iniciativas']);
  });
});

describe('shouldShowSwitcher', () => {
  it('se muestra a quien puede elegir', () => {
    expect(shouldShowSwitcher(dobleRol)).toBe(true);
  });

  it('NO se muestra a quien tiene una sola zona: su experiencia no cambia', () => {
    expect(shouldShowSwitcher(participante)).toBe(false);
    expect(shouldShowSwitcher(mentor)).toBe(false);
  });
});

describe('resolveInitialWorkspace', () => {
  it('vuelve a la última zona usada', () => {
    rememberWorkspace('portafolio');
    expect(resolveInitialWorkspace(dobleRol).id).toBe('portafolio');
  });

  it('sin preferencia arranca en la primera disponible', () => {
    expect(resolveInitialWorkspace(dobleRol).id).toBe('iniciativas');
  });

  it('un portfolio lead puro sin preferencia arranca en portafolio: su workspace siempre está vacío', () => {
    // No es parte del equipo de ninguna iniciativa (las crea el participante), así que
    // "Mis iniciativas" le mostraría "No tienes iniciativas aún".
    expect(resolveInitialWorkspace(portfolioLead).id).toBe('portafolio');
  });

  it('un portfolio lead puro que eligió el workspace vuelve a él', () => {
    rememberWorkspace('iniciativas');
    expect(resolveInitialWorkspace(portfolioLead).id).toBe('iniciativas');
  });

  it('una zona guardada a la que YA NO tiene acceso degrada a una permitida', () => {
    // Le retiraron el rol de portafolio pero su localStorage sigue apuntando allí.
    rememberWorkspace('portafolio');
    expect(resolveInitialWorkspace(participante).id).toBe('iniciativas');
  });

  it('basura en localStorage degrada en vez de dejar sin navegación', () => {
    window.localStorage.setItem('starteria.workspace', 'zona-que-no-existe');
    expect(resolveInitialWorkspace(dobleRol).id).toBe('iniciativas');
  });

  it('si localStorage lanza, sigue devolviendo una zona', () => {
    // Modo privado de algunos navegadores: leer lanza en vez de devolver null.
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage bloqueado');
    });

    expect(resolveInitialWorkspace(dobleRol).id).toBe('iniciativas');
    spy.mockRestore();
  });

  it('rememberWorkspace no propaga un fallo de storage', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage lleno');
    });

    expect(() => rememberWorkspace('portafolio')).not.toThrow();
    spy.mockRestore();
  });
});
