import { describe, expect, it } from 'vitest';
import { getInitiativeAttentionModel } from '../PortfolioLeadInitiativesPage';

// Como el recorrido E2E en producción (2026-10-08): Step 4 presentado, sponsor del reto sin
// confirmar y sin touchpoint.
const initiative = (extra: Record<string, unknown> = {}) => ({
  currentStep: 'Step 4',
  status: 'lista_para_decision',
  readyForDecision: true,
  sponsorTouchpoint: '',
  teamOwner: 'E2E Participante',
  deliverables: [{ id: 'd1' }],
  partialSignal: false,
  signalSummary: 'Continuar con cierre organizacional trazable.',
  mainBlocker: '',
  mainAlert: '',
  blockedDays: 0,
  ...extra,
}) as any;
const challenge = { sponsorStatus: 'definido', challengeOwnerStatus: 'definido' } as any;

describe('Atención de la iniciativa en el listado del Portfolio Lead', () => {
  it('lista para decisión cuenta como tal aunque el sponsor del reto no haya confirmado', () => {
    // La decisión la toma el lead: no es un "Sponsor sin respuesta" que pida seguimiento.
    expect(getInitiativeAttentionModel(initiative(), challenge).filter).toBe('decision_ready');
  });

  it('un bloqueo activo sigue primero', () => {
    expect(getInitiativeAttentionModel(initiative({ status: 'bloqueada' }), challenge).filter).toBe('blocked');
  });

  it('sin estar lista, el sponsor sin confirmar sigue pidiendo seguimiento', () => {
    const enCurso = initiative({ currentStep: 'Step 2', status: 'en_step_2', readyForDecision: false });
    expect(getInitiativeAttentionModel(enCurso, challenge).filter).toBe('no_response');
  });
});
