/**
 * InitiativeTeamPanel — equipo de la iniciativa desde el portafolio (GET/PUT/DELETE
 * /portfolio/initiatives/:projectId/team). Fija qué se pinta según `portfolio:write` y que
 * al OWNER no se lo puede quitar ni degradar desde la UI.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InitiativeTeamPanel } from '../InitiativeTeamPanel';

const getInitiativeTeam = vi.fn();
const upsertInitiativeTeamMember = vi.fn();
const removeInitiativeTeamMember = vi.fn();
const listChallengeTeam = vi.fn();
const appUser = vi.hoisted(() => ({ current: null as null | { permissions: string[] } }));

vi.mock('../../../../../app/services/portfolioService', () => ({
  getInitiativeTeam: (id: string) => getInitiativeTeam(id),
  upsertInitiativeTeamMember: (...args: unknown[]) => upsertInitiativeTeamMember(...args),
  removeInitiativeTeamMember: (...args: unknown[]) => removeInitiativeTeamMember(...args),
  listChallengeTeam: (id: string) => listChallengeTeam(id),
}));

vi.mock('../../../../../app/context/AppContext', () => ({
  useOptionalApp: () => (appUser.current ? { user: appUser.current } : null),
}));

const TEAM = {
  owner: 'u-owner',
  inheritedCount: 1,
  label: 'Equipo de 3 (1 heredado)',
  members: [
    { userId: 'u-owner', role: 'OWNER', status: 'ACTIVE', inheritedFromChallenge: false, user: { id: 'u-owner', name: 'Ana Owner', email: 'ana@acme.io' } },
    { userId: 'u-ed', role: 'EDITOR', status: 'ACTIVE', inheritedFromChallenge: true, user: { id: 'u-ed', name: 'Beto Editor', email: 'beto@acme.io' } },
    { userId: 'u-view', role: 'VIEWER', status: 'PENDING', inheritedFromChallenge: false, user: { id: 'u-view', name: 'Caro Lectora', email: 'caro@acme.io' } },
  ],
};

function memberRow(name: string) {
  return screen.getByText(name).closest('li') as HTMLElement;
}

describe('InitiativeTeamPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appUser.current = null;
    getInitiativeTeam.mockResolvedValue(TEAM);
    listChallengeTeam.mockResolvedValue([
      { id: 'ct1', userId: 'u-ed', role: 'EDITOR', status: 'ACTIVE', user: { id: 'u-ed', name: 'Beto Editor', email: 'beto@acme.io' } },
      { id: 'ct2', userId: 'u-new', role: 'VIEWER', status: 'ACTIVE', user: { id: 'u-new', name: 'Dani Nueva', email: 'dani@acme.io' } },
      { id: 'ct3', userId: null, label: 'Proveedor externo', role: 'VIEWER', status: 'ACTIVE' },
    ]);
    upsertInitiativeTeamMember.mockResolvedValue({});
    removeInitiativeTeamMember.mockResolvedValue({});
  });

  it('lista miembros con rol y estado en español, en sólo lectura sin portfolio:write', async () => {
    render(<InitiativeTeamPanel projectId="p1" challengeId="c1" initiativeName="Onboarding" />);

    expect(await screen.findByText('Ana Owner')).toBeInTheDocument();
    expect(getInitiativeTeam).toHaveBeenCalledWith('p1');
    expect(screen.getByText('Equipo de 3 (1 heredado)')).toBeInTheDocument();
    expect(within(memberRow('Ana Owner')).getByText('Propietario')).toBeInTheDocument();
    expect(within(memberRow('Beto Editor')).getByText('Editor')).toBeInTheDocument();
    expect(within(memberRow('Beto Editor')).getByText('Heredado del reto')).toBeInTheDocument();
    expect(within(memberRow('Caro Lectora')).getByText('Lector')).toBeInTheDocument();
    expect(within(memberRow('Caro Lectora')).getByText('Invitación pendiente')).toBeInTheDocument();
    expect(within(memberRow('Ana Owner')).getByText('Activo')).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: /Quitar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Agregar persona al equipo' })).not.toBeInTheDocument();
    expect(listChallengeTeam).not.toHaveBeenCalled();
  });

  it('con portfolio:write el OWNER no tiene acciones y el resto sí', async () => {
    appUser.current = { permissions: ['portfolio:read', 'portfolio:write'] };
    render(<InitiativeTeamPanel projectId="p1" challengeId="c1" />);

    await screen.findByText('Ana Owner');
    const owner = memberRow('Ana Owner');
    expect(within(owner).queryByRole('combobox')).not.toBeInTheDocument();
    expect(within(owner).queryByRole('button')).not.toBeInTheDocument();
    expect(within(owner).getByText('Propietario')).toBeInTheDocument();

    const roleSelect = screen.getByLabelText('Rol de Beto Editor') as HTMLSelectElement;
    // No se ofrece OWNER: degradar/duplicar al owner no tiene flujo de transferencia.
    expect(Array.from(roleSelect.options).map(o => o.value)).toEqual(['EDITOR', 'VIEWER']);
    expect(screen.getByRole('button', { name: 'Quitar a Beto Editor' })).toBeInTheDocument();
  });

  it('cambia el rol con PUT y recarga el equipo', async () => {
    appUser.current = { permissions: ['portfolio:write'] };
    const user = userEvent.setup();
    render(<InitiativeTeamPanel projectId="p1" challengeId="c1" />);

    await user.selectOptions(await screen.findByLabelText('Rol de Beto Editor'), 'VIEWER');

    expect(upsertInitiativeTeamMember).toHaveBeenCalledWith('p1', 'u-ed', { role: 'VIEWER' });
    expect(getInitiativeTeam).toHaveBeenCalledTimes(2);
  });

  it('quita a un miembro sólo después de confirmar', async () => {
    appUser.current = { permissions: ['portfolio:write'] };
    const user = userEvent.setup();
    render(<InitiativeTeamPanel projectId="p1" challengeId="c1" />);

    await user.click(await screen.findByRole('button', { name: 'Quitar a Caro Lectora' }));
    expect(removeInitiativeTeamMember).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Confirmar quitar' }));

    expect(removeInitiativeTeamMember).toHaveBeenCalledWith('p1', 'u-view');
  });

  it('agrega desde el equipo del reto (sin repetir miembros ni filas sin usuario) o por ID', async () => {
    appUser.current = { permissions: ['portfolio:write'] };
    const user = userEvent.setup();
    render(<InitiativeTeamPanel projectId="p1" challengeId="c1" />);

    await screen.findByText('Ana Owner');
    const personSelect = screen.getByLabelText('Persona') as HTMLSelectElement;
    await screen.findByRole('option', { name: 'Dani Nueva (equipo del reto)' });
    expect(Array.from(personSelect.options).map(o => o.value)).toEqual(['', 'u-new', '__otro__']);
    expect((screen.getByLabelText('Rol') as HTMLSelectElement).value).toBe('EDITOR');

    await user.selectOptions(personSelect, 'u-new');
    await user.selectOptions(screen.getByLabelText('Rol'), 'VIEWER');
    await user.click(screen.getByRole('button', { name: 'Agregar' }));
    expect(upsertInitiativeTeamMember).toHaveBeenCalledWith('p1', 'u-new', { role: 'VIEWER' });

    await user.selectOptions(screen.getByLabelText('Persona'), '__otro__');
    await user.type(screen.getByLabelText('ID de usuario'), 'u-otro');
    await user.click(screen.getByRole('button', { name: 'Agregar' }));
    expect(upsertInitiativeTeamMember).toHaveBeenLastCalledWith('p1', 'u-otro', { role: 'VIEWER' });
  });

  it('muestra el error del backend (p.ej. usuario inexistente)', async () => {
    appUser.current = { permissions: ['portfolio:write'] };
    upsertInitiativeTeamMember.mockRejectedValue({ response: { data: { error: { message: 'Usuario no encontrado' } } } });
    const user = userEvent.setup();
    render(<InitiativeTeamPanel projectId="p1" challengeId="c1" />);

    await screen.findByText('Ana Owner');
    await user.selectOptions(screen.getByLabelText('Persona'), '__otro__');
    await user.type(screen.getByLabelText('ID de usuario'), 'nadie');
    await user.click(screen.getByRole('button', { name: 'Agregar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Usuario no encontrado');
  });

  it('sin projectId explica que no hay equipo y no llama a la API', () => {
    render(<InitiativeTeamPanel projectId={undefined} challengeId="c1" />);
    expect(screen.getByText(/no tiene un proyecto vinculado/)).toBeInTheDocument();
    expect(getInitiativeTeam).not.toHaveBeenCalled();
  });
});
