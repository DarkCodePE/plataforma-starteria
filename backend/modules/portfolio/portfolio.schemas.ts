import { z } from 'zod';

// ─── Strategic Front ─────────────────────────────────────────────────────────

export const createStrategicFrontSchema = z.object({
  name: z.string().min(2).max(200),
  description: z.string().max(2000).optional(),
  strategicObjective: z.string().max(2000).optional(),
  whyNow: z.string().max(2000).optional(),
  mainKpi: z.string().max(500).optional(),
  baseline: z.string().max(500).optional(),
  target: z.string().max(500).optional(),
  horizon: z.string().max(500).optional(),
  constraints: z.string().max(2000).optional(),
  sponsor: z.string().max(500).optional(),
  status: z.enum(['draft', 'active', 'paused', 'closed']).optional(),
  priority: z.enum(['Alta', 'Media', 'Baja']).optional(),
  organizationId: z.string().optional(),
  ownerId: z.string().optional(),
});

export const updateStrategicFrontSchema = createStrategicFrontSchema.partial();

// ─── Challenge ───────────────────────────────────────────────────────────────

// Los 9 ejes con los que el portfolio lead decide COMO activar un reto. Se guardan en la
// columna Json `Challenge.activationInputs`, que Postgres no valida: este enum es la unica
// barrera, por eso es estricto y no un z.record laxo. Debe seguir a
// ChallengeActivationInputs (front/src/features/portfolio-lead/domain/types.ts).
const challengeActivationInputsSchema = z.object({
  urgency: z.enum(['alta', 'media', 'baja']),
  timeAvailable: z.enum(['muy_poco', 'acotado', 'suficiente']),
  estimatedEffort: z.enum(['alto', 'medio', 'bajo']),
  challengeClarity: z.enum(['alta', 'media', 'baja']),
  informationSensitivity: z.enum(['alta', 'media', 'baja']),
  internalCapacity: z.enum(['alta', 'media', 'baja']),
  technicalNeed: z.enum(['alta', 'media', 'baja']),
  sponsorStatus: z.enum(['definido', 'notificado', 'confirmado']),
  dependency: z.enum(['ninguna', 'ti', 'legal', 'data', 'operaciones', 'comercial']),
});

export const createChallengeSchema = z.object({
  title: z.string().min(2).max(300),
  name: z.string().max(300).optional(),
  description: z.string().max(3000).optional(),
  type: z.enum(['correccion', 'crecimiento', 'exploracion']).optional(),
  whatWeWantToMove: z.string().max(2000).optional(),
  objective: z.string().max(2000).optional(),
  whyNow: z.string().max(2000).optional(),
  successCriteria: z.string().max(2000).optional(),
  // Challenge Constraint Envelope (Core §14.1).
  knownFacts: z.string().max(2000).optional(),
  openQuestions: z.string().max(2000).optional(),
  constraints: z.string().max(2000).optional(),
  dependencies: z.string().max(2000).optional(),
  expectedDecision: z.string().max(2000).optional(),
  challengeOwner: z.string().max(500).optional(),
  challengeOwnerStatus: z.enum(['definido', 'notificado', 'confirmado']).optional(),
  sponsorStatus: z.enum(['definido', 'notificado', 'confirmado']).optional(),
  openCallStatus: z.enum(['inactiva', 'activa']).optional(),
  visibleToParticipants: z.boolean().optional(),
  publicationNotes: z.string().max(2000).optional(),
  lastPublishedAt: z.string().datetime().optional(),
  status: z
    .enum([
      'draft',
      'listo_para_activar',
      'activo_interno',
      'publicado',
      'recibiendo_iniciativas',
      'con_iniciativas_activas',
      'pendiente_de_decision',
      // ADR-030: la pausa es un estado. zod solo comprueba que el VALOR existe;
      // que la transicion sea legal lo decide la maquina en el servicio.
      'pausado',
      'cerrado',
    ])
    .optional(),
  activationMode: z
    .enum(['convocatoria_abierta', 'personas_seleccionadas', 'squad_asignado'])
    .optional(),
  coverageStatus: z
    .enum([
      'sin_cobertura',
      'cobertura_parcial',
      'cobertura_suficiente',
      'resuelto',
      'reformular',
      'cerrar',
    ])
    .optional(),
  sponsorId: z.string().optional(),
  ownerId: z.string().optional(),
  // Autoria de la activacion del reto (MVP-P0-02). Antes se editaba en /portfolio y se
  // perdia al recargar: no habia columna donde guardarlo. `activationInputs` se persiste
  // como Json, asi que la forma se fija AQUI — es el unico borde que la valida.
  activationInputs: challengeActivationInputsSchema.optional(),
  activationRecommendationNote: z.string().max(2000).optional(),
  activationMessageDraft: z.string().max(4000).optional(),
});

export const updateChallengeSchema = createChallengeSchema.partial();

// ─── Invitation ──────────────────────────────────────────────────────────────

export const addInvitationSchema = z.object({
  value: z.string().min(1).max(500),
});

export const updateInvitationSchema = z.object({
  status: z.enum(['pendiente', 'notificado', 'confirmado', 'declinado']),
});

// ─── Squad Member ─────────────────────────────────────────────────────────────

export const addSquadMemberSchema = z.object({
  value: z.string().min(1).max(500),
  role: z.string().max(200).optional(),
});

export const updateSquadMemberSchema = z.object({
  role: z.string().max(200),
});

// ─── Challenge Team Member (ADR-023) ───────────────────────────────────────────
// Unified reto-scoped team. Accepts a userId (link to a real User) OR a free-text
// label (transition compat / external person not yet a User). Roles reuse TeamRole.

const teamRoleEnum = z.enum(['OWNER', 'EDITOR', 'VIEWER']);
const teamStatusEnum = z.enum(['ACTIVE', 'PENDING']);

export const addChallengeTeamMemberSchema = z
  .object({
    userId: z.string().min(1).optional(),
    label: z.string().min(1).max(500).optional(),
    role: teamRoleEnum.optional(),
    status: teamStatusEnum.optional(),
  })
  .refine((d) => Boolean(d.userId) || Boolean(d.label), {
    message: 'Indica un userId o un label.',
    path: ['userId'],
  });

export const updateChallengeTeamMemberSchema = z.object({
  role: teamRoleEnum.optional(),
  status: teamStatusEnum.optional(),
  label: z.string().min(1).max(500).optional(),
});

// ─── Initiative Team Override (ADR-023 / #114) ─────────────────────────────────
// Per-iniciativa override of the inherited team. Upserts a TeamMember (real User)
// marked inheritedFromChallenge=false.

export const upsertInitiativeTeamMemberSchema = z.object({
  role: teamRoleEnum.optional(),
  status: teamStatusEnum.optional(),
  modulePermissions: z.array(z.string()).optional(),
});

// ─── Initiative Meta ─────────────────────────────────────────────────────────

export const upsertInitiativeMetaSchema = z.object({
  challengeId: z.string().min(1),
  strategicFrontId: z.string().optional(),
  // Portfolio tracking fields
  teamOwner: z.string().max(500).optional(),
  currentStep: z.string().max(50).optional(),
  status: z
    .enum([
      'en_step_0',
      'en_step_1',
      'en_step_2',
      'en_step_3',
      'en_step_4',
      'bloqueada',
      'esperando_revision',
      'lista_para_decision',
      // ADR-030 (reconciliacion): adaptive-core ya ESCRIBE estos canonicos en la
      // transaccion de la decision. Sin ellos el borde rechazaba el estado en que la
      // propia decision deja la iniciativa: la API no sabia nombrar lo que la BD tenia.
      'implementation_approved',
      'scaling_approved',
      'paused',
      'closed',
      // Alias de lectura de `closed`. Se acepta para no romper clientes viejos; el
      // servidor ya no lo escribe y el backfill lo unifica.
      'cerrada',
    ])
    .optional(),
  mentor: z.string().max(500).optional(),
  sponsorTouchpoint: z.string().max(2000).optional(),
  mainAlert: z.string().max(2000).optional(),
  nextActionRecommended: z.string().max(2000).optional(),
  attackedArea: z.string().max(2000).optional(),
  hypothesisCovered: z.string().max(2000).optional(),
  mainMetric: z.string().max(500).optional(),
  contributionType: z
    .enum(['descubrir', 'validar', 'resolver_parcialmente', 'resolver_directamente'])
    .optional(),
  estimatedContribution: z.enum(['bajo', 'medio', 'alto']).optional(),
  lastActivity: z.string().max(500).optional(),
  signalSummary: z.string().max(2000).optional(),
  mainBlocker: z.string().max(2000).optional(),
  teamLabel: z.string().max(500).optional(),
  requiresSponsor: z.boolean().optional(),
  readyForDecision: z.boolean().optional(),
  blockedDays: z.number().int().min(0).optional(),
  requiresExternalCapability: z.boolean().optional(),
  partialSignal: z.boolean().optional(),
  resolvedCorePart: z.boolean().optional(),
  executiveSummary: z.string().max(5000).optional(),
  experimentSummary: z.string().max(5000).optional(),
  aiCommentSummary: z.string().max(5000).optional(),
  mentorCommentSummary: z.string().max(5000).optional(),
  decisionRecommendationReason: z.string().max(5000).optional(),
  // Complex arrays kept as Json
  teamMembers: z.array(z.string()).optional(),
  deliverables: z.array(z.record(z.unknown())).optional(),
  stepsTimeline: z.array(z.record(z.unknown())).optional(),
  // Legacy/decision fields
  coverageScore: z.number().min(0).max(1).optional(),
  alignmentNotes: z.string().max(3000).optional(),
  decisionOutcome: z
    .enum([
      'pasar_a_segunda_fase',
      'iterar_desde_otro_angulo',
      'transferir_a_ti',
      'transferir_al_area_afectada',
      'evaluar_innovacion_abierta',
      'escalar_piloto',
      'cerrar_con_aprendizaje',
    ])
    .optional(),
  decisionNotes: z.string().max(3000).optional(),
});

// ─── Overlap ──────────────────────────────────────────────────────────────────

export const createOverlapSchema = z.object({
  initiativeAId: z.string().min(1),
  initiativeBId: z.string().min(1),
  overlapScore: z.number().min(0).max(1).optional(),
  overlapNotes: z.string().max(3000).optional(),
  level: z.enum(['bajo', 'medio', 'alto']).optional(),
  rationale: z.string().max(3000).optional(),
  recommendation: z
    .enum(['seguir', 'fusionar', 'reformular_una', 'dejar_como_backup', 'cerrar_una'])
    .optional(),
});

// ─── Executive Output ─────────────────────────────────────────────────────────

const executiveOutputStatusEnum = z.enum([
  'borrador_ejecutivo',
  'listo_para_compartir',
  'compartido_con_sponsor',
  'compartido_con_gerencia',
  'decision_recibida',
  'aprobado',
  'aprobado_con_ajustes',
  'rechazado',
  'transferido',
  'escalado_a_segunda_fase',
  'cerrado',
]);

const portfolioDecisionOutcomeEnum = z.enum([
  'pasar_a_segunda_fase',
  'iterar_desde_otro_angulo',
  'transferir_a_ti',
  'transferir_al_area_afectada',
  'evaluar_innovacion_abierta',
  'escalar_piloto',
  'cerrar_con_aprendizaje',
]);

const executiveOutputFieldsSchema = z.object({
  initiativeId: z.string().optional(),
  recommendation: portfolioDecisionOutcomeEnum.optional(),
  status: executiveOutputStatusEnum.optional(),
  whyNow: z.string().max(2000).optional(),
  kpiToMove: z.string().max(500).optional(),
  approachSummary: z.string().max(5000).optional(),
  scopeSummary: z.string().max(5000).optional(),
  evidenceSummary: z.string().max(5000).optional(),
  keyDeliverableSummary: z.string().max(5000).optional(),
  cautionSummary: z.string().max(5000).optional(),
  recommendationWhy: z.string().max(5000).optional(),
  secondaryOptions: z.string().max(5000).optional(),
  nextStepSummary: z.string().max(2000).optional(),
  nextStepOwner: z.string().max(500).optional(),
  nextStepHorizon: z.string().max(500).optional(),
  nextStepExpectedResult: z.string().max(2000).optional(),
  managementNeeds: z.array(z.string()).optional(),
  timeline: z.array(z.record(z.unknown())).optional(),
  sharedAt: z.string().datetime().optional(),
  decisionAt: z.string().datetime().optional(),
});

export const createExecutiveOutputSchema = executiveOutputFieldsSchema.extend({
  projectId: z.string().min(1),
});

export const updateExecutiveOutputSchema = executiveOutputFieldsSchema;

// ─── Inferred Types ───────────────────────────────────────────────────────────

export type CreateStrategicFrontInput = z.infer<typeof createStrategicFrontSchema>;
export type UpdateStrategicFrontInput = z.infer<typeof updateStrategicFrontSchema>;
export type CreateChallengeInput = z.infer<typeof createChallengeSchema>;
export type UpdateChallengeInput = z.infer<typeof updateChallengeSchema>;
export type AddInvitationInput = z.infer<typeof addInvitationSchema>;
export type UpdateInvitationInput = z.infer<typeof updateInvitationSchema>;
export type AddSquadMemberInput = z.infer<typeof addSquadMemberSchema>;
export type UpdateSquadMemberInput = z.infer<typeof updateSquadMemberSchema>;
export type AddChallengeTeamMemberInput = z.infer<typeof addChallengeTeamMemberSchema>;
export type UpdateChallengeTeamMemberInput = z.infer<typeof updateChallengeTeamMemberSchema>;
export type UpsertInitiativeTeamMemberInput = z.infer<typeof upsertInitiativeTeamMemberSchema>;
export type UpsertInitiativeMetaInput = z.infer<typeof upsertInitiativeMetaSchema>;
export type CreateOverlapInput = z.infer<typeof createOverlapSchema>;
export type CreateExecutiveOutputInput = z.infer<typeof createExecutiveOutputSchema>;
export type UpdateExecutiveOutputInput = z.infer<typeof updateExecutiveOutputSchema>;

// Confirmación humana de una sugerencia de desagregación (E2E Job-Driven §26): sólo los retos elegidos.
export const confirmChallengeSplitSchema = z.object({
  challenges: z
    .array(z.object({ title: z.string().min(2).max(300), whatWeWantToMove: z.string().max(2000).optional() }))
    .min(1)
    .max(10),
});

// Asignación del Portfolio Lead que decide sobre una iniciativa de Reto (InitiativeGovernance).
export const assignInitiativeGovernanceSchema = z.object({
  portfolioLeadUserId: z.string().min(1).nullable(),
});
