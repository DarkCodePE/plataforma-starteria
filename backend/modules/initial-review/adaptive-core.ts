import type { ChallengeType } from '@prisma/client';
import type { ImprovedProposal, InformationReadiness, StrategicQuestion } from './initial-review.types';
import { toCanonicalChallengeType } from './initial-review.types';

type RouteType = 'explore_validate' | 'design_solution' | 'implement_handoff' | 'plan_coordinate' | 'reconstruct_existing';
type DepthLevel = 'essential' | 'standard' | 'extended';

type ChallengeMandateSnapshot = {
  capturedAt: string;
  challenge: {
    id: string;
    title: string;
    knownFacts?: string | null;
    openQuestions?: string | null;
    constraints?: string | null;
    dependencies?: string | null;
    expectedDecision?: string | null;
  };
  strategicFront: {
    id: string;
    constraints?: string | null;
    mainKpi?: string | null;
    baseline?: string | null;
    target?: string | null;
    horizon?: string | null;
  } | null;
};

const visibleNameByRoute: Record<RouteType, string> = {
  explore_validate: 'Ordenar contexto y definir que validar',
  design_solution: 'Confirmar oportunidad y condiciones',
  implement_handoff: 'Confirmar mandato y readiness inicial',
  plan_coordinate: 'Aclarar objetivo, deadline y stakeholders',
  reconstruct_existing: 'Reconstruir contexto, ownership y supuestos',
};

const outputByRoute: Record<RouteType, string> = {
  explore_validate: 'Context Brief + Validation Contract',
  design_solution: 'Opportunity Brief',
  implement_handoff: 'Implementation Brief',
  plan_coordinate: 'Project Brief + Validation Contract',
  reconstruct_existing: 'Reconstructed Context',
};

export function buildAdaptiveCorePrefill(input: {
  snapshotId: string;
  selectedChallengeType: ChallengeType;
  proposal: ImprovedProposal;
  understandingSummary?: string | null;
  mainRisk?: string | null;
  informationReadiness?: InformationReadiness | null;
  pendingQuestions: StrategicQuestion[];
  companyContext?: unknown;
  challengeId?: string | null;
  challengeMandate?: ChallengeMandateSnapshot | null;
}) {
  const now = new Date().toISOString();
  const challengeType = toCanonicalChallengeType(input.selectedChallengeType);
  const routeType = deriveRouteType(input.proposal.nextRecommendedStep, input.proposal.initialFocus, input.mainRisk, challengeType);
  const depthLevel = deriveDepthLevel(input.informationReadiness, input.mainRisk, input.pendingQuestions.length, Boolean(input.companyContext));
  const masterContextId = `master-context-${input.snapshotId}-v1`;
  const knownFacts = [input.understandingSummary, input.proposal.initialFocus, input.proposal.expectedImpact].filter(isNonEmpty);
  const assumptions = input.pendingQuestions.map(question => question.question).filter(isNonEmpty);
  const risks = [input.mainRisk].filter(isNonEmpty);
  const contextSnapshots = [
    input.companyContext
      ? {
          id: `company-context-${input.snapshotId}-v1`,
          type: 'company',
          label: 'Contexto de empresa seleccionado',
          source: 'Seleccion del pre-Step',
          coverage: 60,
          confidence: 'medium',
          capturedAt: now,
          constraints: ['Toda restriccion derivada del contexto debe confirmarse antes de crear hard gates.'],
          actors: ['Sponsor', 'Owner de iniciativa'],
          confirmable: true,
        }
      : null,
    input.challengeId
      ? {
          id: `challenge-context-${input.snapshotId}-v1`,
          type: 'challenge',
          label: 'Contexto heredado del reto',
          source: input.challengeMandate ? 'Snapshot del mandato del reto al confirmar' : 'Reto vinculado',
          coverage: 70,
          confidence: 'medium',
          capturedAt: now,
          challengeId: input.challengeMandate?.challenge.id ?? input.challengeId,
          strategicFrontId: input.challengeMandate?.strategicFront?.id ?? null,
          knownFacts: input.challengeMandate?.challenge.knownFacts ?? null,
          openQuestions: input.challengeMandate?.challenge.openQuestions ?? null,
          constraints: [
            input.challengeMandate?.challenge.constraints,
            input.challengeMandate?.strategicFront?.constraints,
            'Validar que la contribucion no duplique iniciativas existentes.',
          ].filter(isNonEmpty),
          dependencies: input.challengeMandate?.challenge.dependencies ?? null,
          expectedDecision: input.challengeMandate?.challenge.expectedDecision ?? null,
          kpi: input.challengeMandate?.strategicFront?.mainKpi ?? null,
          baseline: input.challengeMandate?.strategicFront?.baseline ?? null,
          target: input.challengeMandate?.strategicFront?.target ?? null,
          horizon: input.challengeMandate?.strategicFront?.horizon ?? null,
          actors: ['Challenge Owner', 'Portfolio Lead'],
          confirmable: true,
        }
      : null,
  ].filter(Boolean);
  const checkpoints = [
    {
      id: 'cp-0-1',
      step: 0,
      code: 'CP-0.1',
      title: 'Enmarcar la iniciativa',
      purpose: 'Aclarar que se quiere mover, origen, tipo de reto, output y relacion con reto o frente.',
      status: 'ready',
      outputKey: 'InitiativeFraming',
      completionCriteria: ['Resultado entendible', 'Tipo de reto visible', 'Relacion con reto o frente tratada'],
      questions: [
        {
          id: 'cp-0-1-q1',
          checkpointId: 'CP-0.1',
          prompt: 'Que resultado o cambio debe quedar entendible para un lider?',
          purpose: 'Aclarar proposito antes de ejecutar metodo.',
          clarifiesVariable: 'objective',
          priority: 'must',
          answerType: 'free_text',
          reason: 'Step 0 no puede cerrar sin proposito entendible.',
          source: 'method_catalog',
          allowsUnknown: false,
          optional: false,
          prefilledFrom: knownFacts.length > 0 ? 'InitialReviewSnapshot' : undefined,
        },
      ],
      gates: [],
    },
    {
      id: 'cp-0-2',
      step: 0,
      code: 'CP-0.2',
      title: 'Aterrizar condiciones reales',
      purpose: 'Aclarar alcance, actores, gobernanza, dependencias y restricciones.',
      status: 'locked',
      outputKey: 'ExecutionConditionsMap',
      completionCriteria: ['Alcance inicial', 'Owner visible', 'Restricciones criticas tratadas o marcadas'],
      questions: [],
      gates: [{ id: 'gate-owner-required', severity: 'hard', label: 'Owner requerido', condition: 'No existe owner operativo confirmado.', resolution: 'Asignar owner antes de cerrar Step 0.' }],
    },
    {
      id: 'cp-0-3',
      step: 0,
      code: 'CP-0.3',
      title: 'Definir que validar o decidir',
      purpose: 'Separar hechos, senales, supuestos y faltantes para definir hipotesis y decision futura.',
      status: 'locked',
      outputKey: 'AlignmentBrief + ValidationContract',
      completionCriteria: ['Hipotesis o pregunta central', 'Criterio de exito', 'Decision futura definida'],
      questions: [],
      gates: [{ id: 'gate-decision-criteria-required', severity: 'hard', label: 'Criterio de decision requerido', condition: 'No existe decision futura ni criterio de exito.', resolution: 'Definir decision y evidencia minima.' }],
    },
  ];

  return {
    schemaVersion: 'PRD-03-v0.4',
    masterContext: {
      id: masterContextId,
      version: 1,
      initialReviewSnapshotId: input.snapshotId,
      challengeType,
      routeType,
      depthLevel,
      maturity: routeType === 'implement_handoff' ? 'solution_proposed' : routeType === 'reconstruct_existing' ? 'legacy_reconstruction' : 'problem',
      knownFacts,
      assumptions: assumptions.length > 0 ? assumptions : ['La hipotesis central aun debe confirmarse en Step 0.'],
      missingCriticalInformation: assumptions,
      risks,
      decisions: [input.proposal.nextRecommendedStep || 'Definir decision futura en CP-0.3.'],
      contextSnapshots,
      handoffMandate: input.challengeMandate ?? null,
      createdAt: now,
    },
    stepConfigurations: [
      {
        id: `step-0-${routeType}-v1`,
        step: 0,
        version: 1,
        visibleName: visibleNameByRoute[routeType],
        stablePurpose: 'Entender, alinear y definir que debe validarse o resolverse',
        objective: 'Convertir la intencion inicial en hipotesis estrategica delimitada y contrato de validacion o ejecucion.',
        expectedOutput: outputByRoute[routeType],
        routeType,
        depthLevel,
        checkpoints,
        closureCriteria: ['Objetivo o resultado entendible', 'Alcance inicial y owner', 'Hipotesis o pregunta central', 'Decision futura y criterio de exito'],
        generatedAt: now,
        generatedBy: 'deterministic_fallback',
      },
    ],
    activeStepConfigurationId: `step-0-${routeType}-v1`,
    progressSignal: {
      id: `progress-signal-${masterContextId}`,
      step: 0,
      checkpointCode: 'CP-0.1',
      checkpointTitle: 'Enmarcar la iniciativa',
      health: risks.length > 0 ? 'attention' : 'healthy',
      hypothesis: assumptions[0] || 'Hipotesis pendiente de definir en Step 0.',
      evidence: knownFacts[0] || 'Sin evidencia robusta aun; Step 0 ordena contexto.',
      evidenceStrength: knownFacts.length > 1 ? 'weak' : 'none',
      blocker: risks[0] || '',
      actorRequired: input.challengeId ? 'Challenge Owner' : 'Owner de iniciativa',
      nextAction: 'Iniciar CP-0.1: Enmarcar la iniciativa.',
      upcomingDecision: input.proposal.nextRecommendedStep || 'Definir decision futura en CP-0.3.',
      updatedAt: now,
    },
    challengeContribution: input.challengeId
      ? {
          subproblem: knownFacts[0] || 'Subproblema pendiente de delimitar.',
          hypothesis: assumptions[0] || 'Hipotesis pendiente.',
          kpi: input.proposal.expectedImpact || 'KPI pendiente de asociar.',
          contributionType: 'discover',
          evidenceStrength: 'weak',
          scope: 'Inicial, sujeto a confirmacion en Step 0.',
          overlap: 'low',
        }
      : undefined,
    auditEvents: [
      { id: `audit-route-confirmed-${input.snapshotId}`, type: 'route_confirmed', createdAt: now, summary: 'Ruta confirmada y contexto maestro creado.' },
      { id: `audit-step-config-created-0-${input.snapshotId}`, type: 'step_configuration_created', createdAt: now, summary: 'Step 0 configurado por checkpoints.' },
    ],
  };
}

function deriveRouteType(nextStep: string | undefined, focus: string | undefined, risk: string | null | undefined, challengeType: string): RouteType {
  const text = [nextStep, focus, risk].filter(Boolean).join(' ').toLowerCase();
  if (text.includes('implementar') || text.includes('handoff') || text.includes('adopcion')) return 'implement_handoff';
  if (text.includes('plan') || text.includes('coordinar') || text.includes('deadline')) return 'plan_coordinate';
  if (text.includes('reconstru')) return 'reconstruct_existing';
  if (text.includes('solucion') || text.includes('dise')) return 'design_solution';
  if (challengeType === 'correction') return 'plan_coordinate';
  return 'explore_validate';
}

function deriveDepthLevel(readiness: InformationReadiness | null | undefined, risk: string | null | undefined, pendingCount: number, hasCompanyContext: boolean): DepthLevel {
  const normalizedRisk = risk?.toLowerCase() ?? '';
  if (normalizedRisk.includes('legal') || normalizedRisk.includes('datos') || normalizedRisk.includes('regulator') || pendingCount >= 4) return 'extended';
  if (hasCompanyContext || readiness === 'medium' || readiness === 'high') return 'standard';
  return 'essential';
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
