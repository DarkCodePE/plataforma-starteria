/**
 * adapters.test.ts — issue #100.
 *
 * Pins the backend → domain mapping used to hydrate the portfolio-lead provider from
 * real data: real ids/projectId for deep-linking (#94), real squad for create-from-reto
 * (#96), and safe defaults for the rich fields the UI reads.
 */
import { describe, it, expect } from 'vitest';
import {
  adaptStrategicFront,
  adaptChallenge,
  adaptInitiative,
  adaptTeamMembers,
  toBackendStrategicFront,
  toBackendChallenge,
  toBackendInitiativeMeta,
} from '../adapters';

describe('adaptStrategicFront', () => {
  it('maps columns and derives challengeCount from _count', () => {
    const front = adaptStrategicFront({
      id: 'f1',
      name: 'Operaciones',
      sponsor: 'Ana',
      _count: { challenges: 3 },
      createdAt: '2026-06-01T10:00:00.000Z',
    });
    expect(front.id).toBe('f1');
    expect(front.name).toBe('Operaciones');
    expect(front.challengeCount).toBe(3);
    expect(front.createdAt).toBe('2026-06-01');
    expect(front.initiativeCount).toBe(0);
  });
});

describe('adaptChallenge', () => {
  it('maps type→challengeType, squad, and fills activationInputs', () => {
    const challenge = adaptChallenge({
      id: 'c1',
      title: 'Reducir esperas',
      name: 'Reducir esperas',
      strategicFrontId: 'f1',
      type: 'crecimiento',
      assignedSquad: [{ id: 's1', value: 'a@x.com', role: 'lider' }, { id: 's2', value: 'b@x.com' }],
      _count: { initiativeMetas: 2 },
    });
    expect(challenge.id).toBe('c1');
    expect(challenge.challengeType).toBe('crecimiento');
    expect(challenge.strategicFrontId).toBe('f1');
    expect(challenge.initiativeCount).toBe(2);
    expect(challenge.assignedSquad).toEqual([
      { id: 's1', value: 'a@x.com', role: 'lider' },
      { id: 's2', value: 'b@x.com', role: 'colaborador' },
    ]);
    // computed field the UI reads must be present even though the backend omits it
    expect(challenge.activationInputs).toBeTruthy();
  });
});

describe('adaptInitiative', () => {
  it('maps projectId from the joined project and derives currentStep from status', () => {
    const init = adaptInitiative({
      id: 'meta1',
      challengeId: 'c1',
      strategicFrontId: 'f1',
      status: 'en_step_2',
      mainAlert: 'Falta sponsor',
      project: { id: 'proj-123', name: 'Mi iniciativa', currentStep: 2, owner: { name: 'Ana' } },
    });
    expect(init.projectId).toBe('proj-123'); // #94: enables deep-link
    expect(init.name).toBe('Mi iniciativa');
    expect(init.currentStep).toBe('Step 2');
    expect(init.status).toBe('en_step_2');
    expect(init.mainAlert).toBe('Falta sponsor');
    expect(init.teamOwner).toBe('Ana');
    expect(init.deliverables).toEqual([]); // safe default for missing arrays
    expect(init.requiresSponsor).toBe(false);
  });

  it('falls back to Step 0 when status is non-progression and no project step', () => {
    const init = adaptInitiative({ id: 'm', challengeId: 'c', status: 'draft', project: { id: 'p', name: 'X' } });
    expect(init.currentStep).toBe('Step 0');
    expect(init.projectId).toBe('p');
  });
});

describe('toBackendStrategicFront (write path #104)', () => {
  it('coerces status/priority to the backend-accepted enums and drops front-only fields', () => {
    const out = toBackendStrategicFront({
      name: 'F', strategicObjective: 'obj', sponsor: 'Ana',
      status: 'in_definition', priority: 'Critica',
      threshold: 'x', endDate: '2026-01-01', notes: 'n', // front-only → dropped
    });
    expect(out.status).toBe('draft');   // in_definition → draft
    expect(out.priority).toBe('Alta');  // Critica → Alta (backend has no Critica)
    expect(out.name).toBe('F');
    expect(out).not.toHaveProperty('threshold');
    expect(out).not.toHaveProperty('notes');
  });
});

describe('toBackendChallenge (write path #104)', () => {
  it('sets title from name and coerces type/status to legacy enums', () => {
    const out = toBackendChallenge({
      name: 'Reducir esperas',
      challengeType: 'growth',          // canonical → legacy
      status: 'ready_to_activate',      // canonical → legacy
      whatWeWantToMove: 'algo',
      challengeOwnerStatus: 'confirmado',
      activationInputs: { urgency: 'alta' }, // INCOMPLETO (1 de 9 ejes) → se descarta
    });
    expect(out.title).toBe('Reducir esperas'); // backend REQUIRES title
    expect(out.name).toBe('Reducir esperas');
    expect(out.type).toBe('crecimiento');
    expect(out.status).toBe('listo_para_activar');
    expect(out.challengeOwnerStatus).toBe('confirmado');
    // Un objeto parcial NO viaja: la columna Json se reemplaza entera y zod exige los 9 ejes,
    // asi que mandar un trozo dejaria el reto con una activacion a medio describir.
    expect(out).not.toHaveProperty('activationInputs');
  });

  it('omits an activationMode the backend does not support', () => {
    const out = toBackendChallenge({ name: 'X', activationMode: 'equipo_core_encargado' });
    expect(out).not.toHaveProperty('activationMode');
    const ok = toBackendChallenge({ name: 'X', activationMode: 'squad_asignado' });
    expect(ok.activationMode).toBe('squad_asignado');
  });
});

describe('toBackendInitiativeMeta (write path #114 / ADR-024)', () => {
  it('always sets challengeId and keeps editable tracking fields', () => {
    const out = toBackendInitiativeMeta('ch1', {
      mentor: 'Ana',
      mainBlocker: 'Falta dato de costos',
      requiresSponsor: true,
      contributionType: 'validar',
      estimatedContribution: 'alto',
    });
    expect(out.challengeId).toBe('ch1');
    expect(out.mentor).toBe('Ana');
    expect(out.mainBlocker).toBe('Falta dato de costos');
    expect(out.requiresSponsor).toBe(true);
    expect(out.contributionType).toBe('validar');
    expect(out.estimatedContribution).toBe('alto');
  });

  it('drops DERIVED fields owned by the backend sync (status/blockedDays/lastActivity/currentStep)', () => {
    const out = toBackendInitiativeMeta('ch1', {
      mentor: 'Ana',
      status: 'cerrada',
      blockedDays: 9,
      lastActivity: 'hoy',
      currentStep: 'Step 3',
      teamMembers: ['spoof'],
      teamOwner: 'spoof',
      teamLabel: 'spoof',
    } as Record<string, unknown>);
    expect(out).not.toHaveProperty('status');
    expect(out).not.toHaveProperty('blockedDays');
    expect(out).not.toHaveProperty('lastActivity');
    expect(out).not.toHaveProperty('currentStep');
    expect(out).not.toHaveProperty('teamMembers');
    expect(out).not.toHaveProperty('teamOwner');
    expect(out).not.toHaveProperty('teamLabel');
    expect(out.mentor).toBe('Ana');
  });

  it('omits an estimatedContribution / contributionType the backend does not accept', () => {
    const out = toBackendInitiativeMeta('ch1', {
      estimatedContribution: 'gigante' as unknown as never,
      contributionType: 'inventado' as unknown as never,
    });
    expect(out).not.toHaveProperty('estimatedContribution');
    expect(out).not.toHaveProperty('contributionType');
  });
});

// ── MVP-P0-02: la autoria de la activacion deja de ser front-only ────────────────────
// Estos 3 campos se editaban en /portfolio y se perdian al recargar porque no habia columna
// donde guardarlos. Los casos de abajo fijan el round-trip completo en los dos sentidos.

const FULL_ACTIVATION_INPUTS = {
  urgency: 'alta',
  timeAvailable: 'acotado',
  estimatedEffort: 'medio',
  challengeClarity: 'baja',
  informationSensitivity: 'alta',
  internalCapacity: 'media',
  technicalNeed: 'alta',
  sponsorStatus: 'confirmado',
  dependency: 'legal',
} as const;

describe('adaptChallenge — autoria de la activacion (MVP-P0-02)', () => {
  it('LEE los 3 campos persistidos en vez de rellenarlos con defaults', () => {
    const challenge = adaptChallenge({
      id: 'c1',
      title: 'Reducir esperas',
      strategicFrontId: 'f1',
      activationInputs: { ...FULL_ACTIVATION_INPUTS },
      activationRecommendationNote: 'Conviene squad asignado: el reto toca datos sensibles.',
      activationMessageDraft: 'Equipo, abrimos este reto la proxima semana.',
    });
    // Sin esto el usuario veria sus defaults de vuelta tras recargar — el bug que cierra P0-02.
    expect(challenge.activationInputs).toEqual(FULL_ACTIVATION_INPUTS);
    expect(challenge.activationRecommendationNote).toBe('Conviene squad asignado: el reto toca datos sensibles.');
    expect(challenge.activationMessageDraft).toBe('Equipo, abrimos este reto la proxima semana.');
  });

  it('cae a los defaults en una fila que nunca los guardo (columnas null)', () => {
    const challenge = adaptChallenge({
      id: 'c1', title: 'X', strategicFrontId: 'f1', sponsorStatus: 'notificado',
      activationInputs: null,
      activationRecommendationNote: null,
      activationMessageDraft: null,
    });
    // Las columnas son nullable y SIN default (ADR-029): una fila previa al cambio llega en
    // null y la UI debe seguir teniendo 9 selects que pintar.
    expect(challenge.activationInputs.urgency).toBeTruthy();
    expect(challenge.activationInputs.sponsorStatus).toBe('notificado');
    expect(challenge.activationRecommendationNote).toBe('');
    expect(challenge.activationMessageDraft).toBe('');
  });

  it('no adopta basura del Json: un objeto al que le faltan ejes cae al default', () => {
    const challenge = adaptChallenge({
      id: 'c1', title: 'X', strategicFrontId: 'f1',
      activationInputs: { urgency: 'alta' },
    });
    expect(challenge.activationInputs.dependency).toBeTruthy();
  });
});

describe('toBackendChallenge — autoria de la activacion (MVP-P0-02)', () => {
  it('envia los 3 campos cuando activationInputs esta completo', () => {
    const out = toBackendChallenge({
      name: 'X',
      activationInputs: { ...FULL_ACTIVATION_INPUTS },
      activationRecommendationNote: 'nota',
      activationMessageDraft: 'borrador',
    });
    expect(out.activationInputs).toEqual(FULL_ACTIVATION_INPUTS);
    expect(out.activationRecommendationNote).toBe('nota');
    expect(out.activationMessageDraft).toBe('borrador');
  });

  it('envia la cadena vacia: borrar la nota es una edicion, no una omision', () => {
    const out = toBackendChallenge({ name: 'X', activationRecommendationNote: '', activationMessageDraft: '' });
    // Si pasaran por el filtro `has()` (que descarta ''), el borrado nunca llegaria al backend
    // y el texto viejo reaparecaria al recargar.
    expect(out.activationRecommendationNote).toBe('');
    expect(out.activationMessageDraft).toBe('');
  });
});

describe('E2E Job-Driven Ola 2: restricciones del Frente y envelope del Reto (Core §13, §14.1)', () => {
  it('adaptChallenge lee el envelope y toBackendChallenge lo envía, incluido el borrado con ""', () => {
    const challenge = adaptChallenge({
      id: 'c1', title: 'Reto', strategicFrontId: 'f1',
      knownFacts: 'El 40% se repite', openQuestions: null, constraints: 'Sin tocar proveedor',
      dependencies: 'CRM', expectedDecision: 'Escalar o no',
    });
    expect(challenge).toMatchObject({ knownFacts: 'El 40% se repite', openQuestions: '', constraints: 'Sin tocar proveedor', dependencies: 'CRM', expectedDecision: 'Escalar o no' });

    const out = toBackendChallenge({ knownFacts: 'Dato', openQuestions: '', constraints: undefined });
    expect(out).toEqual({ knownFacts: 'Dato', openQuestions: '' });
  });

  it('adaptStrategicFront y toBackendStrategicFront transportan las restricciones', () => {
    expect(adaptStrategicFront({ id: 'f1', name: 'Frente', constraints: 'Sin más headcount' }).constraints).toBe('Sin más headcount');
    expect(toBackendStrategicFront({ constraints: '' })).toEqual({ constraints: '' });
  });
});

describe('adaptTeamMembers (meta.teamMembers derivado, ADR-023/024)', () => {
  it('acepta strings y objetos del roster y devuelve nombres', () => {
    expect(adaptTeamMembers([
      'Ana',
      { userId: 'u2', name: 'Beto', role: 'EDITOR' },
      { userId: 'u3', name: null, email: 'carla@x.t' },
      { userId: 'u4', name: null },
      { name: '  ' },
      null,
      42,
    ])).toEqual(['Ana', 'Beto', 'carla@x.t', 'u4']);
  });

  it('adaptInitiative ya no deja objetos en teamMembers', () => {
    const initiative = adaptInitiative({ projectId: 'p1', challengeId: 'c1', teamMembers: [{ userId: 'u1', name: 'Dana' }] } as any);
    expect(initiative.teamMembers).toEqual(['Dana']);
  });

  it('no es array: lista vacía', () => {
    expect(adaptTeamMembers(undefined)).toEqual([]);
    expect(adaptTeamMembers({})).toEqual([]);
  });
});
