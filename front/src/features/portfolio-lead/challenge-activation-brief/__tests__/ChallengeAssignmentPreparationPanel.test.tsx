import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  getActivationBrief: vi.fn(),
  listChallengeHandoffAssignments: vi.fn(),
  listAssignableInitiatives: vi.fn(),
  registerImportedInitiative: vi.fn(),
  linkImportedInitiative: vi.fn(),
  createChallengeHandoffAssignment: vi.fn(),
  updateChallengeHandoffAssignment: vi.fn(),
  sendHandoffInvitationBatch: vi.fn(),
}));

vi.mock('../challengeActivationBriefClient', () => api);
import { ChallengeAssignmentPreparationPanel } from '../ChallengeAssignmentPreparationPanel';

const confirmedVersion = {
  id: 'version-5', versionNumber: 5, status: 'CONFIRMED' as const,
  intent: 'Reducir la principal barrera de activación.', scope: 'Contrastar onboarding y diagnóstico.',
  strategicContextRefs: { objective: 'Mejorar activación' },
  inheritedContext: { expectedDeliverable: 'Recomendación priorizada con evidencia.', decisionToEnable: 'Elegir la primera barrera.' },
  constraintsSnapshot: ['Revisión legal'], knownGaps: ['Falta línea base'], sourceRefs: ['Importación Q3'], provenance: { source: 'PL05_COPILOT' },
  createdAt: '2026-10-22T00:00:00.000Z', confirmedAt: '2026-10-22T01:00:00.000Z',
};
const brief = { id: 'brief-a', challengeId: 'challenge-1', organizationId: 'org-1', versions: [confirmedVersion] };
const target = { challengeId: 'challenge-1', briefId: 'brief-a', briefVersionId: 'version-5', challengeName: 'Reducir fricción' };

describe('ChallengeAssignmentPreparationPanel - PL-06A multiple preparation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getActivationBrief.mockResolvedValue(brief);
    api.listChallengeHandoffAssignments.mockResolvedValue([]);
    api.listAssignableInitiatives.mockResolvedValue({ canonicalInitiatives: [], importedRecords: [{ id: 'work-1', label: 'Onboarding guiado', reason: 'IMPORTED_RECORD_NOT_CANONICAL' }], otherImportedRecords: [] });
  });

  it('uses one assignment form as the primary surface and shows only the discreet canonical remainder', async () => {
    api.listAssignableInitiatives.mockResolvedValue({
      canonicalInitiatives: [{ id: 'project-1', name: 'Activación guiada', ownerEmail: 'initiative-owner@starteria.test' }],
      importedRecords: [],
      otherImportedRecords: [],
    });

    render(<ChallengeAssignmentPreparationPanel target={target} />);

    expect(await screen.findByRole('heading', { name: 'Asigna responsables para abordar este reto' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Persona responsable')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '+ Asignar responsable' })).toHaveLength(1);
    await userEvent.setup().click(screen.getByRole('button', { name: '+ Asignar responsable' }));
    expect(screen.getByRole('checkbox', { name: 'Asignarle una iniciativa existente' })).toBeEnabled();
    expect(screen.getByText('Quedan 1 iniciativas disponibles para asignar. Puedes dejarlas para después')).toBeInTheDocument();
    expect(screen.queryByText(/iniciativa asignable sin encargo/i)).not.toBeInTheDocument();
  });

  it('explains no eligible canonical initiative and keeps the challenge mode usable', async () => {
    const user = userEvent.setup();
    api.listAssignableInitiatives.mockResolvedValue({ canonicalInitiatives: [], importedRecords: [], otherImportedRecords: [] });

    render(<ChallengeAssignmentPreparationPanel target={target} />);

    await user.click(await screen.findByRole('button', { name: '+ Asignar responsable' }));
    expect(await screen.findByRole('checkbox', { name: 'Asignarle una iniciativa existente' })).toBeDisabled();
    expect(screen.getAllByText('No hay iniciativas disponibles para asignar en este reto.')).not.toHaveLength(0);
    expect(screen.getByRole('checkbox', { name: 'Asignarle una iniciativa existente' })).not.toBeChecked();
    expect(screen.getByLabelText('Persona responsable')).toBeInTheDocument();
  });

  it('decreases the canonical remainder only after saving an existing initiative assignment', async () => {
    const user = userEvent.setup();
    api.listAssignableInitiatives.mockResolvedValue({
      canonicalInitiatives: [
        { id: 'project-1', name: 'Activación guiada', ownerEmail: 'initiative-owner@starteria.test' },
        { id: 'project-2', name: 'Recuperación temprana', ownerEmail: 'second-owner@starteria.test' },
      ],
      importedRecords: [],
      otherImportedRecords: [],
    });
    api.createChallengeHandoffAssignment
      .mockResolvedValueOnce({ assignment: { id: 'assignment-challenge', state: 'CREATED', version: 1, targetKind: 'CHALLENGE', initiativeId: null, contextNote: '', briefVersionId: 'version-5', invitedEmailNormalized: 'challenge@starteria.test', members: [] }, idempotent: false })
      .mockResolvedValueOnce({ assignment: { id: 'assignment-existing', state: 'CREATED', version: 1, targetKind: 'EXISTING_INITIATIVE', initiativeId: 'project-1', initiative: { id: 'project-1', name: 'Activación guiada' }, contextNote: '', briefVersionId: null, invitedEmailNormalized: 'initiative-owner@starteria.test', members: [] }, idempotent: false });

    render(<ChallengeAssignmentPreparationPanel target={target} />);
    expect(await screen.findByText('Quedan 2 iniciativas disponibles para asignar. Puedes dejarlas para después')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '+ Asignar responsable' }));
    await user.type(screen.getByLabelText('Persona responsable'), 'challenge@starteria.test');
    await user.click(screen.getByRole('button', { name: 'Revisar asignación' }));
    await user.click(screen.getByRole('button', { name: 'Guardar asignación' }));
    expect(await screen.findByText('Quedan 2 iniciativas disponibles para asignar. Puedes dejarlas para después')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '+ Asignar responsable' }));
    await user.click(screen.getByRole('checkbox', { name: 'Asignarle una iniciativa existente' }));
    await user.selectOptions(screen.getByLabelText('Iniciativa a continuar'), 'project-1');
    await user.click(screen.getByRole('button', { name: 'Revisar asignación' }));
    await user.click(screen.getByRole('button', { name: 'Guardar asignación' }));
    expect(await screen.findByText('Quedan 1 iniciativas disponibles para asignar. Puedes dejarlas para después')).toBeInTheDocument();
  });

  it('keeps the primary form ready after saving and updates the canonical remainder', async () => {
    const user = userEvent.setup();
    api.listAssignableInitiatives.mockResolvedValue({
      canonicalInitiatives: [{ id: 'project-1', name: 'Activación guiada', description: 'Reducir abandonos durante el alta.', ownerEmail: 'initiative-owner@starteria.test', ownerName: 'Initiative Owner' }],
      importedRecords: [],
      otherImportedRecords: [],
    });
    api.createChallengeHandoffAssignment.mockResolvedValue({ assignment: {
      id: 'assignment-project-1', state: 'CREATED', version: 1, targetKind: 'EXISTING_INITIATIVE', initiativeId: 'project-1',
      briefVersionId: null, contextNote: '', invitedEmailNormalized: 'initiative-owner@starteria.test', initiative: { id: 'project-1', name: 'Activación guiada' },
      members: [{ identityKey: 'initiative-owner@starteria.test', emailNormalized: 'initiative-owner@starteria.test', role: 'OWNER' }],
    }, idempotent: false });

    render(<ChallengeAssignmentPreparationPanel target={target} />);

    expect(await screen.findByRole('heading', { name: 'Asigna responsables para abordar este reto' })).toBeInTheDocument();
    expect(screen.getByText('Quedan 1 iniciativas disponibles para asignar. Puedes dejarlas para después')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Asignar responsable a Activación guiada/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '+ Asignar responsable' }));
    await user.click(screen.getByRole('checkbox', { name: 'Asignarle una iniciativa existente' }));
    await user.selectOptions(screen.getByLabelText('Iniciativa a continuar'), 'project-1');
    expect(screen.getByLabelText('Iniciativa a continuar')).toHaveValue('project-1');
    expect(screen.getByLabelText('Persona responsable')).toHaveValue('initiative-owner@starteria.test');
    await user.click(screen.getByRole('button', { name: 'Revisar asignación' }));
    await user.click(screen.getByRole('button', { name: 'Guardar asignación' }));
    await waitFor(() => expect(screen.getByText('Quedan 0 iniciativas disponibles para asignar. Puedes dejarlas para después')).toBeInTheDocument());
    expect(screen.queryByRole('heading', { name: 'Define este encargo' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Asignar responsable' })).toBeInTheDocument();
  });

  it('does not treat documentary imports as eligible existing initiatives', async () => {
    api.listAssignableInitiatives.mockResolvedValue({
      canonicalInitiatives: [],
      importedRecords: [
        {
          id: 'work-1',
          label: 'Onboarding guiado',
          purpose: 'Reducir abandono en los primeros siete días.',
          currentState: 'En validación con clientes.',
          sourceLabel: 'Documento de iniciativas Q3.xlsx',
          sourceRefs: [{ sheet: 'Iniciativas', row: 7 }],
          sourceVersion: '2026-10-23T08:00:00.000Z',
          reason: 'IMPORTED_RECORD_NOT_CANONICAL',
        },
        ...[2, 3, 4, 5].map((index) => ({ id: `work-${index}`, label: `Registro relacionado ${index}`, reason: 'IMPORTED_RECORD_NOT_CANONICAL' as const })),
      ],
      otherImportedRecords: [
        { id: 'work-6', label: 'Programa transversal', category: 'cross_cutting', reason: 'NOT_RELATED_TO_CHALLENGE' },
        { id: 'work-7', label: 'Mejora fuera de objetivo', category: 'outside_objective', reason: 'NOT_RELATED_TO_CHALLENGE' },
        { id: 'work-8', label: 'Pendiente de clasificar', category: 'ungrouped', reason: 'NOT_RELATED_TO_CHALLENGE' },
      ],
    });
    render(<ChallengeAssignmentPreparationPanel target={target} />);

    await userEvent.setup().click(await screen.findByRole('button', { name: '+ Asignar responsable' }));
    expect(await screen.findByRole('checkbox', { name: 'Asignarle una iniciativa existente' })).toBeDisabled();
    expect(screen.getAllByText('No hay iniciativas disponibles para asignar en este reto.')).not.toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Revisar iniciativa documental Onboarding guiado' })).not.toBeInTheDocument();
    expect(api.createChallengeHandoffAssignment).not.toHaveBeenCalled();
    expect(api.registerImportedInitiative).not.toHaveBeenCalled();
  });

  it('recovers the exact Brief and does not create on entry or review', async () => {
    const user = userEvent.setup();
    render(<ChallengeAssignmentPreparationPanel target={target} />);
    expect(await screen.findByRole('heading', { name: 'Asigna responsables para abordar este reto' })).toBeInTheDocument();
    expect(screen.getByText(/No necesitas asignarlas todas ahora/i)).toBeInTheDocument();
    expect(screen.getByText('Versión 5 · Confirmada e inmutable')).toBeInTheDocument();
    expect(screen.queryByText(confirmedVersion.intent)).not.toBeInTheDocument();
    const disclosure = screen.getByRole('button', { name: 'Ver contenido del Brief' });
    expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    disclosure.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'Ocultar contenido del Brief' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(confirmedVersion.intent)).toBeInTheDocument();
    expect(screen.getByText('Importación Q3')).toBeInTheDocument();
    expect(screen.queryByText('Información sobre iniciativas documentales')).not.toBeInTheDocument();
    expect(api.createChallengeHandoffAssignment).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '+ Asignar responsable' }));
    expect(screen.getByRole('heading', { name: 'Define este encargo' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Persona responsable'), 'owner@starteria.test');
    await user.click(screen.getByRole('button', { name: 'Revisar asignación' }));
    expect(screen.getByRole('heading', { name: 'Revisa este encargo' })).toBeInTheDocument();
    expect(api.createChallengeHandoffAssignment).not.toHaveBeenCalled();
  });

  it('counts only canonical Projects without active initiative assignments and ignores CHALLENGE assignments', async () => {
    const user = userEvent.setup();
    api.listAssignableInitiatives.mockResolvedValue({
      canonicalInitiatives: [
        { id: 'project-1', name: 'Activación guiada', ownerEmail: 'one@starteria.test', ownerName: 'One' },
        { id: 'project-2', name: 'Recuperación temprana', ownerEmail: 'two@starteria.test', ownerName: 'Two' },
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

    expect(await screen.findByText('Quedan 1 iniciativas disponibles para asignar. Puedes dejarlas para después')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Resumen de cobertura' })).not.toBeInTheDocument();
    expect(screen.queryByText('Activación guiada')).not.toBeInTheDocument();
    expect(screen.queryByText('Recuperación temprana')).not.toBeInTheDocument();
    expect(screen.queryByText('Onboarding guiado')).not.toBeInTheDocument();
    expect(screen.queryByText('Seguimiento manual')).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/%|pendientes obligatorias|todas asignadas/i);
  });

  it('keeps a rejected initiative unavailable until Portfolio records its response', async () => {
    const user = userEvent.setup();
    api.listAssignableInitiatives.mockResolvedValue({
      canonicalInitiatives: [
        { id: 'project-blocked', name: 'Rechazo pendiente', ownerEmail: null },
        { id: 'project-released', name: 'Rechazo respondido', ownerEmail: null },
        { id: 'project-revoked', name: 'Encargo revocado', ownerEmail: null },
      ],
      importedRecords: [], otherImportedRecords: [],
    });
    api.listChallengeHandoffAssignments.mockResolvedValue([
      { id: 'rejected-pending', state: 'REJECTED', portfolioResponse: null, version: 3, targetKind: 'EXISTING_INITIATIVE', initiativeId: 'project-blocked', contextNote: null, briefVersionId: null, invitedEmailNormalized: 'one@starteria.test', members: [] },
      { id: 'rejected-answered', state: 'REJECTED', portfolioResponse: 'Prepararemos otro encargo.', version: 4, targetKind: 'EXISTING_INITIATIVE', initiativeId: 'project-released', contextNote: null, briefVersionId: null, invitedEmailNormalized: 'two@starteria.test', members: [] },
      { id: 'revoked', state: 'REVOKED', version: 2, targetKind: 'EXISTING_INITIATIVE', initiativeId: 'project-revoked', contextNote: null, briefVersionId: null, invitedEmailNormalized: 'three@starteria.test', members: [] },
    ]);

    render(<ChallengeAssignmentPreparationPanel target={target} />);

    expect(await screen.findByText('Quedan 2 iniciativas disponibles para asignar. Puedes dejarlas para después')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '+ Asignar responsable' }));
    await user.click(screen.getByRole('checkbox', { name: 'Asignarle una iniciativa existente' }));
    expect(screen.queryByRole('option', { name: 'Rechazo pendiente' })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Rechazo respondido' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Encargo revocado' })).toBeInTheDocument();
  });

  it('prepares more than one independent CHALLENGE assignment by explicit confirmation', async () => {
    const user = userEvent.setup();
    api.createChallengeHandoffAssignment
      .mockResolvedValueOnce({ assignment: { id: 'assignment-1', state: 'CREATED', version: 1, targetKind: 'CHALLENGE', initiativeId: null, contextNote: 'Validar onboarding.', briefVersionId: 'version-5', invitedEmailNormalized: 'owner@starteria.test', members: [{ identityKey: 'owner@starteria.test', emailNormalized: 'owner@starteria.test', role: 'OWNER' }] }, idempotent: false })
      .mockResolvedValueOnce({ assignment: { id: 'assignment-2', state: 'CREATED', version: 1, targetKind: 'CHALLENGE', initiativeId: null, contextNote: '', briefVersionId: 'version-5', invitedEmailNormalized: 'second@starteria.test', members: [{ identityKey: 'second@starteria.test', emailNormalized: 'second@starteria.test', role: 'OWNER' }] }, idempotent: false });
    render(<ChallengeAssignmentPreparationPanel target={target} />);
    await user.click(await screen.findByRole('button', { name: '+ Asignar responsable' }));
    await screen.findByRole('heading', { name: 'Define este encargo' });
    await user.type(screen.getByLabelText('Persona responsable'), 'OWNER@Starteria.test');
    await user.type(screen.getByLabelText('Contexto específico del encargo'), 'Validar onboarding.');
    await user.click(screen.getByRole('button', { name: 'Revisar asignación' }));
    await user.click(screen.getByRole('button', { name: 'Guardar asignación' }));
    await waitFor(() => expect(api.createChallengeHandoffAssignment).toHaveBeenCalledWith('challenge-1', {
      targetKind: 'CHALLENGE', initiativeId: null, briefId: 'brief-a', briefVersionId: 'version-5', contextNote: 'Validar onboarding.', invitedEmailNormalized: 'owner@starteria.test',
      members: [{ identityKey: 'owner@starteria.test', emailNormalized: 'owner@starteria.test', role: 'OWNER' }],
    }, expect.any(String)));
    expect(screen.getByRole('heading', { name: 'Asignaciones preparadas' })).toBeInTheDocument();
    expect(screen.getByText('Pendiente de envío')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '+ Asignar responsable' }));
    await user.type(screen.getByLabelText('Persona responsable'), 'second@starteria.test');
    await user.click(screen.getByRole('button', { name: 'Revisar asignación' }));
    await user.click(screen.getByRole('button', { name: 'Guardar asignación' }));
    await waitFor(() => expect(api.createChallengeHandoffAssignment).toHaveBeenCalledTimes(2));
    expect(screen.getByText('owner@starteria.test')).toBeInTheDocument();
    expect(screen.getByText('second@starteria.test')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /confirmar envío/i })).not.toBeInTheDocument();
  });

  it('selects only chosen assignments, reviews exact context and confirms a separate batch send', async () => {
    const user = userEvent.setup();
    const onCompleteSetup = vi.fn().mockResolvedValue(undefined);
    api.listChallengeHandoffAssignments.mockResolvedValue([
      {
        id: 'assignment-1', state: 'CREATED', version: 1, targetKind: 'CHALLENGE', initiativeId: null,
        contextNote: 'Contrastar primero el abandono inicial.', briefVersionId: 'version-5', briefVersion: confirmedVersion,
        invitedEmailNormalized: 'owner@starteria.test', members: [
          { identityKey: 'owner@starteria.test', emailNormalized: 'owner@starteria.test', role: 'OWNER' },
          { identityKey: 'collab@starteria.test', emailNormalized: 'collab@starteria.test', role: 'EXECUTOR' },
        ],
      },
      {
        id: 'assignment-2', state: 'CREATED', version: 1, targetKind: 'EXISTING_INITIATIVE', initiativeId: 'project-1',
        initiative: { id: 'project-1', name: 'Activación guiada' }, contextNote: 'Mantener el trabajo existente.', briefVersionId: null,
        invitedEmailNormalized: 'second@starteria.test', members: [{ identityKey: 'second@starteria.test', emailNormalized: 'second@starteria.test', role: 'OWNER' }],
      },
    ]);
    api.sendHandoffInvitationBatch.mockResolvedValue({
      id: 'batch-1', status: 'COMPLETED', idempotent: false,
      results: [{ assignmentId: 'assignment-1', status: 'SUCCEEDED', providerMessageRef: 'smtp-1', errorCategory: null }],
      counts: { sent: 1, failed: 0, skipped: 0 },
    });

    render(<ChallengeAssignmentPreparationPanel target={target} onCompleteSetup={onCompleteSetup} />);

    await user.click(await screen.findByRole('checkbox', { name: 'Seleccionar invitación para owner@starteria.test' }));
    expect(screen.getByRole('checkbox', { name: 'Seleccionar invitación para second@starteria.test' })).not.toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Revisar y enviar seleccionados (1)' }));
    expect(screen.getByRole('heading', { name: 'Revisa antes de enviar' })).toBeInTheDocument();
    expect(screen.getByText('Reducir fricción')).toBeInTheDocument();
    expect(screen.getByText('Versión 5 · Confirmada')).toBeInTheDocument();
    expect(screen.getByText('collab@starteria.test')).toBeInTheDocument();
    expect(screen.getByText('Contrastar primero el abandono inicial.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirmar envío de 1 invitación' }));

    await waitFor(() => expect(api.sendHandoffInvitationBatch).toHaveBeenCalledWith('challenge-1', [
      { assignmentId: 'assignment-1', expectedVersion: 1 },
    ], expect.any(String)));
    expect(screen.getByText('1 envío procesado')).toBeInTheDocument();
    expect(api.sendHandoffInvitationBatch).toHaveBeenCalledTimes(1);
    expect(onCompleteSetup).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Finalizar configuración y ver mi portafolio' }));
    expect(screen.getByText(/Lo pendiente quedará guardado/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Finalizar configuración y ver mi portafolio' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sí, finalizar' })).toHaveFocus();
    expect(onCompleteSetup).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Seguir aquí' }));
    expect(screen.queryByRole('button', { name: 'Sí, finalizar' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finalizar configuración y ver mi portafolio' })).toHaveFocus();
    expect(onCompleteSetup).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Finalizar configuración y ver mi portafolio' }));
    await user.click(screen.getByRole('button', { name: 'Sí, finalizar' }));
    await waitFor(() => expect(onCompleteSetup).toHaveBeenCalledTimes(1));
  });

  it('shows partial outcomes, leaves unselected assignments unsent and retries only failures', async () => {
    const user = userEvent.setup();
    api.listChallengeHandoffAssignments.mockResolvedValue([
      { id: 'assignment-sent', state: 'CREATED', version: 1, targetKind: 'CHALLENGE', initiativeId: null, contextNote: 'Primera.', briefVersionId: 'version-5', invitedEmailNormalized: 'sent@starteria.test', members: [] },
      { id: 'assignment-failed', state: 'CREATED', version: 1, targetKind: 'CHALLENGE', initiativeId: null, contextNote: 'Segunda.', briefVersionId: 'version-5', invitedEmailNormalized: 'failed@starteria.test', members: [] },
      { id: 'assignment-unselected', state: 'CREATED', version: 1, targetKind: 'CHALLENGE', initiativeId: null, contextNote: 'Tercera.', briefVersionId: 'version-5', invitedEmailNormalized: 'unselected@starteria.test', members: [] },
    ]);
    api.sendHandoffInvitationBatch
      .mockResolvedValueOnce({
        id: 'batch-partial', status: 'PARTIAL', idempotent: false, succeededCount: 1, failedCount: 1,
        results: [
          { assignmentId: 'assignment-sent', status: 'SUCCEEDED', state: 'SENT', providerMessageRef: 'smtp-1', errorCategory: null },
          { assignmentId: 'assignment-failed', status: 'FAILED', state: 'CREATED', providerMessageRef: null, errorCategory: 'SMTP_TEMPORARY' },
        ],
      })
      .mockResolvedValueOnce({
        id: 'batch-retry', retryOfBatchId: 'batch-partial', status: 'COMPLETED', idempotent: false, succeededCount: 1, failedCount: 0,
        results: [{ assignmentId: 'assignment-failed', status: 'SUCCEEDED', state: 'SENT', providerMessageRef: 'smtp-2', errorCategory: null }],
      });

    render(<ChallengeAssignmentPreparationPanel target={target} />);
    await user.click(await screen.findByRole('checkbox', { name: 'Seleccionar invitación para sent@starteria.test' }));
    await user.click(screen.getByRole('checkbox', { name: 'Seleccionar invitación para failed@starteria.test' }));
    await user.click(screen.getByRole('button', { name: 'Revisar y enviar seleccionados (2)' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar envío de 2 invitaciones' }));

    expect(await screen.findByText('1 envío procesado')).toBeInTheDocument();
    expect(screen.getByText('1 error al enviar')).toBeInTheDocument();
    expect(screen.getByText('1 sin enviar')).toBeInTheDocument();
    expect(screen.getByText('Motivo técnico: SMTP_TEMPORARY')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reintentar solo fallidas' }));
    await waitFor(() => expect(api.sendHandoffInvitationBatch).toHaveBeenLastCalledWith('challenge-1', [
      { assignmentId: 'assignment-failed', expectedVersion: 1 },
    ], expect.any(String), 'batch-partial'));
  });

  it('requires reconciliation and never offers automatic retry for an unknown SMTP outcome', async () => {
    const user = userEvent.setup();
    api.listChallengeHandoffAssignments.mockResolvedValue([
      { id: 'assignment-unknown', state: 'CREATED', version: 1, targetKind: 'CHALLENGE', initiativeId: null, contextNote: 'Ambigua.', briefVersionId: 'version-5', invitedEmailNormalized: 'unknown@starteria.test', members: [] },
    ]);
    api.sendHandoffInvitationBatch.mockResolvedValue({
      id: 'batch-unknown', status: 'RECONCILIATION_REQUIRED', retryOfBatchId: null, succeededCount: 0, failedCount: 0,
      results: [{ assignmentId: 'assignment-unknown', status: 'UNKNOWN', state: 'CREATED', providerMessageRef: null, errorCategory: 'DELIVERY_OUTCOME_UNKNOWN' }],
    });

    render(<ChallengeAssignmentPreparationPanel target={target} />);
    await user.click(await screen.findByRole('checkbox', { name: 'Seleccionar invitación para unknown@starteria.test' }));
    await user.click(screen.getByRole('button', { name: 'Revisar y enviar seleccionados (1)' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar envío de 1 invitación' }));

    expect(await screen.findByText('1 resultado por conciliar')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('No reenviaremos automáticamente');
    expect(screen.queryByRole('button', { name: 'Reintentar solo fallidas' })).not.toBeInTheDocument();
    expect(screen.getByText('Motivo técnico: DELIVERY_OUTCOME_UNKNOWN')).toBeInTheDocument();
  });

  it('re-enters every prepared Assignment for the Challenge by assignmentId without collapsing Brief versions', async () => {
    api.listChallengeHandoffAssignments.mockResolvedValue([
      { id: 'assignment-existing', state: 'CREATED', version: 1, targetKind: 'CHALLENGE', initiativeId: null, contextNote: 'Validar onboarding.', briefVersionId: 'version-5', invitedEmailNormalized: 'owner@starteria.test', members: [{ identityKey: 'owner@starteria.test', emailNormalized: 'owner@starteria.test', role: 'OWNER' }] },
      { id: 'assignment-existing', state: 'CREATED', version: 1, targetKind: 'CHALLENGE', initiativeId: null, contextNote: 'Validar onboarding.', briefVersionId: 'version-5', invitedEmailNormalized: 'owner@starteria.test', members: [{ identityKey: 'owner@starteria.test', emailNormalized: 'owner@starteria.test', role: 'OWNER' }] },
      { id: 'assignment-second', state: 'CREATED', version: 1, targetKind: 'CHALLENGE', initiativeId: null, contextNote: 'Contrastar activación.', briefVersionId: 'version-5', invitedEmailNormalized: 'second@starteria.test', members: [{ identityKey: 'second@starteria.test', emailNormalized: 'second@starteria.test', role: 'OWNER' }] },
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
    api.listAssignableInitiatives.mockResolvedValue({ canonicalInitiatives: [{ id: 'project-1', name: 'Activación guiada', ownerEmail: 'initiative-owner@starteria.test' }], importedRecords: [] });
    const user = userEvent.setup();
    render(<ChallengeAssignmentPreparationPanel target={target} />);
    await user.click(await screen.findByRole('button', { name: '+ Asignar responsable' }));
    await screen.findByRole('heading', { name: 'Define este encargo' });
    await user.click(screen.getByRole('checkbox', { name: 'Asignarle una iniciativa existente' }));
    await user.selectOptions(screen.getByLabelText('Iniciativa a continuar'), 'project-1');
    expect(screen.getByText(/Iniciativa válida y vinculada a este reto/i)).toBeInTheDocument();
  });

  it('edits a CREATED assignment with optimistic versioning', async () => {
    api.listChallengeHandoffAssignments.mockResolvedValue([{ id: 'assignment-existing', state: 'CREATED', version: 3, targetKind: 'CHALLENGE', initiativeId: null, contextNote: 'Contexto inicial.', briefVersionId: 'version-5', invitedEmailNormalized: 'owner@starteria.test', members: [{ identityKey: 'owner@starteria.test', emailNormalized: 'owner@starteria.test', role: 'OWNER' }] }]);
    api.updateChallengeHandoffAssignment.mockResolvedValue({ assignment: { id: 'assignment-existing', state: 'CREATED', version: 4, targetKind: 'CHALLENGE', initiativeId: null, contextNote: 'Contexto ajustado.', briefVersionId: 'version-5', invitedEmailNormalized: 'owner@starteria.test', members: [{ identityKey: 'owner@starteria.test', emailNormalized: 'owner@starteria.test', role: 'OWNER' }] }, idempotent: false });
    const user = userEvent.setup();
    render(<ChallengeAssignmentPreparationPanel target={target} />);
    await user.click(await screen.findByRole('button', { name: 'Editar asignación para owner@starteria.test' }));
    await user.clear(screen.getByLabelText('Contexto específico del encargo'));
    await user.type(screen.getByLabelText('Contexto específico del encargo'), 'Contexto ajustado.');
    await user.click(screen.getByRole('button', { name: 'Revisar asignación' }));
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(api.updateChallengeHandoffAssignment).toHaveBeenCalledWith('assignment-existing', expect.objectContaining({ expectedVersion: 3, contextNote: 'Contexto ajustado.' }), expect.any(String)));
  });

  it('keeps the current draft and explains how to finish it before editing another CREATED assignment', async () => {
    api.listChallengeHandoffAssignments.mockResolvedValue([
      { id: 'assignment-one', state: 'CREATED', version: 2, targetKind: 'CHALLENGE', initiativeId: null, contextNote: 'Primero.', briefVersionId: 'version-5', invitedEmailNormalized: 'one@starteria.test', members: [{ identityKey: 'one@starteria.test', emailNormalized: 'one@starteria.test', role: 'OWNER' }] },
      { id: 'assignment-two', state: 'CREATED', version: 4, targetKind: 'CHALLENGE', initiativeId: null, contextNote: 'Segundo.', briefVersionId: 'version-5', invitedEmailNormalized: 'two@starteria.test', members: [{ identityKey: 'two@starteria.test', emailNormalized: 'two@starteria.test', role: 'OWNER' }] },
    ]);
    const user = userEvent.setup();
    render(<ChallengeAssignmentPreparationPanel target={target} />);

    await user.click(await screen.findByRole('button', { name: '+ Asignar responsable' }));
    await screen.findByRole('heading', { name: 'Define este encargo' });
    await user.type(screen.getByLabelText('Persona responsable'), 'draft@starteria.test');
    await user.click(screen.getByRole('button', { name: 'Editar asignación para two@starteria.test' }));

    expect(screen.getByRole('alert')).toHaveTextContent(/termina o cancela el encargo abierto antes de editar otro/i);
    expect(screen.getByLabelText('Persona responsable')).toHaveValue('draft@starteria.test');
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
  });

  it('explains persisted invitation states and never offers Edit outside CREATED', async () => {
    api.listChallengeHandoffAssignments.mockResolvedValue([
      { id: 'prepared', state: 'CREATED', version: 1, targetKind: 'CHALLENGE', initiativeId: null, contextNote: null, briefVersionId: 'version-5', invitedEmailNormalized: 'prepared@starteria.test', members: [] },
      { id: 'sent', state: 'SENT', version: 2, targetKind: 'CHALLENGE', initiativeId: null, contextNote: null, briefVersionId: 'version-5', invitedEmailNormalized: 'sent@starteria.test', sentAt: '2026-10-23T10:00:00.000Z', members: [] },
      { id: 'viewed', state: 'VIEWED', version: 3, targetKind: 'CHALLENGE', initiativeId: null, contextNote: null, briefVersionId: 'version-5', invitedEmailNormalized: 'viewed@starteria.test', viewedAt: '2026-10-23T11:00:00.000Z', members: [] },
      { id: 'accepted', state: 'ACCEPTED', version: 4, targetKind: 'CHALLENGE', initiativeId: null, contextNote: null, briefVersionId: 'version-5', invitedEmailNormalized: 'accepted@starteria.test', acceptedAt: '2026-10-23T12:00:00.000Z', members: [] },
      { id: 'rejected', state: 'REJECTED', version: 4, targetKind: 'CHALLENGE', initiativeId: null, contextNote: null, briefVersionId: 'version-5', invitedEmailNormalized: 'rejected@starteria.test', rejectedAt: '2026-10-23T13:00:00.000Z', members: [] },
      { id: 'failed', state: 'CREATED', version: 1, targetKind: 'CHALLENGE', initiativeId: null, contextNote: null, briefVersionId: 'version-5', invitedEmailNormalized: 'failed@starteria.test', deliveryAttempts: [{ status: 'FAILED', errorCategory: 'SMTP_TEMPORARY', attemptedAt: '2026-10-23T14:00:00.000Z' }], members: [] },
    ]);
    render(<ChallengeAssignmentPreparationPanel target={target} />);

    expect(await screen.findByText('Pendiente de envío')).toBeInTheDocument();
    expect(screen.getByText('Envío procesado')).toBeInTheDocument();
    expect(screen.getByText('Enlace abierto')).toBeInTheDocument();
    expect(screen.getByText('Aceptada')).toBeInTheDocument();
    expect(screen.getByText('Rechazada')).toBeInTheDocument();
    expect(screen.getByText('Error al enviar')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Qué significa cada estado' })).toHaveTextContent(/enlace abierto: se abrió el enlace seguro; no equivale a aceptación/i);
    expect(screen.getByRole('region', { name: 'Qué significa cada estado' })).toHaveTextContent(/envío procesado: el servidor aceptó el mensaje; no acredita entrega externa ni apertura/i);
    expect(screen.queryByRole('button', { name: 'Editar asignación para sent@starteria.test' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar asignación para viewed@starteria.test' })).not.toBeInTheDocument();
  });

  it('saves and returns to Portfolio without invoking Send', async () => {
    const onExitToPortfolio = vi.fn();
    api.createChallengeHandoffAssignment.mockResolvedValue({ assignment: {
      id: 'assignment-saved', state: 'CREATED', version: 1, targetKind: 'CHALLENGE', initiativeId: null,
      briefVersionId: 'version-5', contextNote: 'Guardar sin enviar.', invitedEmailNormalized: 'owner@starteria.test',
      members: [{ identityKey: 'owner@starteria.test', emailNormalized: 'owner@starteria.test', role: 'OWNER' }],
    }, idempotent: false });
    const user = userEvent.setup();
    render(<ChallengeAssignmentPreparationPanel target={target} onExitToPortfolio={onExitToPortfolio} />);

    await user.click(await screen.findByRole('button', { name: '+ Asignar responsable' }));
    await screen.findByRole('heading', { name: 'Define este encargo' });
    await user.type(screen.getByLabelText('Persona responsable'), 'owner@starteria.test');
    await user.type(screen.getByLabelText('Contexto específico del encargo'), 'Guardar sin enviar.');
    await user.click(screen.getByRole('button', { name: 'Guardar y salir' }));
    expect(screen.getByRole('heading', { name: 'Tienes un encargo sin guardar' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Guardar este encargo y volver' }));

    await waitFor(() => expect(onExitToPortfolio).toHaveBeenCalledTimes(1));
    expect(api.createChallengeHandoffAssignment).toHaveBeenCalledTimes(1);
    expect(api.sendHandoffInvitationBatch).not.toHaveBeenCalled();
  });

  it('rejects duplicated people before persistence', async () => {
    const user = userEvent.setup();
    render(<ChallengeAssignmentPreparationPanel target={target} />);
    await user.click(await screen.findByRole('button', { name: '+ Asignar responsable' }));
    await screen.findByRole('heading', { name: 'Define este encargo' });
    await user.type(screen.getByLabelText('Persona responsable'), 'same@starteria.test');
    await user.type(screen.getByLabelText('Colaborador 1'), 'SAME@starteria.test');
    await user.click(screen.getByRole('button', { name: 'Revisar asignación' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/cada persona debe aparecer una sola vez/i);
    expect(api.createChallengeHandoffAssignment).not.toHaveBeenCalled();
  });
});
