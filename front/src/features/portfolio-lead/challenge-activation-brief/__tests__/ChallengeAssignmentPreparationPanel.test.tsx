import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  getActivationBrief: vi.fn(),
  listChallengeHandoffAssignments: vi.fn(),
  listAssignableInitiatives: vi.fn(),
  createChallengeHandoffAssignment: vi.fn(),
  updateChallengeHandoffAssignment: vi.fn(),
}));

vi.mock('../challengeActivationBriefClient', () => api);
import { ChallengeAssignmentPreparationPanel } from '../ChallengeAssignmentPreparationPanel';

const confirmedVersion = {
  id: 'version-5', versionNumber: 5, status: 'CONFIRMED' as const,
  intent: 'Reducir la principal barrera de activaciÃ³n.', scope: 'Contrastar onboarding y diagnÃ³stico.',
  strategicContextRefs: { objective: 'Mejorar activaciÃ³n' },
  inheritedContext: { expectedDeliverable: 'RecomendaciÃ³n priorizada con evidencia.', decisionToEnable: 'Elegir la primera barrera.' },
  constraintsSnapshot: ['RevisiÃ³n legal'], knownGaps: ['Falta lÃ­nea base'], sourceRefs: ['ImportaciÃ³n Q3'], provenance: { source: 'PL05_COPILOT' },
  createdAt: '2026-10-22T00:00:00.000Z', confirmedAt: '2026-10-22T01:00:00.000Z',
};
const brief = { id: 'brief-a', challengeId: 'challenge-1', organizationId: 'org-1', versions: [confirmedVersion] };
const target = { challengeId: 'challenge-1', briefId: 'brief-a', briefVersionId: 'version-5', challengeName: 'Reducir fricciÃ³n' };

describe('ChallengeAssignmentPreparationPanel - PL-06A multiple preparation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getActivationBrief.mockResolvedValue(brief);
    api.listChallengeHandoffAssignments.mockResolvedValue([]);
    api.listAssignableInitiatives.mockResolvedValue({ canonicalInitiatives: [] });
  });

  it('uses Add assignment as the primary CTA and updates the canonical unassigned indicator after saving', async () => {
    const user = userEvent.setup();
    api.listAssignableInitiatives.mockResolvedValue({
      canonicalInitiatives: [{ id: 'project-1', name: 'ActivaciÃ³n guiada', description: 'Reducir abandonos durante el alta.', ownerEmail: 'initiative-owner@starteria.test', ownerName: 'Initiative Owner' }],
      importedRecords: [],
      otherImportedRecords: [],
    });
    api.createChallengeHandoffAssignment.mockResolvedValue({ assignment: {
      id: 'assignment-project-1', state: 'CREATED', version: 1, targetKind: 'EXISTING_INITIATIVE', initiativeId: 'project-1',
      briefVersionId: null, contextNote: '', invitedEmailNormalized: 'initiative-owner@starteria.test', initiative: { id: 'project-1', name: 'ActivaciÃ³n guiada' },
      members: [{ identityKey: 'initiative-owner@starteria.test', emailNormalized: 'initiative-owner@starteria.test', role: 'OWNER' }],
    }, idempotent: false });

    render(<ChallengeAssignmentPreparationPanel target={target} />);

    expect(await screen.findByRole('heading', { name: 'Prepara las asignaciones de este reto' })).toBeInTheDocument();
    expect(screen.getByText('1 iniciativa asignable sin encargo')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Asignar responsable a ActivaciÃ³n guiada/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Agregar asignaciÃ³n' }));
    await user.click(screen.getByRole('button', { name: 'Continuar una iniciativa existente' }));
    await user.selectOptions(screen.getByLabelText('Iniciativa a continuar'), 'project-1');
    expect(screen.getByLabelText('Iniciativa a continuar')).toHaveValue('project-1');
    expect(screen.getByLabelText('Persona responsable')).toHaveValue('initiative-owner@starteria.test');
    await user.click(screen.getByRole('button', { name: 'Revisar asignaciÃ³n' }));
    await user.click(screen.getByRole('button', { name: 'Guardar asignaciÃ³n' }));
    await waitFor(() => expect(screen.getByText('0 iniciativas asignables sin encargo')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Agregar otra asignaciÃ³n' })).toBeInTheDocument();
  });

  it('recovers the exact Brief and does not create on entry or review', async () => {
    const user = userEvent.setup();
    render(<ChallengeAssignmentPreparationPanel target={target} />);
    expect(await screen.findByRole('heading', { name: 'Prepara las asignaciones de este reto' })).toBeInTheDocument();
    expect(screen.getByText(/puedes dejar otras para despuÃ©s/i)).toBeInTheDocument();
    expect(screen.getByText(/una persona responsable por encargo y hasta dos colaboradores/i)).toBeInTheDocument();
    expect(screen.getByText('VersiÃ³n 5 Â· Confirmada e inmutable')).toBeInTheDocument();
    expect(screen.queryByText(confirmedVersion.intent)).not.toBeInTheDocument();
    const disclosure = screen.getByRole('button', { name: 'Ver contenido del Brief' });
    expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    disclosure.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'Ocultar contenido del Brief' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(confirmedVersion.intent)).toBeInTheDocument();
    expect(screen.getByText('ImportaciÃ³n Q3')).toBeInTheDocument();
    expect(api.createChallengeHandoffAssignment).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Agregar asignaciÃ³n' }));
    expect(screen.getByRole('heading', { name: 'Define este encargo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agregar otra asignaciÃ³n' })).toBeDisabled();
    expect(screen.getByText(/termina o cancela la acciÃ³n abierta antes de preparar otro encargo/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText('Persona responsable'), 'owner@starteria.test');
    await user.click(screen.getByRole('button', { name: 'Revisar asignaciÃ³n' }));
    expect(screen.getByRole('heading', { name: 'Revisa este encargo' })).toBeInTheDocument();
    expect(api.createChallengeHandoffAssignment).not.toHaveBeenCalled();
  });

  it('counts only canonical Projects without active initiative assignments and ignores CHALLENGE assignments', async () => {
    const user = userEvent.setup();
    api.listAssignableInitiatives.mockResolvedValue({
      canonicalInitiatives: [
        { id: 'project-1', name: 'ActivaciÃ³n guiada', ownerEmail: 'one@starteria.test', ownerName: 'One' },
        { id: 'project-2', name: 'RecuperaciÃ³n temprana', ownerEmail: 'two@starteria.test', ownerName: 'Two' },
      ],
      importedRecords: [
        { id: 'work-1', label: 'Onboarding guiado', reason: 'IMPORTED_RECORD_NOT_CANONICAL' },
        { id: 'work-2', label: 'Seguimiento manual', reason: 'IMPORTED_RECORD_NOT_CANONICAL' },
      ],
    });
    api.listChallengeHandoffAssignments.mockResolvedValue([
      { id: 'assignment-1', state: 'CREATED', version: 1, targetKind: 'CHALLENGE', initiativeId: null, contextNote: null, briefVersionId: 'version-5', invitedEmailNormalized: 'owner@starteria.test', members: [] },
      { id: 'assignment-2', state: 'CREATED', version: 1, targetKind: 'EXISTING_INITIATIVE', initiativeId: 'project-1', contextNote: null, briefVersionId: 'other-version', invitedEmailNormalized: 'one@starteria.test', members: [] },
      { id: 'assignment-sent', state: 'SENT', version: 2, targetKind: 'CHALLENGE', initiativeId: null, contextNote: null, briefVersionId: 'version-5', invitedEmailNormalized: 'sent@starteria.test', members: [] },
    ]);

    render(<ChallengeAssignmentPreparationPanel target={target} />);

    expect(await screen.findByText('1 iniciativa asignable sin encargo')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Resumen de cobertura' })).not.toBeInTheDocument();
    expect(screen.queryByText('ActivaciÃ³n guiada')).not.toBeInTheDocument();
    expect(screen.queryByText('RecuperaciÃ³n temprana')).not.toBeInTheDocument();
    expect(screen.queryByText('Onboarding guiado')).not.toBeInTheDocument();
    expect(screen.queryByText('Seguimiento manual')).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/%|pendientes obligatorias|todas asignadas/i);
  });

  it('prepares more than one independent CHALLENGE assignment by explicit confirmation', async () => {
    const user = userEvent.setup();
    api.createChallengeHandoffAssignment
      .mockResolvedValueOnce({ assignment: { id: 'assignment-1', state: 'CREATED', version: 1, targetKind: 'CHALLENGE', initiativeId: null, contextNote: 'Validar onboarding.', briefVersionId: 'version-5', invitedEmailNormalized: 'owner@starteria.test', members: [{ identityKey: 'owner@starteria.test', emailNormalized: 'owner@starteria.test', role: 'OWNER' }] }, idempotent: false })
      .mockResolvedValueOnce({ assignment: { id: 'assignment-2', state: 'CREATED', version: 1, targetKind: 'CHALLENGE', initiativeId: null, contextNote: '', briefVersionId: 'version-5', invitedEmailNormalized: 'second@starteria.test', members: [{ identityKey: 'second@starteria.test', emailNormalized: 'second@starteria.test', role: 'OWNER' }] }, idempotent: false });
    render(<ChallengeAssignmentPreparationPanel target={target} />);
    await user.click(await screen.findByRole('button', { name: 'Agregar asignaciÃ³n' }));
    await user.type(screen.getByLabelText('Persona responsable'), 'OWNER@Starteria.test');
    await user.type(screen.getByLabelText('Contexto especÃ­fico del encargo'), 'Validar onboarding.');
    await user.click(screen.getByRole('button', { name: 'Revisar asignaciÃ³n' }));
    await user.click(screen.getByRole('button', { name: 'Guardar asignaciÃ³n' }));
    await waitFor(() => expect(api.createChallengeHandoffAssignment).toHaveBeenCalledWith('challenge-1', {
      targetKind: 'CHALLENGE', initiativeId: null, briefId: 'brief-a', briefVersionId: 'version-5', contextNote: 'Validar onboarding.', invitedEmailNormalized: 'owner@starteria.test',
      members: [{ identityKey: 'owner@starteria.test', emailNormalized: 'owner@starteria.test', role: 'OWNER' }],
    }, expect.any(String)));
    expect(screen.getByRole('heading', { name: 'Asignaciones preparadas' })).toBeInTheDocument();
    expect(screen.getByText('Preparada, aÃºn no enviada')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Agregar otra asignaciÃ³n' }));
    await user.type(screen.getByLabelText('Persona responsable'), 'second@starteria.test');
    await user.click(screen.getByRole('button', { name: 'Revisar asignaciÃ³n' }));
    await user.click(screen.getByRole('button', { name: 'Guardar asignaciÃ³n' }));
    await waitFor(() => expect(api.createChallengeHandoffAssignment).toHaveBeenCalledTimes(2));
    expect(screen.getByText('owner@starteria.test')).toBeInTheDocument();
    expect(screen.getByText('second@starteria.test')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /enviar|aceptar|rechazar|iniciar/i })).not.toBeInTheDocument();
  });

  it('re-enters every prepared Assignment for the Challenge by assignmentId without collapsing Brief versions', async () => {
    api.listChallengeHandoffAssignments.mockResolvedValue([
      { id: 'assignment-existing', state: 'CREATED', version: 1, targetKind: 'CHALLENGE', initiativeId: null, contextNote: 'Validar onboarding.', briefVersionId: 'version-5', invitedEmailNormalized: 'owner@starteria.test', members: [{ identityKey: 'owner@starteria.test', emailNormalized: 'owner@starteria.test', role: 'OWNER' }] },
      { id: 'assignment-existing', state: 'CREATED', version: 1, targetKind: 'CHALLENGE', initiativeId: null, contextNote: 'Validar onboarding.', briefVersionId: 'version-5', invitedEmailNormalized: 'owner@starteria.test', members: [{ identityKey: 'owner@starteria.test', emailNormalized: 'owner@starteria.test', role: 'OWNER' }] },
      { id: 'assignment-second', state: 'CREATED', version: 1, targetKind: 'CHALLENGE', initiativeId: null, contextNote: 'Contrastar activaciÃ³n.', briefVersionId: 'version-5', invitedEmailNormalized: 'second@starteria.test', members: [{ identityKey: 'second@starteria.test', emailNormalized: 'second@starteria.test', role: 'OWNER' }] },
      { id: 'assignment-other', state: 'CREATED', version: 1, targetKind: 'CHALLENGE', initiativeId: null, contextNote: '', briefVersionId: 'other-version', invitedEmailNormalized: 'other@starteria.test', members: [] },
    ]);
    render(<ChallengeAssignmentPreparationPanel target={target} />);
    expect(await screen.findByText('owner@starteria.test')).toBeInTheDocument();
    expect(screen.getByText('second@starteria.test')).toBeInTheDocument();
    expect(screen.getByText('other@starteria.test')).toBeInTheDocument();
    expect(screen.getAllByText('owner@starteria.test')).toHaveLength(1);
    expect(api.createChallengeHandoffAssignment).not.toHaveBeenCalled();
  });

  it('offers Existing Initiative only for canonical linked Projects in the reusable assignment form', async () => {
    api.listAssignableInitiatives.mockResolvedValue({ canonicalInitiatives: [{ id: 'project-1', name: 'ActivaciÃ³n guiada', ownerEmail: 'initiative-owner@starteria.test' }], importedRecords: [] });
    const user = userEvent.setup();
    render(<ChallengeAssignmentPreparationPanel target={target} />);
    await user.click(await screen.findByRole('button', { name: 'Agregar asignaciÃ³n' }));
    await user.click(screen.getByRole('button', { name: 'Continuar una iniciativa existente' }));
    await user.selectOptions(screen.getByLabelText('Iniciativa a continuar'), 'project-1');
    expect(screen.getByText(/Iniciativa vÃ¡lida y vinculada a este reto/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Adjuntar tambiÃ©n este Brief confirmado')).not.toBeChecked();
  });

  it('edits a CREATED assignment with optimistic versioning', async () => {
    api.listChallengeHandoffAssignments.mockResolvedValue([{ id: 'assignment-existing', state: 'CREATED', version: 3, targetKind: 'CHALLENGE', initiativeId: null, contextNote: 'Contexto inicial.', briefVersionId: 'version-5', invitedEmailNormalized: 'owner@starteria.test', members: [{ identityKey: 'owner@starteria.test', emailNormalized: 'owner@starteria.test', role: 'OWNER' }] }]);
    api.updateChallengeHandoffAssignment.mockResolvedValue({ assignment: { id: 'assignment-existing', state: 'CREATED', version: 4, targetKind: 'CHALLENGE', initiativeId: null, contextNote: 'Contexto ajustado.', briefVersionId: 'version-5', invitedEmailNormalized: 'owner@starteria.test', members: [{ identityKey: 'owner@starteria.test', emailNormalized: 'owner@starteria.test', role: 'OWNER' }] }, idempotent: false });
    const user = userEvent.setup();
    render(<ChallengeAssignmentPreparationPanel target={target} />);
    await user.click(await screen.findByRole('button', { name: 'Editar asignaciÃ³n para owner@starteria.test' }));
    await user.clear(screen.getByLabelText('Contexto especÃ­fico del encargo'));
    await user.type(screen.getByLabelText('Contexto especÃ­fico del encargo'), 'Contexto ajustado.');
    await user.click(screen.getByRole('button', { name: 'Revisar asignaciÃ³n' }));
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(api.updateChallengeHandoffAssignment).toHaveBeenCalledWith('assignment-existing', expect.objectContaining({ expectedVersion: 3, contextNote: 'Contexto ajustado.' }), expect.any(String)));
  });

  it('rejects duplicated people before persistence', async () => {
    const user = userEvent.setup();
    render(<ChallengeAssignmentPreparationPanel target={target} />);
    await user.click(await screen.findByRole('button', { name: 'Agregar asignaciÃ³n' }));
    await user.type(screen.getByLabelText('Persona responsable'), 'same@starteria.test');
    await user.type(screen.getByLabelText('Colaborador 1'), 'SAME@starteria.test');
    await user.click(screen.getByRole('button', { name: 'Revisar asignaciÃ³n' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/cada persona debe aparecer una sola vez/i);
    expect(api.createChallengeHandoffAssignment).not.toHaveBeenCalled();
  });
});

