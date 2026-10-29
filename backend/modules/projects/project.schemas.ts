import { z } from 'zod/v3';

export const createProjectSchema = z.object({
  name: z.string().min(3).max(200),
  description: z.string().max(1000).optional(),
  cohort: z.string().optional(),
  companyContext: z.object({
    companyId: z.string().min(1),
    areaId: z.string().min(1).optional(),
  }).optional(),
  // Issue #92: when the iniciativa is created from within a reto (Challenge), this
  // links it so the portfolio-lead dashboard can track it under that reto. Optional —
  // standalone iniciativas omit it. The link is persisted as InitiativePortfolioMeta
  // (Project has no direct challengeId column).
  challengeId: z.string().optional(),
  challengeLink: z.object({
    challengeId: z.string().min(1),
    createdFrom: z.literal('challenge').default('challenge'),
  }).optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(3).max(200).optional(),
  description: z.string().max(1000).optional(),
  status: z.string().optional(),
  riskLevel: z.enum(['Bajo', 'Medio', 'Alto']).optional(),
});

export const updateStep0Schema = z.object({
  // Legacy fields
  nombreParticipante: z.string().optional(),
  rolArea: z.string().optional(),
  origen: z.enum(['', 'problema', 'oportunidad', 'idea', 'explorando', 'otra']).optional(),
  quePasaQueQuieres: z.string().optional(),
  impacta: z.array(z.string()).optional(),
  parteProceso: z.enum(['', 'antes', 'durante', 'despues', 'transversal', 'otra']).optional(),
  impacto3meses: z.enum(['', 'ingresos', 'costos', 'riesgo', 'cliente', 'productividad', 'no_claro', 'otro']).optional(),
  respaldo: z.enum(['', 'datos', 'testimonios', 'benchmark', 'hipotesis', 'otro']).optional(),
  quienEscuchar: z.string().optional(),
  siMinimo: z.array(z.string()).optional(),
  status: z.enum(['No iniciado', 'En progreso', 'Completado']).optional(),
  // New fields (PR #5 public initiative start flow)
  mode: z.enum(['independent', 'linked_to_challenge']).optional(),
  initiativeTitle: z.string().optional(),
  initiativeFrame: z.enum(['', 'correccion', 'crecimiento', 'exploracion']).optional(),
  clarityLevel: z
    .enum(['', 'observacion_inicial', 'algunas_senales', 'hipotesis_clara', 'idea_pensada'])
    .optional(),
  primaryObjective: z
    .enum([
      '',
      'eficiencia',
      'experiencia_cliente',
      'ingresos',
      'riesgo',
      'productividad',
      'aprendizaje',
      'otro',
    ])
    .optional(),
  specificChallengePart: z.string().optional(),
  challengeGoalConnection: z.string().optional(),
  linkedContributionType: z
    .enum(['', 'descubrir_problema', 'validar_hipotesis', 'resolver_parte', 'resolver_directo', 'no_claro'])
    .optional(),
  impactWho: z.string().optional(),
  visibleMoment: z.string().optional(),
  whyNowText: z.string().optional(),
  ifNotNowConsequence: z.string().optional(),
  evidenceType: z.enum(['', 'datos', 'testimonios', 'benchmark', 'hipotesis', 'otro']).optional(),
  currentEvidence: z.string().optional(),
  validationSignal: z.string().optional(),
  sponsorInterestReason: z.string().optional(),
  supportNeeded: z.string().optional(),
  decisionRequested: z.string().optional(),
  deliveryEmail: z.string().email().optional().or(z.literal('')),
  additionalStakeholders: z.enum(['', 'no', 'si', 'no_claro']).optional(),
  additionalStakeholdersDetail: z.string().optional(),
});

export const projectIdParam = z.object({
  id: z.string().uuid(),
});

export const updateSponsorDataSchema = z.object({
  sponsorTouchpoints: z.array(z.record(z.unknown())).optional(),
  sponsorComments: z.array(z.record(z.unknown())).optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type UpdateStep0Input = z.infer<typeof updateStep0Schema>;
export type UpdateSponsorDataInput = z.infer<typeof updateSponsorDataSchema>;
