import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  listActivationBriefs: vi.fn(),
  getActivationBrief: vi.fn(),
  createActivationBrief: vi.fn(),
  createActivationBriefVersion: vi.fn(),
  confirmActivationBriefVersion: vi.fn(),
}));

vi.mock('../challengeActivationBriefClient', () => api);

import { ChallengeActivationBriefPanel } from '../ChallengeActivationBriefPanel';

const inherited = {
  objective: 'Reducir el abandono durante la activacion.',
  frontName: 'Adopcion inicial sostenible',
  frontFocus: 'Mover la activacion temprana.',
  challengeProblem: 'No sabemos donde se interrumpe la activacion.',
  businessSignal: 'Tasa de activacion a 14 dias',
  decisionToEnable: 'Decidir que barrera abordar primero.',
  relatedInitiatives: ['Onboarding guiado', 'Diagnostico de abandono'],
  knownFacts: ['Dos iniciativas persiguen la misma senal.'],
  unknowns: ['Falta una linea base comparable.'],
  constraints: ['Mantener revision legal.'],
  sourceRefs: ['Importacion iniciativas Q3'],
  horizon: null,
};

const draft = {
  id: 'version-1', versionNumber: 1, status: 'DRAFT' as const,
  intent: 'Entender y reducir la principal barrera de activacion.',
  scope: 'Onboarding guiado y diagnostico de abandono.',
  strategicContextRefs: { objective: inherited.objective, frontName: inherited.frontName },
  inheritedContext: {
    objective: inherited.objective, challengeProblem: inherited.challengeProblem,
    knownFacts: inherited.knownFacts, expectedDeliverable: 'Recomendacion priorizada con evidencia.',
    decisionToEnable: inherited.decisionToEnable, horizon: null,
  },
  constraintsSnapshot: inherited.constraints, knownGaps: inherited.unknowns,
  sourceRefs: inherited.sourceRefs,
  provenance: { source: 'PL05_COPILOT', fieldOrigins: { intent: 'AI_PROPOSAL' } },
  createdAt: '2026-10-20T00:00:00Z', confirmedAt: null,
};
const confirmed = { ...draft, status: 'CONFIRMED' as const, confirmedAt: '2026-10-20T01:00:00Z' };

function renderPanel(onConfirmationChange = vi.fn(), briefId?: string | null) {
  return render(<ChallengeActivationBriefPanel challengeId="challenge-1" challengeName="Reducir barreras de activacion" briefId={briefId} inherited={inherited} onConfirmationChange={onConfirmationChange} />);
}

describe('ChallengeActivationBriefPanel - PL-05', () => {
  beforeEach(() => { vi.clearAllMocks(); api.listActivationBriefs.mockResolvedValue([]); });

  it('explains the purpose, boundary and unsaved state before presenting the editable assignment', async () => {
    const user = userEvent.setup();
    renderPanel();
    expect(await screen.findByRole('heading', { name: 'Prepara el Brief que recibirá tu equipo' })).toBeInTheDocument();
    expect(screen.getByText(/Antes de invitar o asignar a las personas/i)).toBeInTheDocument();
    expect(screen.getByText('Confirmar este Brief todavía no asigna personas ni inicia trabajo.')).toBeInTheDocument();
    expect(screen.getByText('Propuesta sin guardar')).toBeInTheDocument();
    expect(screen.getByText(/aún no existe un Brief guardado/i)).toBeInTheDocument();

    const recoveredContext = screen.getByText('Lo que Startería ya recuperó').closest('details');
    expect(recoveredContext).not.toHaveAttribute('open');
    await user.click(screen.getByText('Lo que Startería ya recuperó'));
    expect(recoveredContext).toHaveAttribute('open');
    expect(screen.getByText(inherited.objective)).toBeInTheDocument();
    expect(screen.getByText(inherited.knownFacts[0])).toBeInTheDocument();
    expect(screen.getByText(inherited.sourceRefs[0])).toBeInTheDocument();
    expect(screen.getAllByText(inherited.unknowns[0]).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Startería sugiere/i).length).toBeGreaterThan(0);
    expect((screen.getByLabelText('Qué buscamos conseguir') as HTMLTextAreaElement).value).not.toMatch(/^Abordar Abordar/i);
    expect(screen.getByText('El resultado que esperamos que este encargo ayude a conseguir.')).toBeInTheDocument();
    expect(screen.getByText('Qué información, propuesta o evidencia deberá devolver el equipo.')).toBeInTheDocument();
    expect(screen.getByText(/si conviene probar, ajustar el enfoque o continuar investigando/i)).toBeInTheDocument();
    expect(screen.queryByText(/Assignment|Invitation|Enviar invitacion/i)).not.toBeInTheDocument();
  });

  it('saves a contextual draft and confirms the exact immutable identity', async () => {
    const user = userEvent.setup(); const onConfirmationChange = vi.fn();
    api.createActivationBrief.mockResolvedValue({ brief: { id: 'brief-1', challengeId: 'challenge-1', organizationId: 'org-1', versions: [draft] }, idempotent: false });
    api.confirmActivationBriefVersion.mockResolvedValue({ version: confirmed, idempotent: false });
    renderPanel(onConfirmationChange);
    await user.click(await screen.findByRole('button', { name: 'Guardar borrador' }));
    await waitFor(() => expect(api.createActivationBrief).toHaveBeenCalledOnce());
    expect(api.createActivationBrief.mock.calls[0][1]).toMatchObject({
      strategicContextRefs: expect.objectContaining({ frontName: inherited.frontName }),
      inheritedContext: expect.objectContaining({ challengeProblem: inherited.challengeProblem, expectedDeliverable: expect.any(String), decisionToEnable: inherited.decisionToEnable }),
      constraintsSnapshot: inherited.constraints, knownGaps: inherited.unknowns, sourceRefs: inherited.sourceRefs,
    });
    expect(screen.getByText(/Borrador guardado.*Versión 1/)).toBeInTheDocument();
    expect(api.confirmActivationBriefVersion).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Confirmar esta versión' }));
    await waitFor(() => expect(api.confirmActivationBriefVersion).toHaveBeenCalledWith('version-1', expect.any(String)));
    expect(onConfirmationChange).toHaveBeenLastCalledWith(true);
    expect(screen.queryByText(/PL-06 habilitado/i)).not.toBeInTheDocument();
    expect(screen.getByText('Brief confirmado')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Versión confirmada e inmutable' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Revisar en nueva versión' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Continuar a asignación' })).not.toBeInTheDocument();
  });

  it('does not expose assignment from an unconfirmed selected Draft even when the Brief has older confirmed history', async () => {
    api.getActivationBrief.mockResolvedValue({ id: 'brief-1', challengeId: 'challenge-1', organizationId: 'org-1', versions: [confirmed, { ...draft, id: 'version-2', versionNumber: 2 }] });
    renderPanel(vi.fn(), 'brief-1');
    expect(await screen.findByText(/Borrador guardado.*Versión 2/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Continuar a asignación' })).not.toBeInTheDocument();
  });

  it('recovers history and turns edits to a confirmed version into a new Draft Version', async () => {
    const user = userEvent.setup();
    api.listActivationBriefs.mockResolvedValue([{ id: 'brief-1', challengeId: 'challenge-1', organizationId: 'org-1', versions: [draft, { ...confirmed, id: 'version-2', versionNumber: 2 }] }]);
    api.createActivationBriefVersion.mockResolvedValue({ version: { ...draft, id: 'version-3', versionNumber: 3, intent: 'Resultado revisado' }, idempotent: false });
    renderPanel();
    expect(await screen.findByText(/Versión 2 confirmada/)).toBeInTheDocument();
    expect(screen.getByText('2 versiones conservadas')).toBeInTheDocument();
    expect(screen.queryByLabelText('Qué buscamos conseguir')).not.toBeInTheDocument();
    expect(screen.getByText(draft.intent)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Revisar en nueva versión' }));
    await user.clear(screen.getByLabelText('Qué buscamos conseguir'));
    await user.type(screen.getByLabelText('Qué buscamos conseguir'), 'Resultado revisado');
    await user.click(screen.getByRole('button', { name: 'Guardar nueva versión borrador' }));
    await waitFor(() => expect(api.createActivationBriefVersion).toHaveBeenCalledWith('brief-1', expect.objectContaining({ intent: 'Resultado revisado' }), expect.any(String)));
    expect(screen.getByText(/Borrador guardado.*Versión 3/)).toBeInTheDocument();
  });

  it('recovers exactly the selected Brief instead of borrowing another Brief status', async () => {
    const briefB = { id: 'brief-b', challengeId: 'challenge-1', organizationId: 'org-1', versions: [{ ...draft, id: 'version-b', intent: 'Mandato B en revisión' }] };
    api.getActivationBrief.mockResolvedValue(briefB);

    renderPanel(vi.fn(), 'brief-b');

    expect(await screen.findByText(/Borrador guardado.*Versión 1/)).toBeInTheDocument();
    expect(api.getActivationBrief).toHaveBeenCalledWith('brief-b');
    expect(api.listActivationBriefs).not.toHaveBeenCalled();
    expect(screen.getByTestId('challenge-activation-brief-panel')).toHaveAttribute('data-brief-id', 'brief-b');
  });

  it('reuses the same idempotency key when saving is retried after a transport failure', async () => {
    const user = userEvent.setup();
    api.createActivationBrief.mockRejectedValueOnce(new Error('Conexion interrumpida')).mockResolvedValueOnce({ brief: { id: 'brief-1', challengeId: 'challenge-1', organizationId: 'org-1', versions: [draft] }, idempotent: true });
    renderPanel();
    await user.click(await screen.findByRole('button', { name: 'Guardar borrador' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Conexion interrumpida');
    await user.click(screen.getByRole('button', { name: 'Reintentar guardar borrador' }));
    await waitFor(() => expect(api.createActivationBrief).toHaveBeenCalledTimes(2));
    expect(api.createActivationBrief.mock.calls[0][2]).toBe(api.createActivationBrief.mock.calls[1][2]);
  });
});
