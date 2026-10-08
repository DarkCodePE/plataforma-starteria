import type { PrismaClient } from '@prisma/client';
import { AppError } from '../../shared/errors/AppError';
import { propagateDecisionToPortfolioTx } from './decision-portfolio-return';
import { syncInitiativeProgress } from '../portfolio/initiative-progress';
import { TruthService, type EvidenceReferenceBindingInput, type ValidatedSupportBindingInput } from '../truth/truth.service';
import { getCheckpointEvidencePolicy } from './checkpoint-evidence-policy';
import { CriticalChangeDependencyResolver, mapLegacyCriticalChangeField } from './critical-change-dependency.resolver';
import { CriticalChangeImpactResolver } from './critical-change-impact.resolver';
import { buildCriticalChangeUserOutcome } from './critical-change-user-outcome';
import { DecisionAuthorityResolver } from './decision-authority.resolver';
import { DecisionReadinessResolver } from './decision-readiness.resolver';
import { InitiativeCompletionResolver } from './initiative-completion.resolver';
import { AdaptiveCycleService } from './cycle.service';
import type {
  AdaptiveCoreState,
  AdaptiveDepthLevel,
  AdaptiveHealth,
  AdaptiveQuestionSource,
  AdaptiveRouteType,
  MaterializedQuestion,
  StepNumber,
  Step0AlignmentBrief,
  ChangeImpactResult,
  DecisionReadinessAssessment,
  DecisionReadinessInput,
  DecisionType,
  DecisionAuthorityResult,
  DecisionOutcome,
  DecisionEffectsResult,
  DecisionResult,
  DecisionRequestResult,
  ContinuationRouteResult,
  ContinuationRouteType,
  InitiativeAlignmentResult,
  InitiativeCompletionRoutingResult,
  InitiativeHistoryResult,
} from './adaptive-core.types';
import type {
  ApplyDecisionEffectsInput,
  CheckpointResponseInput,
  ConfirmBriefInput,
  ConfirmCriticalChangeTransitionInput,
  ConfirmStep1OutputInput,
  ConfirmStep2OutputInput,
  ConfirmStep3OutputInput,
  ConfirmStep4OutputInput,
  CriticalChangeInput,
  DecisionRequestCreateInput,
  OrganizationalDecisionInput,
} from './adaptive-core.schemas';

import {
  CHECKPOINT_VARIABLES,
  missingRequiredVariables,
  planCheckpointQuestions,
} from './checkpoint-planner';

type Role = 'participante' | 'owner' | 'mentor' | 'admin' | 'sponsor' | 'portfolio_lead' | string;

const STEP0_CHECKPOINTS = [
  { key: 'CP-0.1', sequence: 1, title: 'Enmarcar la iniciativa', outputKey: 'InitiativeFraming' },
  { key: 'CP-0.2', sequence: 2, title: 'Aterrizar condiciones reales', outputKey: 'ExecutionConditionsMap' },
  { key: 'CP-0.3', sequence: 3, title: 'Definir que validar o decidir', outputKey: 'AlignmentBrief + ValidationContract' },
] as const;

// PRD-03 §5 — matriz ruta × Step. Steps 1-4 ya resolvian su output por ruta
// (STEPn_OUTPUT_BY_ROUTE); Step 0 era la unica fila que devolvia un texto fijo, y por
// eso la UI terminaba rotulando el output con copy legacy ("Propuesta para lider").
// `lightweight_plan` no esta en la matriz del PRD: replica explore_validate, igual que
// hacen los mapas de Steps 1-4.
// Debe coincidir con STEP_VISIBLE_NAME_BY_ROUTE / STEP_OUTPUT_BY_ROUTE (fila step 0) de
// front/src/features/adaptive-core/domain/adaptiveCore.ts, que ya implementaba la matriz
// del PRD. Cuando el backend responde, su configuracion gana sobre la del cliente: si las
// tablas divergen, el nombre del output cambia solo con que llegue la respuesta HTTP.
const STEP0_VISIBLE_NAME_BY_ROUTE: Record<AdaptiveRouteType, string> = {
  explore_validate: 'Ordenar contexto y definir que validar',
  design_solution: 'Confirmar oportunidad y condiciones',
  implement_handoff: 'Confirmar mandato y readiness inicial',
  plan_coordinate: 'Aclarar objetivo, deadline y stakeholders',
  reconstruct_existing: 'Reconstruir contexto, ownership y supuestos',
  lightweight_plan: 'Ordenar quick win',
};

const STEP0_OUTPUT_BY_ROUTE: Record<AdaptiveRouteType, string> = {
  explore_validate: 'Context Brief + Validation Contract',
  design_solution: 'Opportunity Brief',
  implement_handoff: 'Implementation Brief',
  plan_coordinate: 'Project Brief + Validation Contract',
  reconstruct_existing: 'Reconstructed Context',
  lightweight_plan: 'Quick Brief',
};

const STEP1_CHECKPOINTS = [
  { key: 'CP-1.1', sequence: 1, title: 'Priorizar validacion', outputKey: 'ValidationFocus' },
  { key: 'CP-1.2', sequence: 2, title: 'Disenar plan de evidencia', outputKey: 'EvidencePlan' },
  { key: 'CP-1.3', sequence: 3, title: 'Capturar y analizar evidencia', outputKey: 'EvidenceMap' },
  { key: 'CP-1.4', sequence: 4, title: 'Sintetizar y decidir foco', outputKey: 'Step1FocusDecision' },
] as const;

const STEP1_OUTPUT_BY_ROUTE: Record<AdaptiveRouteType, string> = {
  explore_validate: 'ProblemFocusBrief',
  design_solution: 'OpportunityThesis',
  implement_handoff: 'ReadinessAdoptionAssessment',
  plan_coordinate: 'UncertaintyLearningMap',
  reconstruct_existing: 'EvidenceReconstructionReport',
  lightweight_plan: 'ProblemFocusBrief',
};

const STEP2_CHECKPOINTS = [
  { key: 'CP-2.1', sequence: 1, title: 'Design Criteria', outputKey: 'DesignCriteria' },
  { key: 'CP-2.2', sequence: 2, title: 'Alternatives', outputKey: 'AlternativeSet' },
  { key: 'CP-2.3', sequence: 3, title: 'Selected Bet', outputKey: 'SelectedBet' },
  { key: 'CP-2.4', sequence: 4, title: 'Execution Design', outputKey: 'ExecutionDesign' },
  { key: 'CP-2.5', sequence: 5, title: 'Readiness', outputKey: 'ReadinessCheck' },
] as const;

const STEP2_OUTPUT_BY_ROUTE: Record<AdaptiveRouteType, string> = {
  explore_validate: 'ExperimentCard',
  design_solution: 'PilotCard',
  implement_handoff: 'ImplementationValidationPlan',
  plan_coordinate: 'DeliveryPlan',
  reconstruct_existing: 'RecoveryValidationPlan',
  lightweight_plan: 'ExperimentCard',
};

const STEP3_CHECKPOINTS = [
  { key: 'CP-3.1', sequence: 1, title: 'Execution Readiness', outputKey: 'ExecutionReadiness' },
  { key: 'CP-3.2', sequence: 2, title: 'Execution Log', outputKey: 'ExecutionLog' },
  { key: 'CP-3.3', sequence: 3, title: 'Result Analysis', outputKey: 'ExperimentResultAnalysis' },
  { key: 'CP-3.4', sequence: 4, title: 'Decision', outputKey: 'Step3Decision' },
  { key: 'CP-3.5', sequence: 5, title: 'Operational Readiness', outputKey: 'OperationalReadiness' },
] as const;

const STEP3_OUTPUT_BY_ROUTE: Record<AdaptiveRouteType, string> = {
  explore_validate: 'ExperimentResultsLearningDecision',
  design_solution: 'PilotResultsProductDecision',
  implement_handoff: 'ImplementationValidationReport',
  plan_coordinate: 'ExecutionReviewUpdatedDecision',
  reconstruct_existing: 'RecoveryResultsRegularizationDecision',
  lightweight_plan: 'LightweightResultsBrief',
};

const STEP4_CHECKPOINTS = [
  { key: 'CP-4.1', sequence: 1, title: 'Audiencia y decision', outputKey: 'DecisionAudienceBrief' },
  { key: 'CP-4.2', sequence: 2, title: 'Narrativa con evidencia', outputKey: 'EvidenceBackedNarrative' },
  { key: 'CP-4.3', sequence: 3, title: 'Siguiente horizonte', outputKey: 'NextHorizonPlan' },
  { key: 'CP-4.4', sequence: 4, title: 'Paquete de decision', outputKey: 'DecisionPackage' },
  { key: 'CP-4.5', sequence: 5, title: 'Transferencia o cierre', outputKey: 'TransferOrClosure' },
] as const;

const STEP4_OUTPUT_BY_ROUTE: Record<AdaptiveRouteType, string> = {
  explore_validate: 'DecisionMemoLearningReport',
  design_solution: 'BusinessCaseRoadmap',
  implement_handoff: 'OperationalHandoffPackage',
  plan_coordinate: 'ExecutiveDeliveryReport',
  reconstruct_existing: 'RegularizationGovernancePackage',
  lightweight_plan: 'LightweightDecisionBrief',
};

export class AdaptiveCoreService {
  private cycles: AdaptiveCycleService;
  private criticalChangeDependencies = new CriticalChangeDependencyResolver();
  private criticalChangeImpact = new CriticalChangeImpactResolver();
  private decisionReadiness = new DecisionReadinessResolver();
  private decisionAuthority = new DecisionAuthorityResolver();
  private initiativeCompletion = new InitiativeCompletionResolver();

  constructor(private prisma: PrismaClient) {
    this.cycles = new AdaptiveCycleService(prisma);
  }

  async ensureInitialized(projectId: string, userId: string, role: Role): Promise<AdaptiveCoreState> {
    const project = await this.getAccessibleProject(projectId, userId, role);
    const db = this.prisma as any;
    const cycle = await this.cycles.ensureActiveCycle(projectId);
    const existing = await db.adaptiveStepConfiguration.findFirst({
      where: { projectId, cycleId: cycle.id, status: 'active' },
      orderBy: { version: 'desc' },
    });
    if (!existing) {
      await this.initializeFromProject(project, userId, cycle.id);
    }
    return this.getState(projectId, userId, role);
  }

  async initializeFromProject(project: any, userId?: string, cycleId?: string): Promise<void> {
    const db = this.prisma as any;
    const cycle = cycleId ? { id: cycleId } : await this.cycles.ensureActiveCycle(project.id);
    const existing = await db.adaptiveStepConfiguration.findFirst({
      where: { projectId: project.id, cycleId: cycle.id, stepNumber: 0, status: 'active' },
      select: { id: true },
    });
    if (existing) return;

    const masterContext = this.buildMasterContext(project);
    const config = this.buildStepConfiguration(0, 1, masterContext);
    await db.$transaction(async (tx: any) => {
      const createdConfig = await tx.adaptiveStepConfiguration.create({
        data: {
          projectId: project.id,
          cycleId: cycle.id,
          stepNumber: 0,
          version: 1,
          status: 'active',
          routeType: masterContext.routeType,
          depthLevel: masterContext.depthLevel,
          maturity: masterContext.maturity,
          configurationJson: config,
          sourceContextJson: masterContext,
        },
      });
      await this.materializeCheckpointTx(tx, project.id, createdConfig, 'CP-0.1', [], userId, `checkpoint_started:${project.id}:CP-0.1:1`);
      await this.upsertProgressSignalTx(tx, project.id, {
        step: 0,
        checkpointCode: 'CP-0.1',
        checkpointTitle: 'Enmarcar la iniciativa',
        health: masterContext.risks.length > 0 ? 'attention' : 'healthy',
        hypothesis: masterContext.assumptions[0] ?? 'Hipotesis pendiente de definir en Step 0.',
        evidence: masterContext.knownFacts[0] ?? 'Sin evidencia robusta aun; Step 0 ordena contexto.',
        evidenceStrength: masterContext.knownFacts.length > 1 ? 'weak' : 'none',
        blocker: masterContext.risks[0] ?? '',
        actorRequired: masterContext.challengeSnapshot ? 'Challenge Owner' : 'Owner de iniciativa',
        nextAction: 'Iniciar CP-0.1: Enmarcar la iniciativa.',
        upcomingDecision: masterContext.decisions[0] ?? 'Definir decision futura en CP-0.3.',
        updatedAt: new Date().toISOString(),
      });
      await this.recordEventTx(tx, project.id, 'step_configuration_created', 'Step 0 configurado por checkpoints.', { step: 0, version: 1 }, userId, `step-config-created:${project.id}:0:1`);
    });
  }

  async getState(projectId: string, userId: string, role: Role): Promise<AdaptiveCoreState> {
    await this.getAccessibleProject(projectId, userId, role);
    const db = this.prisma as any;
const cycle = await this.cycles.getOperationalCycle(projectId);

const [configs, instances, outputs, signal, events] = await Promise.all([
  db.adaptiveStepConfiguration.findMany({
    where: { projectId, cycleId: cycle.id },
    orderBy: [{ stepNumber: 'asc' }, { version: 'asc' }],
  }),
  db.adaptiveCheckpointInstance.findMany({
    where: { projectId, cycleId: cycle.id },
    orderBy: [{ stepNumber: 'asc' }, { sequence: 'asc' }, { createdAt: 'asc' }],
  }),
  db.adaptiveStepOutput.findMany({
    where: { projectId, cycleId: cycle.id },
    orderBy: [{ stepNumber: 'asc' }, { version: 'asc' }],
  }),
  db.adaptiveProgressSignal.findUnique({ where: { projectId } }),
  db.adaptiveAdaptationEvent.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    take: 30,
  }),
]);

const instanceIds = instances.map((instance: any) => instance.id);

const responses = instanceIds.length > 0
  ? await db.adaptiveCheckpointResponse.findMany({
      where: {
        projectId,
        checkpointInstanceId: { in: instanceIds },
      },
      orderBy: { createdAt: 'asc' },
    })
  : [];
    // Las respuestas confirmadas son la fuente de verdad del recorrido adaptativo. Antes
    // no salian del backend, asi que el frontend reconstruia las variables raspando el
    // formulario legacy de Step 0 y terminaban existiendo dos verdades para el mismo dato.
    const responsesByInstance = new Map<string, Record<string, unknown>>();
    for (const response of responses) {
      responsesByInstance.set(response.checkpointInstanceId, {
        ...(responsesByInstance.get(response.checkpointInstanceId) ?? {}),
        ...((response.responseJson ?? {}) as Record<string, unknown>),
      });
    }
    const activeConfig = configs.find((c: any) => c.status === 'active' && c.stepNumber === 4)
      ?? configs.find((c: any) => c.status === 'active' && c.stepNumber === 3)
      ?? configs.find((c: any) => c.status === 'active' && c.stepNumber === 2)
      ?? configs.find((c: any) => c.status === 'active' && c.stepNumber === 1)
      ?? configs.find((c: any) => c.status === 'active' && c.stepNumber === 0)
      ?? configs[0];
    const activeCheckpoint = instances.find((i: any) => i.status === 'ready' || i.status === 'in_progress') ?? null;
    return {
      schemaVersion: 'PRD-03-v0.4',
      masterContext: activeConfig?.sourceContextJson ?? {},
      activeStepConfigurationId: activeConfig?.id ?? '',
      stepConfigurations: configs.map((c: any) => ({ ...c.configurationJson, id: c.id, version: c.version, status: c.status, requiresReview: c.requiresReview })),
      activeCheckpoint: activeCheckpoint ? this.serializeCheckpoint(activeCheckpoint, responsesByInstance.get(activeCheckpoint.id)) : null,
      checkpointInstances: instances.map((i: any) => this.serializeCheckpoint(i, responsesByInstance.get(i.id))),
      // Vista fusionada en orden cronologico: es la misma semantica que el servicio usa
      // internamente para construir los outputs (Object.assign sobre las respuestas), y
      // deja el merge en un solo lugar en vez de duplicarlo en el frontend.
      confirmedResponses: responses.reduce(
        (acc: Record<string, unknown>, response: any) => Object.assign(acc, (response.responseJson ?? {}) as Record<string, unknown>),
        {} as Record<string, unknown>,
      ),
      stepOutputs: outputs.map((o: any) => ({ id: o.id, step: o.stepNumber, version: o.version, status: o.status, outputKey: o.outputKey, output: o.outputJson, requiresReview: o.requiresReview })),
      progressSignal: signal?.signalJson ?? null,
      events,
      cycle: {
        id: cycle.id,
        cycleNumber: cycle.cycleNumber,
        startStep: cycle.startStep,
        currentStep: cycle.currentStep,
        status: cycle.status,
      },
      legacyFallback: Boolean(activeConfig?.sourceContextJson?.legacyFallback),
    };
  }

  async getDecisionReadiness(projectId: string, userId: string, role: Role, decisionType: DecisionType): Promise<DecisionReadinessAssessment> {
    const project = await this.getAccessibleProject(projectId, userId, role);
    const cycle = await this.getOperationalCycleReadOnly(projectId);
    const input = await this.loadDecisionReadinessInput(project, cycle, decisionType);
    return this.decisionReadiness.evaluate(input);
  }

  async getDecisionAuthority(projectId: string, userId: string, role: Role, decisionType: DecisionType): Promise<DecisionAuthorityResult> {
    const project = await this.getAccessibleProject(projectId, userId, role);
    const cycle = await this.getOperationalCycleReadOnly(projectId);
    return this.resolveDecisionAuthority(project, cycle, userId, decisionType);
  }

  async getInitiativeAlignment(projectId: string, userId: string, role: Role): Promise<InitiativeAlignmentResult> {
    const project = await this.getAccessibleProject(projectId, userId, role);
    return this.resolveInitiativeAlignment(project);
  }

  async getInitiativeCompletionRouting(projectId: string, userId: string, role: Role): Promise<InitiativeCompletionRoutingResult> {
    const project = await this.getAccessibleProject(projectId, userId, role);
    const cycle = await this.getOperationalCycleReadOnly(projectId);
    const alignment = await this.resolveInitiativeAlignment(project);
    const methodologicalCompletion = await this.hasMethodologicalCompletion(projectId, cycle.id);
    return this.initiativeCompletion.routeCompletion({
      projectId,
      cycleId: cycle.id,
      methodologicalCompletion,
      alignment,
    });
  }

  async getInitiativeHistory(projectId: string, userId: string, role: Role): Promise<InitiativeHistoryResult> {
    const project = await this.getAccessibleProject(projectId, userId, role);
    const db = this.prisma as any;
    const cycle = await this.getOperationalCycleReadOnly(projectId);
    const alignment = await this.resolveInitiativeAlignment(project);
    const methodologicalCompletion = await this.hasMethodologicalCompletion(projectId, cycle.id);
    const routing = this.initiativeCompletion.routeCompletion({
      projectId,
      cycleId: cycle.id,
      methodologicalCompletion,
      alignment,
    });
    const cycles = await db.initiativeCycle.findMany({ where: { projectId }, orderBy: { cycleNumber: 'asc' } });
    const cycleIds = cycles.map((item: any) => item.id);
    const [stepStates, outputs, evidence, sourceRefs, truthClaims] = await Promise.all([
      db.cycleStepState.findMany({ where: { cycleId: { in: cycleIds } }, orderBy: [{ stepNumber: 'asc' }] }),
      db.adaptiveStepOutput.findMany({ where: { projectId, status: 'confirmed' }, orderBy: [{ stepNumber: 'asc' }, { version: 'asc' }] }),
      db.evidence.findMany({ where: { projectId }, orderBy: { createdAt: 'asc' } }),
      db.sourceRef.findMany({ where: { projectId }, orderBy: { createdAt: 'asc' } }),
      db.truthClaim.findMany({ where: { projectId }, orderBy: { createdAt: 'asc' } }),
    ]);
    return {
      projectId,
      summary: {
        name: project.name,
        status: project.status,
        currentStep: project.currentStep ?? 0,
        ownerId: project.ownerId ?? null,
      },
      alignment,
      completionRouting: routing,
      lifecycleProjection: routing.lifecycleProjection,
      cycles: cycles.map((cycle: any) => ({
        id: cycle.id,
        cycleNumber: cycle.cycleNumber,
        status: cycle.status,
        parentCycleId: cycle.parentCycleId ?? null,
        basedOnCycleId: cycle.basedOnCycleId ?? null,
        triggerType: cycle.triggerType,
        triggerRefId: cycle.triggerRefId ?? null,
        startStep: cycle.startStep,
        currentStep: cycle.currentStep,
        completedAt: cycle.completedAt ?? null,
        stepStates: stepStates
          .filter((state: any) => state.cycleId === cycle.id)
          .map((state: any) => ({
            stepNumber: state.stepNumber,
            state: state.state,
            inheritedFromCycleId: state.inheritedFromCycleId ?? null,
            inheritedFromOutputId: state.inheritedFromOutputId ?? null,
          })),
        confirmedOutputs: outputs
          .filter((output: any) => output.cycleId === cycle.id)
          .map((output: any) => ({
            id: output.id,
            stepNumber: output.stepNumber,
            version: output.version,
            status: output.status,
            outputKey: output.outputKey,
            outputJson: output.outputJson,
            confirmedAt: output.confirmedAt ?? null,
            sourceConfigurationId: output.sourceConfigurationId ?? null,
          })),
      })),
      evidence: evidence.map((item: any) => ({
        id: item.id,
        name: item.name ?? null,
        truthStatus: item.truthStatus ?? null,
        sourceRefId: item.sourceRefId ?? null,
        targetClaimId: item.targetClaimId ?? null,
      })),
      sourceRefs: sourceRefs.map((item: any) => ({
        id: item.id,
        sourceType: item.sourceType,
        reference: item.reference,
      })),
      truthClaims: truthClaims.map((item: any) => ({
        id: item.id,
        statement: item.statement,
        verificationState: item.verificationState ?? null,
      })),
    };
  }

  async createDecisionRequest(projectId: string, userId: string, role: Role, input: DecisionRequestCreateInput): Promise<DecisionRequestResult> {
    const project = await this.getAccessibleProject(projectId, userId, role);
    const db = this.prisma as any;
    const existingByKey = await db.decisionRequest.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existingByKey) return this.mapDecisionRequest(existingByKey);

    const created = await db.$transaction(async (tx: any) => {
      const cycle = await this.getOperationalCycleReadOnly(projectId, tx);
      const alignment = await this.resolveInitiativeAlignment(project, tx);
      const methodologicalCompletion = await this.hasMethodologicalCompletion(projectId, cycle.id, tx);
      const routing = this.initiativeCompletion.routeCompletion({
        projectId,
        cycleId: cycle.id,
        methodologicalCompletion,
        alignment,
      });
      if (!alignment.portfolioAligned) {
        throw AppError.conflict('Las iniciativas auto-iniciadas no requieren DecisionRequest.', 'DECISION_REQUEST_NOT_REQUIRED');
      }
      if (routing.route !== 'portfolio_presented' || !routing.portfolioReviewRequired) {
        throw AppError.conflict('La iniciativa aun no esta presentada para revision de portafolio.', 'DECISION_REQUEST_NOT_PRESENTED');
      }
      if (!routing.methodologicalCompletion || cycle.status !== 'completed' || !cycle.completedAt) {
        throw AppError.conflict('La solicitud requiere un ciclo metodologico completado.', 'DECISION_REQUEST_CYCLE_NOT_COMPLETED');
      }

      const authority = await this.resolveDecisionAuthority(project, cycle, userId, 'continue_experimenting', tx, 'portfolio_review');
      if (!authority.currentUserCanSubmit) {
        throw AppError.forbidden('No tienes permiso para solicitar revision de esta iniciativa.', 'DECISION_REQUEST_SUBMIT_FORBIDDEN');
      }
      if (authority.authorityStatus !== 'resolved' || !authority.authorityUserId) {
        throw AppError.conflict('La autoridad de decision de portafolio no esta resuelta.', 'DECISION_AUTHORITY_UNRESOLVED');
      }

      const existingPending = await tx.decisionRequest.findFirst({
        where: { projectId, sourceCycleId: cycle.id, status: 'pending' },
        orderBy: { createdAt: 'asc' },
      });
      if (existingPending) return existingPending;

      const readinessSnapshot = await this.buildDecisionReadinessSnapshot(project, cycle, tx);
      const step4Output = await tx.adaptiveStepOutput.findFirst({
        where: { projectId, cycleId: cycle.id, stepNumber: 4, status: 'confirmed' },
        orderBy: { version: 'desc' },
      });
      if (!step4Output) {
        throw AppError.conflict('La solicitud requiere el paquete de Step 4 confirmado.', 'DECISION_REQUEST_PACKAGE_MISSING');
      }
      const decisionPackageSnapshot = {
        sourceOutputId: step4Output.id,
        outputKey: step4Output.outputKey,
        stepNumber: step4Output.stepNumber,
        version: step4Output.version,
        confirmedAt: step4Output.confirmedAt,
        outputJson: step4Output.outputJson,
      };
      const presentationSnapshot = {
        alignment,
        completionRouting: routing,
        projectStatus: project.status,
        sourceCycle: {
          id: cycle.id,
          cycleNumber: cycle.cycleNumber,
          status: cycle.status,
          completedAt: cycle.completedAt,
        },
      };
      const recommendationSnapshot = this.buildDecisionRequestRecommendationSnapshot(step4Output.outputJson, readinessSnapshot);
      const request = await tx.decisionRequest.create({
        data: {
          projectId,
          sourceCycleId: cycle.id,
          requestedById: userId,
          status: 'pending',
          authorityType: authority.authorityType,
          authorityUserId: authority.authorityUserId,
          readinessSnapshotJson: readinessSnapshot,
          authoritySnapshotJson: authority,
          decisionPackageSnapshotJson: decisionPackageSnapshot,
          recommendationSnapshotJson: recommendationSnapshot,
          presentationSnapshotJson: presentationSnapshot,
          requestVersion: 1,
          idempotencyKey: input.idempotencyKey,
        },
      });
      await this.recordEventTx(tx, projectId, 'decision_request_created', 'Solicitud de revision de portafolio creada.', {
        decisionRequestId: request.id,
        sourceCycleId: cycle.id,
        authorityPurpose: 'portfolio_review',
        authorityType: authority.authorityType,
        authorityUserId: authority.authorityUserId,
      }, userId, `decision-request-created:${input.idempotencyKey}`);
      return request;
    });
    return this.mapDecisionRequest(created);
  }

  async listDecisionRequests(projectId: string, userId: string, role: Role): Promise<DecisionRequestResult[]> {
    await this.getAccessibleProject(projectId, userId, role);
    const rows = await (this.prisma as any).decisionRequest.findMany({
      where: { projectId },
      orderBy: { requestedAt: 'desc' },
    });
    return rows.map((row: any) => this.mapDecisionRequest(row));
  }

  async getDecisionRequest(projectId: string, userId: string, role: Role, requestId: string): Promise<DecisionRequestResult> {
    await this.getAccessibleProject(projectId, userId, role);
    const row = await (this.prisma as any).decisionRequest.findFirst({ where: { id: requestId, projectId } });
    if (!row) throw AppError.notFound('DecisionRequest', 'DECISION_REQUEST_NOT_FOUND');
    return this.mapDecisionRequest(row);
  }

  async decideDecisionRequest(projectId: string, userId: string, role: Role, requestId: string, input: OrganizationalDecisionInput): Promise<DecisionResult> {
    const project = await this.getAccessibleProject(projectId, userId, role);
    const db = this.prisma as any;
    const existingByKey = await db.decision.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existingByKey) {
      if (existingByKey.projectId === projectId && existingByKey.decisionRequestId === requestId) {
        return this.mapDecision(existingByKey);
      }
      throw AppError.conflict('La idempotencyKey ya fue usada para otra decision.', 'DECISION_IDEMPOTENCY_CONFLICT');
    }

    const decision = await db.$transaction(async (tx: any) => {
      if (tx.$queryRaw) {
        await tx.$queryRaw`SELECT "id" FROM "DecisionRequest" WHERE "id" = ${requestId} FOR UPDATE`;
      }
      const request = await tx.decisionRequest.findFirst({ where: { id: requestId, projectId } });
      if (!request) throw AppError.notFound('DecisionRequest', 'DECISION_REQUEST_NOT_FOUND');
      const existingForRequest = await tx.decision.findFirst({ where: { decisionRequestId: request.id } });
      if (existingForRequest) {
        if (existingForRequest.idempotencyKey === input.idempotencyKey) return existingForRequest;
        throw AppError.conflict('La solicitud de decision ya fue resuelta.', 'DECISION_REQUEST_ALREADY_RESOLVED');
      }
      if (request.status !== 'pending') {
        throw AppError.conflict('Solo una DecisionRequest pending puede resolverse.', 'DECISION_REQUEST_NOT_PENDING');
      }

      const sourceCycle = await tx.initiativeCycle.findUnique({ where: { id: request.sourceCycleId } });
      if (!sourceCycle || sourceCycle.projectId !== projectId) {
        throw AppError.conflict('La solicitud no pertenece a un ciclo fuente valido.', 'DECISION_REQUEST_STALE');
      }
      await this.assertDecisionRequestNotStaleTx(tx, project, request, sourceCycle);

      const authority = await this.resolveDecisionAuthority(project, sourceCycle, userId, input.outcome, tx, 'portfolio_review');
      if (authority.authorityStatus !== 'resolved' || !authority.currentUserCanDecide) {
        throw AppError.forbidden('Solo el Portfolio Lead autorizado puede confirmar esta decision.', 'DECISION_AUTHORITY_REQUIRED');
      }

      const readinessInput = await this.loadDecisionReadinessInput(project, sourceCycle, input.outcome, tx);
      const readiness = this.decisionReadiness.evaluate(readinessInput);
      const acceptedConditions = this.validateDecisionReadinessForDecision(readiness, input);
      const rationale = String(input.rationale ?? '').trim();
      if (!rationale) {
        throw AppError.badRequest('La decision requiere rationale humano.', 'DECISION_RATIONALE_REQUIRED');
      }
      const recommendedOutcome = this.recommendedOutcomeFromSnapshot(request.recommendationSnapshotJson);
      if (recommendedOutcome && recommendedOutcome !== input.outcome && !rationale) {
        throw AppError.badRequest('Elegir un resultado distinto a la recomendacion requiere rationale.', 'DECISION_RATIONALE_REQUIRED');
      }

      const created = await tx.decision.create({
        data: {
          projectId,
          sourceCycleId: request.sourceCycleId,
          decisionRequestId: request.id,
          outcome: input.outcome,
          decidedById: userId,
          rationale,
          conditionsJson: acceptedConditions.length > 0 ? acceptedConditions : null,
          authoritySnapshotJson: authority,
          readinessSnapshotJson: readiness,
          recommendationSnapshotJson: request.recommendationSnapshotJson ?? null,
          packageSnapshotJson: request.decisionPackageSnapshotJson,
          presentationSnapshotJson: request.presentationSnapshotJson,
          idempotencyKey: input.idempotencyKey,
        },
      });
      await tx.decisionRequest.update({
        where: { id: request.id },
        data: { status: 'resolved' },
      });
      // E2E Job-Driven §23: la decisión vuelve al Reto, al Frente y al Portfolio.
      await propagateDecisionToPortfolioTx(tx, created);
      await this.recordEventTx(tx, projectId, 'organizational_decision_created', 'Decision organizacional registrada por Portfolio Lead.', {
        decisionId: created.id,
        decisionRequestId: request.id,
        sourceCycleId: request.sourceCycleId,
        outcome: input.outcome,
      }, userId, `organizational-decision-created:${input.idempotencyKey}`);
      return created;
    });

    return this.mapDecision(decision);
  }

  async listDecisions(projectId: string, userId: string, role: Role): Promise<DecisionResult[]> {
    await this.getAccessibleProject(projectId, userId, role);
    const rows = await (this.prisma as any).decision.findMany({
      where: { projectId },
      orderBy: { decidedAt: 'desc' },
    });
    return rows.map((row: any) => this.mapDecision(row));
  }

  async getDecision(projectId: string, userId: string, role: Role, decisionId: string): Promise<DecisionResult> {
    await this.getAccessibleProject(projectId, userId, role);
    const row = await (this.prisma as any).decision.findFirst({ where: { id: decisionId, projectId } });
    if (!row) throw AppError.notFound('Decision', 'DECISION_NOT_FOUND');
    return this.mapDecision(row);
  }

  async applyDecisionEffects(projectId: string, userId: string, role: Role, decisionId: string, input: ApplyDecisionEffectsInput = {}): Promise<DecisionEffectsResult> {
    await this.getAccessibleProject(projectId, userId, role);
    const db = this.prisma as any;
    const idempotencyKey = input.idempotencyKey ?? `decision-effects:${decisionId}`;
    const existingByKey = input.idempotencyKey
      ? await db.continuationRoute.findUnique({ where: { idempotencyKey } }).catch(() => null)
      : null;
    if (existingByKey) {
      if (existingByKey.projectId === projectId && existingByKey.decisionId === decisionId) {
        return this.buildDecisionEffectsResult(db, projectId, decisionId, existingByKey);
      }
      throw AppError.conflict('La idempotencyKey ya fue usada para otra ruta de continuacion.', 'DECISION_EFFECTS_IDEMPOTENCY_CONFLICT');
    }

    const route = await db.$transaction(async (tx: any) => {
      if (tx.$queryRaw) {
        await tx.$queryRaw`SELECT "id" FROM "Decision" WHERE "id" = ${decisionId} FOR UPDATE`;
      }
      const decision = await tx.decision.findFirst({ where: { id: decisionId, projectId } });
      if (!decision) throw AppError.notFound('Decision', 'DECISION_NOT_FOUND');
      const existing = await tx.continuationRoute.findFirst({ where: { decisionId } });
      if (existing) return existing;
      await this.assertDecisionEffectsSourceValidTx(tx, projectId, decision);

      const routeType = this.routeTypeForDecision(decision.outcome);
      if (routeType === 'new_cycle') {
        return this.applyContinueExperimentingEffectTx(tx, projectId, decision, idempotencyKey);
      }
      if (routeType === 'implementation_handoff') {
        return this.applyImplementationHandoffEffectTx(tx, projectId, decision, idempotencyKey);
      }
      if (routeType === 'scaling_handoff') {
        return this.applyScalingHandoffEffectTx(tx, projectId, decision, idempotencyKey);
      }
      if (routeType === 'paused') {
        return this.applyPauseEffectTx(tx, projectId, decision, idempotencyKey);
      }
      return this.applyCloseWithLearningEffectTx(tx, projectId, decision, idempotencyKey);
    });

    return this.buildDecisionEffectsResult(db, projectId, decisionId, route);
  }

  async listContinuationRoutes(projectId: string, userId: string, role: Role): Promise<ContinuationRouteResult[]> {
    await this.getAccessibleProject(projectId, userId, role);
    const rows = await (this.prisma as any).continuationRoute.findMany({
      where: { projectId },
      orderBy: { appliedAt: 'desc' },
    });
    return rows.map((row: any) => this.mapContinuationRoute(row));
  }

  async confirmCheckpoint(projectId: string, userId: string, role: Role, input: CheckpointResponseInput): Promise<AdaptiveCoreState> {
    this.assertTeamWorkAccess(await this.getAccessibleProject(projectId, userId, role), userId, role);
    await this.ensureInitialized(projectId, userId, role);
    const db = this.prisma as any;
    const cycle = await this.cycles.ensureActiveCycle(projectId);
    const existingResponse = await db.adaptiveCheckpointResponse.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existingResponse) return this.getState(projectId, userId, role);
    this.assertCycleMutable(cycle);

    const instance = await db.adaptiveCheckpointInstance.findFirst({
      where: { projectId, cycleId: cycle.id, checkpointKey: input.checkpointKey, status: { in: ['ready', 'in_progress'] } },
      include: { stepConfiguration: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!instance) throw AppError.conflict('El checkpoint no esta activo o ya fue confirmado.', 'CHECKPOINT_NOT_ACTIVE');
    const stepConfiguration = instance.stepConfiguration
      ?? await db.adaptiveStepConfiguration.findUnique({ where: { id: instance.stepConfigurationId } });
    if (!stepConfiguration) throw AppError.badRequest('No existe configuracion para el checkpoint activo.', 'CHECKPOINT_CONFIGURATION_MISSING');

const activeInstances = await db.adaptiveCheckpointInstance.findMany({
  where: {
    projectId,
    cycleId: cycle.id,
  },
  select: { id: true },
});

const previousResponses = await db.adaptiveCheckpointResponse.findMany({
  where: {
    projectId,
    checkpointInstanceId: {
      in: activeInstances.map((item: any) => item.id),
    },
  },
  orderBy: { createdAt: 'asc' },
});

const sufficiency = this.evaluateCheckpoint(
  instance.checkpointKey,
  input.responses,
  previousResponses.map((r: any) => r.responseJson),
  stepConfiguration.sourceContextJson ?? {},
);
    if (!sufficiency.sufficient) {
      throw AppError.badRequest('El checkpoint aun no tiene informacion suficiente.', 'CHECKPOINT_INSUFFICIENT', {
        details: sufficiency.missing.map((field) => ({ field, code: 'MISSING_REQUIRED_FIELD', message: 'Completa o marca como pendiente este dato.' })),
      });
    }
    const readiness = await this.evaluateCheckpointReadiness(projectId, instance.checkpointKey, input);
    const responseJson = this.responseWithPolicyBindings(input.responses, input.truthBindings, input.evidenceBindings);

    await db.$transaction(async (tx: any) => {
      await tx.adaptiveCheckpointResponse.create({
        data: {
          projectId,
          checkpointInstanceId: instance.id,
          checkpointKey: instance.checkpointKey,
          responseJson,
          answeredById: userId,
          idempotencyKey: input.idempotencyKey,
        },
      });
      await tx.adaptiveCheckpointInstance.update({
        where: { id: instance.id },
        data: { status: 'completed', completedAt: new Date(), sufficiencyJson: { ...sufficiency, readiness } },
      });
      await this.recordEventTx(tx, projectId, 'checkpoint_completed', `${instance.checkpointKey} completado.`, { checkpointKey: instance.checkpointKey, sufficiency }, userId, input.idempotencyKey);

      const nextKey = this.nextCheckpointKey(instance.checkpointKey);
      if (nextKey === 'CP-2.5' && !this.shouldActivateReadiness(stepConfiguration.sourceContextJson ?? {}, input.responses)) {
        const allResponses = [...previousResponses.map((r: any) => r.responseJson), responseJson];
        const output = this.buildStep2Output(stepConfiguration.sourceContextJson, allResponses);
        await this.upsertStepOutputTx(tx, projectId, 2, stepConfiguration.id, output.outputKey, output as unknown as Record<string, unknown>, 'draft');
        await this.upsertProgressSignalTx(tx, projectId, {
          step: 2,
          checkpointCode: 'CP-2.4',
          checkpointTitle: 'Execution Design',
          health: 'ready_for_decision',
          hypothesis: output.hypothesis,
          evidence: output.evidenceUsed[0] ?? 'Evidencia transferida de Step 1.',
          evidenceStrength: output.evidenceUsed.length > 0 ? 'medium' : 'weak',
          blocker: output.risks[0] ?? '',
          actorRequired: output.responsibles[0] ?? 'Owner de iniciativa',
          nextAction: 'Revisar y confirmar el output de Step 2 antes de configurar Step 3.',
          upcomingDecision: output.goNoGoCriteria,
          updatedAt: new Date().toISOString(),
          selectedBet: output.selectedBet,
          readiness: output.readiness,
          contributionToChallenge: output.challengeContribution,
        });
        await this.recordEventTx(tx, projectId, 'actor_action_required', 'El owner debe confirmar el output de Step 2.', { step: 2, outputKey: output.outputKey, readinessSkipped: true }, userId, `step2-output-review-required:${projectId}:2`);
      } else if (nextKey === 'CP-3.5' && !this.shouldActivateOperationalReadiness(stepConfiguration.sourceContextJson ?? {}, [...previousResponses.map((r: any) => r.responseJson), input.responses])) {
        const allResponses = [...previousResponses.map((r: any) => r.responseJson), responseJson];
        const output = this.buildStep3Output(stepConfiguration.sourceContextJson, allResponses);
        await this.upsertStepOutputTx(tx, projectId, 3, stepConfiguration.id, output.outputKey, output as unknown as Record<string, unknown>, 'draft');
        await this.upsertProgressSignalTx(tx, projectId, {
          step: 3,
          checkpointCode: 'CP-3.4',
          checkpointTitle: 'Decision',
          health: output.decision.decision === 'pause' ? 'attention' : 'ready_for_decision',
          hypothesis: output.hypothesis,
          evidence: output.resultAnalysis.interpretation,
          evidenceStrength: output.resultAnalysis.evidenceStrength,
          blocker: output.executionReadiness.blockers[0] ?? '',
          actorRequired: output.decision.requiredApprover || output.decision.owner || output.executionReadiness.actorsRequired[0] || 'Owner de iniciativa',
          nextAction: 'Revisar y confirmar el output de Step 3 antes de configurar Step 4.',
          upcomingDecision: output.decision.nextAction,
          updatedAt: new Date().toISOString(),
          execution: output.executionSummary,
          readiness: output.executionReadiness,
          result: output.resultAnalysis.classification,
          preliminaryResult: output.resultAnalysis.interpretation,
          contradictingEvidenceRefs: output.resultAnalysis.contradictingEvidenceRefs,
          deviations: output.executionLog.deviations,
          contributionToChallenge: output.challengeContribution,
        });
        await this.recordEventTx(tx, projectId, 'actor_action_required', 'El owner debe confirmar el output de Step 3.', { step: 3, outputKey: output.outputKey, operationalReadinessSkipped: true }, userId, `step3-output-review-required:${projectId}:3`);
      } else if (nextKey) {
        await this.materializeCheckpointTx(tx, projectId, stepConfiguration, nextKey, [...previousResponses.map((r: any) => r.responseJson), responseJson], userId, `checkpoint_started:${projectId}:${nextKey}:${stepConfiguration.version}`);
        await this.updateSignalForCheckpointTx(tx, projectId, nextKey, input.responses, stepConfiguration.sourceContextJson);
      } else {
        const allResponses = [...previousResponses.map((r: any) => r.responseJson), responseJson];
        if (instance.stepNumber === 0) {
          const brief = this.buildStep0Brief(stepConfiguration.sourceContextJson, allResponses);
          await this.upsertStepOutputTx(tx, projectId, 0, stepConfiguration.id, 'Step0AlignmentBrief', brief as unknown as Record<string, unknown>, 'draft');
          await this.upsertProgressSignalTx(tx, projectId, {
            step: 0,
            checkpointCode: 'CP-0.3',
            checkpointTitle: 'Definir que validar o decidir',
            health: 'ready_for_decision',
            hypothesis: brief.priorityHypothesis,
            evidence: brief.availableEvidence[0] ?? 'Evidencia pendiente de confirmar.',
            evidenceStrength: brief.availableEvidence.length > 0 ? 'weak' : 'none',
            blocker: brief.missingInformation.length > 0 ? brief.missingInformation[0] : '',
            actorRequired: brief.actors[0] ?? 'Owner de iniciativa',
            nextAction: 'Revisar y confirmar el Alignment Brief de Step 0.',
            upcomingDecision: brief.decisionCriteria,
            updatedAt: new Date().toISOString(),
          });
          await this.recordEventTx(tx, projectId, 'actor_action_required', 'El owner debe confirmar el Alignment Brief.', { step: 0, outputKey: 'Step0AlignmentBrief' }, userId, `brief-review-required:${projectId}:0`);
        } else if (instance.stepNumber === 1) {
          const output = await this.buildStep1Output(projectId, stepConfiguration.sourceContextJson, allResponses, [
            ...previousResponses.map((r: any) => ({ checkpointKey: r.checkpointKey, responseJson: r.responseJson })),
            { checkpointKey: instance.checkpointKey, responseJson },
          ]);
          await this.upsertStepOutputTx(tx, projectId, 1, stepConfiguration.id, output.outputKey, output as unknown as Record<string, unknown>, 'draft');
          const supportedByTruth = output.truthReadiness?.satisfiesValidatedSupport === true;
          await this.upsertProgressSignalTx(tx, projectId, {
            step: 1,
            checkpointCode: 'CP-1.4',
            checkpointTitle: 'Sintetizar y decidir foco',
            health: supportedByTruth && output.sufficiency === 'sufficient' ? 'ready_for_decision' : 'attention',
            hypothesis: output.hypothesisForStep2,
            evidence: output.evidenceSummary,
            evidenceStrength: supportedByTruth ? 'medium' : 'weak',
            blocker: output.blocker,
            actorRequired: output.actorRequired,
            nextAction: 'Revisar y confirmar el output de Step 1 antes de configurar Step 2.',
            upcomingDecision: output.futureDecision,
            updatedAt: new Date().toISOString(),
            truthReadiness: output.truthReadiness,
          });
          await this.recordEventTx(tx, projectId, 'actor_action_required', 'El owner debe confirmar el output de Step 1.', { step: 1, outputKey: output.outputKey }, userId, `step1-output-review-required:${projectId}:1`);
        } else if (instance.stepNumber === 2) {
          const output = this.buildStep2Output(stepConfiguration.sourceContextJson, allResponses);
          await this.upsertStepOutputTx(tx, projectId, 2, stepConfiguration.id, output.outputKey, output as unknown as Record<string, unknown>, 'draft');
          await this.upsertProgressSignalTx(tx, projectId, {
            step: 2,
            checkpointCode: instance.checkpointKey,
            checkpointTitle: 'Readiness',
            health: output.readiness.status === 'blocked' ? 'blocked' : 'ready_for_decision',
            hypothesis: output.hypothesis,
            evidence: output.evidenceUsed[0] ?? 'Evidencia transferida de Step 1.',
            evidenceStrength: output.evidenceUsed.length > 0 ? 'medium' : 'weak',
            blocker: output.readiness.blockers[0] ?? output.risks[0] ?? '',
            actorRequired: output.readiness.actorRequired ?? output.responsibles[0] ?? 'Owner de iniciativa',
            nextAction: 'Revisar y confirmar el output de Step 2 antes de configurar Step 3.',
            upcomingDecision: output.goNoGoCriteria,
            updatedAt: new Date().toISOString(),
            selectedBet: output.selectedBet,
            readiness: output.readiness,
            contributionToChallenge: output.challengeContribution,
          });
          await this.recordEventTx(tx, projectId, 'actor_action_required', 'El owner debe confirmar el output de Step 2.', { step: 2, outputKey: output.outputKey }, userId, `step2-output-review-required:${projectId}:2`);
        } else if (instance.stepNumber === 3) {
          const output = this.buildStep3Output(stepConfiguration.sourceContextJson, allResponses);
          await this.upsertStepOutputTx(tx, projectId, 3, stepConfiguration.id, output.outputKey, output as unknown as Record<string, unknown>, 'draft');
          await this.upsertProgressSignalTx(tx, projectId, {
            step: 3,
            checkpointCode: instance.checkpointKey,
            checkpointTitle: 'Operational Readiness',
            health: output.operationalReadiness?.status === 'blocked' ? 'blocked' : 'ready_for_decision',
            hypothesis: output.hypothesis,
            evidence: output.resultAnalysis.interpretation,
            evidenceStrength: output.resultAnalysis.evidenceStrength,
            blocker: output.operationalReadiness?.blockers?.[0] ?? output.executionReadiness.blockers[0] ?? '',
            actorRequired: output.operationalReadiness?.requiredApprover ?? output.decision.requiredApprover ?? output.decision.owner ?? 'Owner de iniciativa',
            nextAction: 'Revisar y confirmar el output de Step 3 antes de configurar Step 4.',
            upcomingDecision: output.decision.nextAction,
            updatedAt: new Date().toISOString(),
            execution: output.executionSummary,
            readiness: output.executionReadiness,
            operationalReadiness: output.operationalReadiness,
            result: output.resultAnalysis.classification,
            preliminaryResult: output.resultAnalysis.interpretation,
            contradictingEvidenceRefs: output.resultAnalysis.contradictingEvidenceRefs,
            deviations: output.executionLog.deviations,
            contributionToChallenge: output.challengeContribution,
          });
          await this.recordEventTx(tx, projectId, 'actor_action_required', 'El owner debe confirmar el output de Step 3.', { step: 3, outputKey: output.outputKey }, userId, `step3-output-review-required:${projectId}:3`);
        } else {
          const output = this.buildStep4Output(stepConfiguration.sourceContextJson, allResponses);
          await this.upsertStepOutputTx(tx, projectId, 4, stepConfiguration.id, output.outputKey, output as unknown as Record<string, unknown>, 'draft');
          await this.upsertProgressSignalTx(tx, projectId, {
            step: 4,
            checkpointCode: instance.checkpointKey,
            checkpointTitle: 'Transferencia o cierre',
            health: output.transferOrClosure.blockers.length > 0 ? 'blocked' : 'ready_for_decision',
            hypothesis: output.hypothesis,
            evidence: output.recommendation,
            evidenceStrength: output.finalChallengeContribution.evidenceStrength,
            blocker: output.transferOrClosure.blockers[0] ?? '',
            actorRequired: output.transferOrClosure.owner || output.audienceBrief.decisionMaker || 'Owner de iniciativa',
            nextAction: 'Revisar y confirmar el output de Step 4 para cerrar organizacionalmente la iniciativa.',
            upcomingDecision: output.transferOrClosure.finalDecision,
            updatedAt: new Date().toISOString(),
            audience: output.audienceBrief,
            recommendation: output.recommendation,
            artifacts: output.decisionPackage.artifacts,
            handoffStatus: output.transferOrClosure.status,
            futureOwner: output.transferOrClosure.receiverOwner,
            finalState: output.finalState,
            organizationalDecision: output.organizationalDecision,
            contributionToChallenge: output.finalChallengeContribution,
            challengeCoverage: output.challengeCoverage,
          });
          await this.recordEventTx(tx, projectId, 'actor_action_required', 'El owner debe confirmar el output de Step 4.', { step: 4, outputKey: output.outputKey }, userId, `step4-output-review-required:${projectId}:4`);
        }
      }
    });
    return this.getState(projectId, userId, role);
  }

  async confirmStep0Brief(projectId: string, userId: string, role: Role, input: ConfirmBriefInput): Promise<AdaptiveCoreState> {
    await this.ensureInitialized(projectId, userId, role);
    if (!input.confirmed) throw AppError.badRequest('El Brief debe ser confirmado por el usuario.', 'BRIEF_CONFIRMATION_REQUIRED');
    const db = this.prisma as any;
    const cycle = await this.cycles.ensureActiveCycle(projectId);
    const existingEvent = await db.adaptiveAdaptationEvent.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existingEvent) return this.getState(projectId, userId, role);
    this.assertCycleMutable(cycle);

    const draft = await db.adaptiveStepOutput.findFirst({ where: { projectId, cycleId: cycle.id, stepNumber: 0, status: 'draft' }, orderBy: { version: 'desc' } });
    if (!draft) throw AppError.badRequest('No existe Alignment Brief para confirmar.', 'STEP0_BRIEF_NOT_READY');
    const step0Config = await db.adaptiveStepConfiguration.findFirst({ where: { projectId, cycleId: cycle.id, stepNumber: 0, status: 'active' }, orderBy: { version: 'desc' } });
    const masterContext = step0Config?.sourceContextJson ?? {};

    await db.$transaction(async (tx: any) => {
      await tx.adaptiveStepOutput.update({
        where: { id: draft.id },
        data: { status: 'confirmed', outputJson: input.brief, confirmedById: userId, confirmedAt: new Date() },
      });
      await this.cycles.syncActiveCycleProjectionTx(tx, projectId, cycle.id, 1, { step0Status: 'COMPLETED' });

      const step1Version = await this.nextConfigVersionTx(tx, projectId, cycle.id, 1);
      const step1ConfigJson = this.buildStepConfiguration(1, step1Version, masterContext, input.brief);
      const step1Config = await tx.adaptiveStepConfiguration.create({
        data: {
          projectId,
          cycleId: cycle.id,
          stepNumber: 1,
          version: step1Version,
          status: 'active',
          routeType: masterContext.routeType ?? 'explore_validate',
          depthLevel: masterContext.depthLevel ?? 'standard',
          maturity: masterContext.maturity ?? 'problem',
          configurationJson: step1ConfigJson,
          sourceContextJson: { ...masterContext, step0Output: input.brief },
        },
      });
      await this.materializeCheckpointTx(tx, projectId, step1Config, 'CP-1.1', [input.brief], userId, `checkpoint_started:${projectId}:CP-1.1:${step1Version}`);
      await this.upsertProgressSignalTx(tx, projectId, {
        step: 1,
        checkpointCode: 'CP-1.1',
        checkpointTitle: 'Priorizar que comprobar',
        health: 'healthy',
        hypothesis: String(input.brief.priorityHypothesis ?? 'Hipotesis prioritaria pendiente.'),
        evidence: Array.isArray(input.brief.availableEvidence) ? input.brief.availableEvidence[0] ?? 'Evidencia pendiente.' : 'Evidencia pendiente.',
        evidenceStrength: Array.isArray(input.brief.availableEvidence) && input.brief.availableEvidence.length > 0 ? 'weak' : 'none',
        blocker: '',
        actorRequired: Array.isArray(input.brief.actors) ? input.brief.actors[0] ?? 'Owner de iniciativa' : 'Owner de iniciativa',
        nextAction: 'Iniciar CP-1.1: priorizar que debe comprobarse.',
        upcomingDecision: String(input.brief.decisionCriteria ?? 'Definir continuidad hacia Step 2.'),
        updatedAt: new Date().toISOString(),
      });
      await this.recordEventTx(tx, projectId, 'step_completed', 'Step 0 confirmado por el usuario.', { step: 0, outputId: draft.id }, userId, input.idempotencyKey);
      await this.recordEventTx(tx, projectId, 'next_step_configured', 'Step 1 configurado desde el Alignment Brief confirmado.', { step: 1, version: step1Version }, userId, `next-step-configured:${projectId}:1:${step1Version}`);
    });
    await syncInitiativeProgress(this.prisma, projectId);
    return this.getState(projectId, userId, role);
  }

  async confirmStep1Output(projectId: string, userId: string, role: Role, input: ConfirmStep1OutputInput): Promise<AdaptiveCoreState> {
    await this.ensureInitialized(projectId, userId, role);
    if (!input.confirmed) throw AppError.badRequest('El output de Step 1 debe ser confirmado por el usuario.', 'STEP1_CONFIRMATION_REQUIRED');
    const db = this.prisma as any;
    const cycle = await this.cycles.ensureActiveCycle(projectId);
    const existingEvent = await db.adaptiveAdaptationEvent.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existingEvent) return this.getState(projectId, userId, role);
    this.assertCycleMutable(cycle);

    const draft = await db.adaptiveStepOutput.findFirst({ where: { projectId, cycleId: cycle.id, stepNumber: 1, status: 'draft' }, orderBy: { version: 'desc' } });
    if (!draft) throw AppError.badRequest('No existe output de Step 1 para confirmar.', 'STEP1_OUTPUT_NOT_READY');
    const step1Config = await db.adaptiveStepConfiguration.findFirst({ where: { projectId, cycleId: cycle.id, stepNumber: 1, status: 'active' }, orderBy: { version: 'desc' } });
    if (!step1Config) throw AppError.badRequest('No existe configuracion activa de Step 1.', 'STEP1_CONFIGURATION_MISSING');

    const draftOutput = draft.outputJson ?? {};
    const step1Output = {
      ...draftOutput,
      ...(input.brief ?? {}),
      truthReadiness: (draftOutput as any).truthReadiness ?? null,
      methodologicalSufficiency: (draftOutput as any).methodologicalSufficiency ?? (input.brief as any)?.methodologicalSufficiency,
      sufficiency: this.contractualStep1Sufficiency(draftOutput, input.brief),
    };
    const nextMasterContext = this.buildStep2MasterContext(step1Config.sourceContextJson ?? {}, step1Output);
    const supportedByTruth = step1Output.truthReadiness?.satisfiesValidatedSupport === true;

    await db.$transaction(async (tx: any) => {
      await tx.adaptiveStepOutput.update({
        where: { id: draft.id },
        data: { status: 'confirmed', outputJson: step1Output, confirmedById: userId, confirmedAt: new Date(), requiresReview: false },
      });
      await this.cycles.syncActiveCycleProjectionTx(tx, projectId, cycle.id, 2);

      const step2Version = await this.nextConfigVersionTx(tx, projectId, cycle.id, 2);
      const step2ConfigJson = this.buildStepConfiguration(2, step2Version, nextMasterContext, nextMasterContext.step0Output);
      const step2Config = await tx.adaptiveStepConfiguration.create({
        data: {
          projectId,
          cycleId: cycle.id,
          stepNumber: 2,
          version: step2Version,
          status: 'active',
          routeType: nextMasterContext.routeType ?? 'explore_validate',
          depthLevel: nextMasterContext.depthLevel ?? 'standard',
          maturity: nextMasterContext.maturity ?? 'problem',
          configurationJson: step2ConfigJson,
          sourceContextJson: nextMasterContext,
        },
      });
      await this.materializeCheckpointTx(tx, projectId, step2Config, 'CP-2.1', [step1Output], userId, `checkpoint_started:${projectId}:CP-2.1:${step2Version}`);
      await this.upsertProgressSignalTx(tx, projectId, {
        step: 2,
        checkpointCode: 'CP-2.1',
        checkpointTitle: STEP2_CHECKPOINTS[0].title,
        health: 'healthy',
        hypothesis: String(step1Output.hypothesisForStep2 ?? step1Output.updatedFocus ?? 'Hipotesis confirmada en Step 1.'),
        evidence: String(step1Output.evidenceSummary ?? 'Evidencia confirmada en Step 1.'),
        evidenceStrength: supportedByTruth ? 'medium' : 'weak',
        blocker: '',
        actorRequired: String(step1Output.actorRequired ?? 'Owner de iniciativa'),
        nextAction: 'Revisar transferencia de Step 1 y preparar el diseno de apuesta en Step 2.',
        upcomingDecision: String(step1Output.futureDecision ?? 'Definir apuesta inicial.'),
        updatedAt: new Date().toISOString(),
        validationFocus: step1Output.validationFocus,
        plannedEvidence: step1Output.evidencePlan,
        obtainedEvidence: step1Output.evidenceMap,
        sufficiency: step1Output.sufficiency,
        methodologicalSufficiency: step1Output.methodologicalSufficiency,
        truthReadiness: step1Output.truthReadiness,
        contradictions: step1Output.contradictions,
        contributionToChallenge: step1Output.challengeContribution,
      });
      await tx.initiativePortfolioMeta.updateMany({
        where: { projectId },
        data: { status: 'en_step_2' } as any,
      });
      await this.recordEventTx(tx, projectId, 'step_completed', 'Step 1 confirmado por el usuario.', { step: 1, outputId: draft.id }, userId, input.idempotencyKey);
      await this.recordEventTx(tx, projectId, 'next_step_configured', 'Step 2 configurado desde el output confirmado de Step 1.', { step: 2, version: step2Version, transferred: ['foco', 'hipotesis', 'evidencia', 'restricciones', 'criterios', 'baseline', 'actores', 'decision futura'] }, userId, `next-step-configured:${projectId}:2:${step2Version}`);
    });
    await syncInitiativeProgress(this.prisma, projectId);
    return this.getState(projectId, userId, role);
  }

  async confirmStep2Output(projectId: string, userId: string, role: Role, input: ConfirmStep2OutputInput): Promise<AdaptiveCoreState> {
    await this.ensureInitialized(projectId, userId, role);
    if (!input.confirmed) throw AppError.badRequest('El output de Step 2 debe ser confirmado por el usuario.', 'STEP2_CONFIRMATION_REQUIRED');
    const db = this.prisma as any;
    const cycle = await this.cycles.ensureActiveCycle(projectId);
    const existingEvent = await db.adaptiveAdaptationEvent.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existingEvent) return this.getState(projectId, userId, role);
    this.assertCycleMutable(cycle);

    const draft = await db.adaptiveStepOutput.findFirst({ where: { projectId, cycleId: cycle.id, stepNumber: 2, status: 'draft' }, orderBy: { version: 'desc' } });
    if (!draft) throw AppError.badRequest('No existe output de Step 2 para confirmar.', 'STEP2_OUTPUT_NOT_READY');
    const step2Config = await db.adaptiveStepConfiguration.findFirst({ where: { projectId, cycleId: cycle.id, stepNumber: 2, status: 'active' }, orderBy: { version: 'desc' } });
    if (!step2Config) throw AppError.badRequest('No existe configuracion activa de Step 2.', 'STEP2_CONFIGURATION_MISSING');

    const step2Output = { ...(draft.outputJson ?? {}), ...(input.brief ?? {}) };
    const selectedBetChanged = this.hasSelectedBetChanged(draft.outputJson ?? {}, input.brief ?? {});
    if (selectedBetChanged && !this.hasValue((input.brief as any).changeReason)) {
      throw AppError.badRequest('Registra la razon del cambio de apuesta antes de confirmar Step 2.', 'STEP2_BET_CHANGE_REASON_REQUIRED');
    }
    const nextMasterContext = this.buildStep3MasterContext(step2Config.sourceContextJson ?? {}, step2Output);

    await db.$transaction(async (tx: any) => {
      await tx.adaptiveStepOutput.update({
        where: { id: draft.id },
        data: { status: 'confirmed', outputJson: step2Output, confirmedById: userId, confirmedAt: new Date(), requiresReview: false },
      });
      await this.cycles.syncActiveCycleProjectionTx(tx, projectId, cycle.id, 3);

      const step3Version = await this.nextConfigVersionTx(tx, projectId, cycle.id, 3);
      const step3ConfigJson = this.buildStepConfiguration(3, step3Version, nextMasterContext, nextMasterContext.step0Output);
      const step3Config = await tx.adaptiveStepConfiguration.create({
        data: {
          projectId,
          cycleId: cycle.id,
          stepNumber: 3,
          version: step3Version,
          status: 'active',
          routeType: nextMasterContext.routeType ?? 'explore_validate',
          depthLevel: nextMasterContext.depthLevel ?? 'standard',
          maturity: nextMasterContext.maturity ?? 'solution_proposed',
          configurationJson: step3ConfigJson,
          sourceContextJson: nextMasterContext,
        },
      });
      await this.materializeCheckpointTx(tx, projectId, step3Config, 'CP-3.1', [step2Output], userId, `checkpoint_started:${projectId}:CP-3.1:${step3Version}`);
      await this.upsertProgressSignalTx(tx, projectId, {
        step: 3,
        checkpointCode: 'CP-3.1',
        checkpointTitle: STEP3_CHECKPOINTS[0].title,
        health: 'healthy',
        hypothesis: String(step2Output.hypothesis ?? step2Output.selectedBet?.hypothesis ?? 'Hipotesis confirmada en Step 2.'),
        evidence: Array.isArray(step2Output.evidenceUsed) ? step2Output.evidenceUsed[0] ?? 'Evidencia confirmada en Step 2.' : 'Evidencia confirmada en Step 2.',
        evidenceStrength: 'medium',
        blocker: '',
        actorRequired: Array.isArray(step2Output.responsibles) ? step2Output.responsibles[0] ?? 'Owner de iniciativa' : 'Owner de iniciativa',
        nextAction: 'Preparar ejecucion y medicion desde la apuesta confirmada.',
        upcomingDecision: String(step2Output.goNoGoCriteria ?? 'Decision Go/No-Go.'),
        updatedAt: new Date().toISOString(),
        selectedBet: step2Output.selectedBet,
        readiness: step2Output.readiness,
        contributionToChallenge: step2Output.challengeContribution,
      });
      await tx.initiativePortfolioMeta.updateMany({
        where: { projectId },
        data: { status: 'en_step_3' } as any,
      });
      await this.recordEventTx(tx, projectId, 'step_completed', 'Step 2 confirmado por el usuario.', { step: 2, outputId: draft.id, selectedBetChanged }, userId, input.idempotencyKey);
      await this.recordEventTx(tx, projectId, 'next_step_configured', 'Step 3 configurado desde el output confirmado de Step 2.', { step: 3, version: step3Version }, userId, `next-step-configured:${projectId}:3:${step3Version}`);
    });
    await syncInitiativeProgress(this.prisma, projectId);
    return this.getState(projectId, userId, role);
  }

  async confirmStep3Output(projectId: string, userId: string, role: Role, input: ConfirmStep3OutputInput): Promise<AdaptiveCoreState> {
    await this.ensureInitialized(projectId, userId, role);
    if (!input.confirmed) throw AppError.badRequest('El output de Step 3 debe ser confirmado por el usuario.', 'STEP3_CONFIRMATION_REQUIRED');
    const db = this.prisma as any;
    const cycle = await this.cycles.ensureActiveCycle(projectId);
    const existingEvent = await db.adaptiveAdaptationEvent.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existingEvent) return this.getState(projectId, userId, role);
    this.assertCycleMutable(cycle);

    const draft = await db.adaptiveStepOutput.findFirst({ where: { projectId, cycleId: cycle.id, stepNumber: 3, status: 'draft' }, orderBy: { version: 'desc' } });
    if (!draft) throw AppError.badRequest('No existe output de Step 3 para confirmar.', 'STEP3_OUTPUT_NOT_READY');
    const step3Config = await db.adaptiveStepConfiguration.findFirst({ where: { projectId, cycleId: cycle.id, stepNumber: 3, status: 'active' }, orderBy: { version: 'desc' } });
    if (!step3Config) throw AppError.badRequest('No existe configuracion activa de Step 3.', 'STEP3_CONFIGURATION_MISSING');

    const step3Output = { ...(draft.outputJson ?? {}), ...(input.brief ?? {}) };
    if (!this.hasValue((step3Output as any).decision?.decision ?? (step3Output as any).decision)) {
      throw AppError.badRequest('Step 3 requiere una decision confirmada antes de configurar Step 4.', 'STEP3_DECISION_REQUIRED');
    }
    const nextMasterContext = this.buildStep4MasterContext(step3Config.sourceContextJson ?? {}, step3Output);

    await db.$transaction(async (tx: any) => {
      await tx.adaptiveStepOutput.update({
        where: { id: draft.id },
        data: { status: 'confirmed', outputJson: step3Output, confirmedById: userId, confirmedAt: new Date(), requiresReview: false },
      });
      await this.cycles.syncActiveCycleProjectionTx(tx, projectId, cycle.id, 4);

      const step4Version = await this.nextConfigVersionTx(tx, projectId, cycle.id, 4);
      const step4ConfigJson = this.buildStepConfiguration(4, step4Version, nextMasterContext, nextMasterContext.step0Output);
      const step4Config = await tx.adaptiveStepConfiguration.create({
        data: {
          projectId,
          cycleId: cycle.id,
          stepNumber: 4,
          version: step4Version,
          status: 'active',
          routeType: nextMasterContext.routeType ?? 'explore_validate',
          depthLevel: nextMasterContext.depthLevel ?? 'standard',
          maturity: nextMasterContext.maturity ?? 'results_confirmed',
          configurationJson: step4ConfigJson,
          sourceContextJson: nextMasterContext,
        },
      });
      await this.materializeCheckpointTx(tx, projectId, step4Config, 'CP-4.1', [step3Output], userId, `checkpoint_started:${projectId}:CP-4.1:${step4Version}`);
      await this.upsertProgressSignalTx(tx, projectId, {
        step: 4,
        checkpointCode: 'CP-4.1',
        checkpointTitle: STEP4_CHECKPOINTS[0].title,
        health: 'healthy',
        hypothesis: String(step3Output.hypothesis ?? step3Output.decision?.rationale ?? 'Decision confirmada en Step 3.'),
        evidence: String(step3Output.resultAnalysis?.interpretation ?? 'Resultados confirmados en Step 3.'),
        evidenceStrength: String(step3Output.resultAnalysis?.evidenceStrength ?? 'medium'),
        blocker: '',
        actorRequired: String(step3Output.decision?.owner ?? step3Output.decision?.requiredApprover ?? 'Owner de iniciativa'),
        nextAction: 'Iniciar CP-4.1: configurar continuidad desde la decision confirmada.',
        upcomingDecision: String(step3Output.decision?.nextAction ?? 'Definir continuidad del aprendizaje.'),
        updatedAt: new Date().toISOString(),
        result: step3Output.resultAnalysis?.classification,
        decision: step3Output.decision,
        contributionToChallenge: step3Output.challengeContribution,
      });
      await tx.initiativePortfolioMeta.updateMany({
        where: { projectId },
        data: { status: 'en_step_4' } as any,
      });
      await this.recordEventTx(tx, projectId, 'step_completed', 'Step 3 confirmado por el usuario.', { step: 3, outputId: draft.id, decision: step3Output.decision }, userId, input.idempotencyKey);
      await this.recordEventTx(tx, projectId, 'next_step_configured', 'Step 4 configurado desde el output confirmado de Step 3.', { step: 4, version: step4Version }, userId, `next-step-configured:${projectId}:4:${step4Version}`);
    });
    await syncInitiativeProgress(this.prisma, projectId);
    return this.getState(projectId, userId, role);
  }

  async confirmStep4Output(projectId: string, userId: string, role: Role, input: ConfirmStep4OutputInput): Promise<AdaptiveCoreState> {
    await this.ensureInitialized(projectId, userId, role);
    if (!input.confirmed) throw AppError.badRequest('El output de Step 4 debe ser confirmado por el usuario.', 'STEP4_CONFIRMATION_REQUIRED');
    const db = this.prisma as any;
    const cycle = await this.cycles.ensureActiveCycle(projectId);
    const existingEvent = await db.adaptiveAdaptationEvent.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existingEvent) return this.getState(projectId, userId, role);
    this.assertCycleMutable(cycle);

    const draft = await db.adaptiveStepOutput.findFirst({ where: { projectId, cycleId: cycle.id, stepNumber: 4, status: 'draft' }, orderBy: { version: 'desc' } });
    if (!draft) throw AppError.badRequest('No existe output de Step 4 para confirmar.', 'STEP4_OUTPUT_NOT_READY');
    const step4Config = await db.adaptiveStepConfiguration.findFirst({ where: { projectId, cycleId: cycle.id, stepNumber: 4, status: 'active' }, orderBy: { version: 'desc' } });
    if (!step4Config) throw AppError.badRequest('No existe configuracion activa de Step 4.', 'STEP4_CONFIGURATION_MISSING');

    const project = await this.getAccessibleProject(projectId, userId, role);
    const alignment = await this.resolveInitiativeAlignment(project);
    const step4Output = { ...(draft.outputJson ?? {}), ...(input.brief ?? {}) };
    const routing = this.initiativeCompletion.routeCompletion({
      projectId,
      cycleId: cycle.id,
      methodologicalCompletion: true,
      alignment,
    });
    const finalState = routing.lifecycleProjection;
    const confirmedStep4Output = {
      ...step4Output,
      methodologicalCompletion: true,
      completionRoute: routing.route,
      lifecycleProjection: routing.lifecycleProjection,
      portfolioReviewRequired: routing.portfolioReviewRequired,
      initiativeCompleted: routing.initiativeCompleted,
    };
    const nextMasterContext = this.buildFinalMasterContext(step4Config.sourceContextJson ?? {}, confirmedStep4Output, finalState);

    await db.$transaction(async (tx: any) => {
      await tx.adaptiveStepOutput.update({
        where: { id: draft.id },
        data: { status: 'confirmed', outputJson: confirmedStep4Output, confirmedById: userId, confirmedAt: new Date(), requiresReview: false },
      });
      await tx.adaptiveStepConfiguration.update({
        where: { id: step4Config.id },
        data: {
          sourceContextJson: nextMasterContext,
          configurationJson: {
            ...(step4Config.configurationJson ?? {}),
            finalState,
            completionRoute: routing.route,
            portfolioReviewRequired: routing.portfolioReviewRequired,
            initiativeCompleted: routing.initiativeCompleted,
            finalOutputKey: confirmedStep4Output.outputKey,
            methodologicalCompletedAt: new Date().toISOString(),
          },
        },
      });
      await this.cycles.completeCycleTx(tx, projectId, cycle.id, 4);
      await tx.project.update({
        where: { id: projectId },
        data: { status: routing.initiativeCompleted ? 'COMPLETED' : 'IN_PROGRESS', lastModified: new Date() } as any,
      });
      await this.upsertProgressSignalTx(tx, projectId, {
        step: 4,
        checkpointCode: routing.route,
        checkpointTitle: routing.route === 'owner_completed' ? 'Iniciativa completada' : 'Presentada para revision de portafolio',
        health: routing.portfolioReviewRequired ? 'ready_for_decision' : 'healthy',
        hypothesis: String(step4Output.hypothesis ?? nextMasterContext.step3Output?.hypothesis ?? ''),
        evidence: String(step4Output.recommendation ?? step4Output.narrative?.recommendation ?? ''),
        evidenceStrength: String(step4Output.finalChallengeContribution?.evidenceStrength ?? step4Output.challengeCoverage?.evidenceStrength ?? 'medium'),
        blocker: '',
        actorRequired: String(step4Output.transferOrClosure?.owner ?? step4Output.audienceBrief?.decisionMaker ?? 'Owner de iniciativa'),
        nextAction: routing.portfolioReviewRequired
          ? 'Mantener la iniciativa visible para revision posterior de portafolio.'
          : 'Consultar el resumen y el historial cuando sea necesario.',
        upcomingDecision: routing.portfolioReviewRequired ? 'Revision posterior de Portfolio Lead.' : 'Sin revision de portafolio requerida.',
        updatedAt: new Date().toISOString(),
        audience: step4Output.audienceBrief,
        recommendation: step4Output.recommendation,
        artifacts: step4Output.decisionPackage?.artifacts ?? [],
        handoffStatus: step4Output.transferOrClosure?.status,
        futureOwner: step4Output.transferOrClosure?.receiverOwner,
        finalState,
        hypothesisResult: step4Output.hypothesisResult,
        completionRoute: routing.route,
        portfolioReviewRequired: routing.portfolioReviewRequired,
        initiativeCompleted: routing.initiativeCompleted,
        contributionToChallenge: step4Output.finalChallengeContribution,
        challengeCoverage: step4Output.challengeCoverage,
      });
      await tx.initiativePortfolioMeta.updateMany({
        where: { projectId },
        data: this.portfolioMetaCompletionUpdate(step4Output, routing) as any,
      });
      if (nextMasterContext.challengeSnapshot?.id && tx.challenge?.update) {
        await tx.challenge.update({
          where: { id: nextMasterContext.challengeSnapshot.id },
          data: { coverageStatus: this.prismaCoverageStatus(step4Output.challengeCoverage?.status), updatedAt: new Date() } as any,
        }).catch(() => null);
      }
      await this.recordEventTx(tx, projectId, 'step_completed', 'Step 4 confirmado por el usuario.', { step: 4, outputId: draft.id, completionRoute: routing.route }, userId, input.idempotencyKey);
      await this.recordEventTx(tx, projectId, routing.route === 'owner_completed' ? 'initiative_completed' : 'initiative_presented', routing.route === 'owner_completed' ? 'Iniciativa metodologicamente completada.' : 'Iniciativa presentada para revision posterior de portafolio.', { completionRouting: routing, challengeCoverage: step4Output.challengeCoverage }, userId, `initiative-completion:${projectId}:4:${draft.version}`);
    });
    await syncInitiativeProgress(this.prisma, projectId);
    return this.getState(projectId, userId, role);
  }

  async registerCriticalChange(projectId: string, userId: string, role: Role, input: CriticalChangeInput): Promise<AdaptiveCoreState> {
    await this.ensureInitialized(projectId, userId, role);
    const db = this.prisma as any;
    const cycle = await this.cycles.getOperationalCycle(projectId);
    const existing = await db.criticalChange.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) return this.getState(projectId, userId, role);

    if (input.action !== 'return_to_prior_direction' && input.basedOnCycleId) {
      throw AppError.badRequest('basedOnCycleId solo aplica para retomar una direccion anterior.', 'CRITICAL_CHANGE_BASED_ON_UNEXPECTED');
    }
    if (input.action === 'return_to_prior_direction') {
      if (!input.basedOnCycleId) {
        throw AppError.badRequest('Retomar una direccion anterior requiere basedOnCycleId.', 'CRITICAL_CHANGE_BASED_ON_REQUIRED');
      }
      if (input.reentryStep === undefined || input.reentryStep === null) {
        throw AppError.badRequest('Retomar una direccion anterior requiere reentryStep.', 'CRITICAL_CHANGE_REENTRY_MISSING');
      }
      await this.validateReturnBasedOnCycleTx(db, projectId, cycle, input.basedOnCycleId);
    }

    const changeScope = mapLegacyCriticalChangeField(input.field);
    const dependency = this.criticalChangeDependencies.resolve({ changeScope, field: input.field });
    const [stepStates, stepOutputs] = await Promise.all([
      db.cycleStepState.findMany({ where: { cycleId: cycle.id }, orderBy: { stepNumber: 'asc' } }),
      db.adaptiveStepOutput.findMany({ where: { projectId, cycleId: cycle.id }, orderBy: [{ stepNumber: 'asc' }, { version: 'desc' }] }),
    ]);
    const impact = this.criticalChangeImpact.resolve({
      change: {
        sourceCycleId: cycle.id,
        changeScope,
        field: input.field,
        previousValue: input.previousValue ?? null,
        nextValue: input.nextValue,
        reason: input.reason ?? null,
        requestedTransition: input.action === 'return_to_prior_direction' ? 'return_to_prior_direction' : null,
        basedOnCycleId: input.basedOnCycleId ?? null,
        requestedReentryStep: input.reentryStep ?? null,
      },
      sourceCycle: cycle,
      dependency,
      stepStates,
      stepOutputs,
    });
    const userOutcome = buildCriticalChangeUserOutcome(impact);

    await db.$transaction(async (tx: any) => {
      const criticalChange = await tx.criticalChange.create({
        data: {
          projectId,
          sourceCycleId: cycle.id,
          detectedAtStep: cycle.currentStep ?? 0,
          changeScope,
          field: input.field,
          status: 'assessment_ready',
          proposedById: userId,
          confirmedById: null,
          confirmedAt: null,
          resultingCycleId: null,
          basedOnCycleId: input.basedOnCycleId ?? null,
          appliedAt: null,
          proposedReentryStep: impact.reentryStep,
          confirmedReentryStep: null,
          idempotencyKey: input.idempotencyKey,
          previousValueJson: input.previousValue ?? null,
          nextValueJson: input.nextValue,
          impactJson: impact as any,
          reason: input.reason ?? null,
        },
      });
      await this.upsertProgressSignalTx(tx, projectId, {
        step: cycle.currentStep ?? 0,
        checkpointCode: 'critical-change-assessment',
        checkpointTitle: 'Evaluacion de cambio critico',
        health: impact.materialChange ? 'attention' : 'healthy',
        hypothesis: String(input.nextValue ?? ''),
        evidence: String(input.reason ?? 'Cambio critico evaluado.'),
        evidenceStrength: 'weak',
        blocker: '',
        actorRequired: 'Owner de iniciativa',
        nextAction: userOutcome.message,
        upcomingDecision: userOutcome.headline,
        updatedAt: new Date().toISOString(),
        criticalChangeId: criticalChange.id,
        criticalChangeImpact: impact,
        criticalChangeOutcome: userOutcome,
      });
      await this.recordEventTx(tx, projectId, 'critical_change_assessment_ready', 'Cambio critico evaluado; requiere decision humana antes de aplicar transicion.', {
        criticalChangeId: criticalChange.id,
        changeScope,
        field: input.field,
        dependency,
        impact,
        userOutcome,
        userActionConfirmedChange: input.confirmed,
        legacyAction: input.action,
        basedOnCycleId: input.basedOnCycleId ?? null,
      }, userId, `critical-change-provenance:${input.idempotencyKey}`);
    });
    return this.getState(projectId, userId, role);
  }

  async confirmCriticalChangeTransition(
    projectId: string,
    userId: string,
    role: Role,
    criticalChangeId: string,
    input: ConfirmCriticalChangeTransitionInput,
  ): Promise<AdaptiveCoreState> {
    this.assertTeamWorkAccess(await this.getAccessibleProject(projectId, userId, role), userId, role);
    const db = this.prisma as any;
    const criticalChange = await db.criticalChange.findUnique({ where: { id: criticalChangeId } });
    if (!criticalChange || criticalChange.projectId !== projectId) {
      throw AppError.notFound('Cambio critico', 'CRITICAL_CHANGE_NOT_FOUND');
    }
    if (criticalChange.status === 'applied') return this.getState(projectId, userId, role);
    if (!input.confirmed) {
      await this.recordEventTx(db, projectId, 'critical_change_transition_not_confirmed', 'Transicion evaluada sin confirmacion humana.', {
        criticalChangeId,
        sourceCycleId: criticalChange.sourceCycleId,
        transition: (criticalChange.impactJson as ChangeImpactResult | null)?.transition ?? null,
      }, userId, input.idempotencyKey);
      return this.getState(projectId, userId, role);
    }
    if (!['assessment_ready', 'confirmed'].includes(String(criticalChange.status))) {
      throw AppError.conflict('El cambio critico no esta listo para confirmar transicion.', 'CRITICAL_CHANGE_NOT_CONFIRMABLE');
    }

    const impact = this.parseCriticalChangeImpact(criticalChange.impactJson);
    if (impact.sourceCycleId !== criticalChange.sourceCycleId) {
      throw AppError.conflict('La evaluacion no corresponde al ciclo fuente del cambio.', 'CRITICAL_CHANGE_SOURCE_MISMATCH');
    }
    if (impact.transition === 'derived_initiative_recommended') {
      throw AppError.badRequest('Esta transicion no se aplica en R3-B.', 'CRITICAL_CHANGE_TRANSITION_UNSUPPORTED');
    }
    if (!['same_cycle', 'new_cycle', 'return_to_prior_direction'].includes(impact.transition)) {
      throw AppError.badRequest('La transicion evaluada no es aplicable.', 'CRITICAL_CHANGE_TRANSITION_INVALID');
    }
    if (impact.transition !== 'return_to_prior_direction' && input.basedOnCycleId) {
      throw AppError.badRequest('basedOnCycleId solo aplica para retomar una direccion anterior.', 'CRITICAL_CHANGE_BASED_ON_UNEXPECTED');
    }

    const reentryStep = this.resolveConfirmedReentryStep(impact, input.confirmedReentryStep);
    const basedOnCycleId = this.resolveConfirmedBasedOnCycleId(impact, criticalChange.basedOnCycleId, input.basedOnCycleId);
    const confirmedAt = new Date();
    const appliedAt = new Date();

    await db.$transaction(async (tx: any) => {
      await this.lockCriticalChangeTx(tx, criticalChangeId);
      const current = await tx.criticalChange.findUnique({ where: { id: criticalChangeId } });
      if (!current || current.projectId !== projectId) {
        throw AppError.notFound('Cambio critico', 'CRITICAL_CHANGE_NOT_FOUND');
      }
      if (current.status === 'applied') return;
      if (!['assessment_ready', 'confirmed'].includes(String(current.status))) {
        throw AppError.conflict('El cambio critico no esta listo para confirmar transicion.', 'CRITICAL_CHANGE_NOT_CONFIRMABLE');
      }

      const sourceCycle = await tx.initiativeCycle.findUnique({ where: { id: current.sourceCycleId } });
      if (!sourceCycle || sourceCycle.projectId !== projectId) {
        throw AppError.conflict('El ciclo fuente no pertenece a la iniciativa.', 'CRITICAL_CHANGE_SOURCE_CYCLE_INVALID');
      }
      const operationalCycle = await this.cycles.getOperationalCycle(projectId, tx);
      if (operationalCycle.id !== sourceCycle.id) {
        throw AppError.conflict('El ciclo fuente ya no es el ciclo operativo.', 'CRITICAL_CHANGE_SOURCE_NOT_OPERATIONAL');
      }

      await tx.criticalChange.update({
        where: { id: current.id },
        data: {
          status: 'confirmed',
          confirmedById: userId,
          confirmedAt,
          confirmedReentryStep: reentryStep,
          basedOnCycleId,
        },
      });
      await this.recordEventTx(tx, projectId, 'critical_change_transition_confirmed', 'Transicion de cambio critico confirmada por el usuario.', {
        criticalChangeId: current.id,
        sourceCycleId: sourceCycle.id,
        resultingCycleId: null,
        basedOnCycleId,
        transition: impact.transition,
        reentryStep,
      }, userId, `critical-change-transition-confirmed:${input.idempotencyKey}`);

      const resultingCycle = impact.transition === 'new_cycle'
        ? await this.applyCriticalChangeNewCycleTx(tx, projectId, userId, current, sourceCycle, impact, reentryStep, appliedAt)
        : impact.transition === 'return_to_prior_direction'
          ? await this.applyCriticalChangeReturnToPriorDirectionTx(tx, projectId, userId, current, sourceCycle, impact, reentryStep, basedOnCycleId, appliedAt)
          : await this.applyCriticalChangeSameCycleTx(tx, projectId, current, sourceCycle, impact, reentryStep, appliedAt);

      await tx.criticalChange.update({
        where: { id: current.id },
        data: {
          status: 'applied',
          confirmedById: userId,
          confirmedAt,
          confirmedReentryStep: reentryStep,
          resultingCycleId: resultingCycle?.id ?? null,
          basedOnCycleId,
          appliedAt,
        },
      });
      await this.recordEventTx(tx, projectId, 'critical_change_applied', 'Transicion de cambio critico aplicada.', {
        criticalChangeId: current.id,
        sourceCycleId: sourceCycle.id,
        resultingCycleId: resultingCycle?.id ?? null,
        basedOnCycleId,
        transition: impact.transition,
        reentryStep,
      }, userId, `critical-change-applied:${input.idempotencyKey}`);
    });

    return this.getState(projectId, userId, role);
  }

  private async resolveDecisionAuthority(project: any, cycle: any, userId: string, decisionType: DecisionType, client?: any, authorityPurpose?: 'methodological_decision' | 'portfolio_review'): Promise<DecisionAuthorityResult> {
    const db = client ?? this.prisma as any;
    const governance = await db.initiativeGovernance.findUnique({ where: { projectId: project.id } });
    const ownerId = project.ownerId ?? null;
    const portfolioLeadUserId = governance?.portfolioLeadUserId ?? null;
    return this.decisionAuthority.evaluate({
      projectId: project.id,
      cycleId: cycle.id,
      decisionType,
      authorityPurpose,
      governanceMode: governance?.mode ?? null,
      initiativeOwnerId: ownerId,
      portfolioLeadUserId,
      currentUserId: userId,
      currentUserIsInitiativeOwner: ownerId === userId,
      currentUserIsAssignedPortfolioLead: Boolean(portfolioLeadUserId && portfolioLeadUserId === userId),
      currentUserIsActiveTeamMember: (project.teamMembers ?? []).some((member: any) => member.userId === userId && (member.status === 'ACTIVE' || member.status === 'active')),
      hasExplicitGovernanceConfig: Boolean(governance),
    });
  }

  private async buildDecisionReadinessSnapshot(project: any, cycle: any, client?: any) {
    const decisionTypes: DecisionType[] = ['continue_experimenting', 'implement', 'scale', 'pause', 'close_with_learning'];
    const assessments = [];
    for (const decisionType of decisionTypes) {
      const input = await this.loadDecisionReadinessInput(project, cycle, decisionType, client);
      assessments.push(this.decisionReadiness.evaluate(input));
    }
    return {
      assessmentVersion: 1,
      assessments,
      capturedAt: new Date().toISOString(),
    };
  }

  private async assertDecisionRequestNotStaleTx(tx: any, project: any, request: any, sourceCycle: any) {
    if (sourceCycle.status !== 'completed' || !sourceCycle.completedAt) {
      throw AppError.conflict('La DecisionRequest ya no apunta a una presentacion completada vigente.', 'DECISION_REQUEST_STALE');
    }
    const newerCycle = await tx.initiativeCycle.findFirst({
      where: { projectId: project.id, cycleNumber: { gt: sourceCycle.cycleNumber } },
      orderBy: { cycleNumber: 'desc' },
    });
    if (newerCycle) {
      throw AppError.conflict('Existe un ciclo metodologico posterior a esta solicitud.', 'DECISION_REQUEST_STALE');
    }
    const activeCycle = await tx.initiativeCycle.findFirst({ where: { projectId: project.id, status: 'active' } });
    if (activeCycle) {
      throw AppError.conflict('La iniciativa reentro a trabajo metodologico activo.', 'DECISION_REQUEST_STALE');
    }
    const alignment = await this.resolveInitiativeAlignment(project, tx);
    const methodologicalCompletion = await this.hasMethodologicalCompletion(project.id, sourceCycle.id, tx);
    const routing = this.initiativeCompletion.routeCompletion({
      projectId: project.id,
      cycleId: sourceCycle.id,
      methodologicalCompletion,
      alignment,
    });
    if (routing.route !== 'portfolio_presented' || !routing.portfolioReviewRequired) {
      throw AppError.conflict('La presentacion de portafolio ya no coincide con la solicitud.', 'DECISION_REQUEST_STALE');
    }
    const presentation = this.recordFrom(request.presentationSnapshotJson);
    const requestCycle = this.recordFrom(presentation.sourceCycle);
    if (requestCycle.id && requestCycle.id !== sourceCycle.id) {
      throw AppError.conflict('La solicitud no coincide con su ciclo fuente presentado.', 'DECISION_REQUEST_STALE');
    }
  }

  private validateDecisionReadinessForDecision(readiness: DecisionReadinessAssessment, input: OrganizationalDecisionInput) {
    if (readiness.overallStatus === 'not_ready') {
      throw AppError.conflict('El resultado seleccionado no esta listo para decision normal.', 'DECISION_READINESS_NOT_READY');
    }
    if (readiness.overallStatus === 'ready') return [];
    const requiredCodes = readiness.conditions.map((condition) => condition.code);
    const accepted = new Set(input.acceptedConditionCodes ?? []);
    const missing = requiredCodes.filter((code) => !accepted.has(code));
    if (missing.length > 0) {
      throw AppError.conflict('La decision condicional requiere aceptar condiciones explicitas.', 'DECISION_CONDITIONS_REQUIRED', {
        details: missing.map((code) => ({ field: 'acceptedConditionCodes', code, message: `Falta aceptar condicion ${code}.` })),
      });
    }
    return readiness.conditions.map((condition) => ({
      code: condition.code,
      dimension: condition.dimension,
      message: condition.message,
      accepted: true,
    }));
  }

  private buildDecisionRequestRecommendationSnapshot(step4OutputJson: unknown, readinessSnapshot: unknown) {
    const output = this.recordFrom(step4OutputJson);
    return {
      recommendation: output.recommendation ?? output.narrative?.recommendation ?? null,
      requestedDecision: output.audienceBrief?.requestedDecision ?? output.transferOrClosure?.finalDecision ?? null,
      readinessSummary: readinessSnapshot,
    };
  }

  private recommendedOutcomeFromSnapshot(snapshot: unknown): DecisionOutcome | null {
    const record = this.recordFrom(snapshot);
    const value = String(record.recommendedOutcome ?? record.requestedDecision ?? '').trim();
    return this.toDecisionOutcome(value);
  }

  private toDecisionOutcome(value: string): DecisionOutcome | null {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'continue_experimenting' || normalized === 'implement' || normalized === 'scale' || normalized === 'pause' || normalized === 'close_with_learning') {
      return normalized;
    }
    return null;
  }

  private routeTypeForDecision(outcome: DecisionOutcome): ContinuationRouteType {
    if (outcome === 'continue_experimenting') return 'new_cycle';
    if (outcome === 'implement') return 'implementation_handoff';
    if (outcome === 'scale') return 'scaling_handoff';
    if (outcome === 'pause') return 'paused';
    return 'closed';
  }

  private async assertDecisionEffectsSourceValidTx(tx: any, projectId: string, decision: any) {
    const request = await tx.decisionRequest.findFirst({ where: { id: decision.decisionRequestId, projectId } });
    if (!request || request.status !== 'resolved') {
      throw AppError.conflict('La decision no proviene de una solicitud resuelta valida.', 'DECISION_REQUEST_NOT_RESOLVED');
    }
    if (request.sourceCycleId !== decision.sourceCycleId) {
      throw AppError.conflict('La decision no coincide con el ciclo fuente de la solicitud.', 'DECISION_SOURCE_CYCLE_INVALID');
    }
    const sourceCycle = await tx.initiativeCycle.findUnique({ where: { id: decision.sourceCycleId } });
    if (!sourceCycle || sourceCycle.projectId !== projectId || sourceCycle.status !== 'completed' || !sourceCycle.completedAt) {
      throw AppError.conflict('La decision no apunta a un ciclo fuente completado valido.', 'DECISION_SOURCE_CYCLE_INVALID');
    }
  }

  private async applyContinueExperimentingEffectTx(tx: any, projectId: string, decision: any, idempotencyKey: string) {
    const sourceCycle = await tx.initiativeCycle.findUnique({ where: { id: decision.sourceCycleId } });
    if (!sourceCycle || sourceCycle.projectId !== projectId || sourceCycle.status !== 'completed') {
      throw AppError.conflict('La decision no apunta a un ciclo fuente completado valido.', 'DECISION_SOURCE_CYCLE_INVALID');
    }
    const existingNewer = await tx.initiativeCycle.findFirst({
      where: { projectId, cycleNumber: { gt: sourceCycle.cycleNumber } },
      orderBy: { cycleNumber: 'desc' },
    }).catch(() => null);
    if (existingNewer) {
      throw AppError.conflict('La iniciativa ya continuo despues de esta decision.', 'DECISION_EFFECTS_ALREADY_ADVANCED');
    }
    const reentryStep = this.resolveDecisionReentryStep(decision);
    const maxCycle = await tx.initiativeCycle.findFirst({ where: { projectId }, orderBy: { cycleNumber: 'desc' } });
    const nextCycle = await tx.initiativeCycle.create({
      data: {
        projectId,
        cycleNumber: (maxCycle?.cycleNumber ?? sourceCycle.cycleNumber ?? 0) + 1,
        parentCycleId: sourceCycle.id,
        basedOnCycleId: null,
        triggerType: 'decision',
        triggerRefId: decision.id,
        startStep: reentryStep,
        currentStep: reentryStep,
        status: 'active',
      },
    });
    await this.createDecisionReentryStepStatesTx(tx, sourceCycle.id, nextCycle.id, reentryStep);
    const fallbackConfig = await this.findFallbackConfigurationTx(tx, projectId, sourceCycle.id, reentryStep);
    const version = await this.nextConfigVersionTx(tx, projectId, nextCycle.id, reentryStep);
    const sourceContext = {
      ...(fallbackConfig?.sourceContextJson ?? {}),
      decisionReentry: {
        decisionId: decision.id,
        sourceCycleId: sourceCycle.id,
        outcome: decision.outcome,
        reentryStep,
        rationale: decision.rationale,
      },
    };
    const configurationJson = this.buildStepConfiguration(reentryStep, version, sourceContext, sourceContext);
    const nextConfig = await tx.adaptiveStepConfiguration.create({
      data: {
        projectId,
        cycleId: nextCycle.id,
        stepNumber: reentryStep,
        version,
        status: 'active',
        routeType: sourceContext.routeType ?? fallbackConfig?.routeType ?? 'explore_validate',
        depthLevel: sourceContext.depthLevel ?? fallbackConfig?.depthLevel ?? 'standard',
        configurationJson,
        sourceContextJson: sourceContext,
      },
    });
    await this.materializeCheckpointTx(tx, projectId, nextConfig, this.firstCheckpointForStep(reentryStep), [], decision.decidedById, `decision-reentry-checkpoint:${decision.id}:${nextCycle.id}:${reentryStep}`);
    await tx.project.update({
      where: { id: projectId },
      data: { status: 'IN_PROGRESS', currentStep: reentryStep, lastModified: new Date() },
    });
    await tx.initiativePortfolioMeta.updateMany({
      where: { projectId },
      data: { status: `en_step_${reentryStep}`, currentStep: `Step ${reentryStep}`, readyForDecision: false } as any,
    });
    await this.upsertProgressSignalTx(tx, projectId, {
      step: reentryStep,
      checkpointCode: this.firstCheckpointForStep(reentryStep),
      checkpointTitle: `Reentrada Step ${reentryStep}`,
      health: 'healthy',
      hypothesis: 'Nueva iteracion autorizada por Decision.',
      evidence: 'Se conserva la evidencia historica como referencia; no se copia output.',
      blocker: '',
      actorRequired: 'Owner de iniciativa',
      nextAction: `Continuar la iniciativa desde Step ${reentryStep}.`,
      upcomingDecision: 'Completar la nueva iteracion metodologica.',
      updatedAt: new Date().toISOString(),
    });
    const route = await tx.continuationRoute.create({
      data: {
        projectId,
        decisionId: decision.id,
        routeType: 'new_cycle',
        resultingCycleId: nextCycle.id,
        idempotencyKey,
      },
    });
    await this.recordEventTx(tx, projectId, 'decision_effects_applied', 'Efectos de decision aplicados: nueva iteracion.', {
      decisionId: decision.id,
      routeType: 'new_cycle',
      resultingCycleId: nextCycle.id,
      reentryStep,
    }, decision.decidedById, `decision-effects-applied:${decision.id}`);
    await this.recordEventTx(tx, projectId, 'initiative_reentered', 'La iniciativa continua en un nuevo ciclo.', {
      decisionId: decision.id,
      sourceCycleId: sourceCycle.id,
      resultingCycleId: nextCycle.id,
      reentryStep,
    }, decision.decidedById, `initiative-reentered:${decision.id}`);
    return route;
  }

  private async applyImplementationHandoffEffectTx(tx: any, projectId: string, decision: any, idempotencyKey: string) {
    const packageSnapshot = this.recordFrom(decision.packageSnapshotJson);
    const handoff = await tx.implementationHandoff.create({
      data: {
        projectId,
        decisionId: decision.id,
        approvedScopeJson: packageSnapshot.decisionPackage ?? packageSnapshot.package ?? packageSnapshot,
        conditionsJson: decision.conditionsJson ?? null,
        metricsJson: this.extractMetricsSnapshot(decision),
        evidenceSnapshotJson: this.extractEvidenceSnapshot(decision),
        risksJson: this.extractRisksSnapshot(decision),
      },
    });
    await this.updateDecisionLifecycleProjectionTx(tx, projectId, 'IMPLEMENTATION_APPROVED', 'implementation_approved', 'Implementation approved');
    const route = await tx.continuationRoute.create({
      data: { projectId, decisionId: decision.id, routeType: 'implementation_handoff', handoffId: handoff.id, idempotencyKey },
    });
    await this.recordEventTx(tx, projectId, 'decision_effects_applied', 'Efectos de decision aplicados: handoff de implementacion.', { decisionId: decision.id, routeType: 'implementation_handoff', handoffId: handoff.id }, decision.decidedById, `decision-effects-applied:${decision.id}`);
    await this.recordEventTx(tx, projectId, 'implementation_handoff_created', 'Handoff liviano de implementacion creado.', { decisionId: decision.id, handoffId: handoff.id }, decision.decidedById, `implementation-handoff-created:${decision.id}`);
    return route;
  }

  private async applyScalingHandoffEffectTx(tx: any, projectId: string, decision: any, idempotencyKey: string) {
    const packageSnapshot = this.recordFrom(decision.packageSnapshotJson);
    const handoff = await tx.scalingHandoff.create({
      data: {
        projectId,
        decisionId: decision.id,
        validatedScopeJson: packageSnapshot.validatedScope ?? packageSnapshot.decisionPackage ?? packageSnapshot,
        scaleConditionsJson: decision.conditionsJson ?? null,
        impactSnapshotJson: this.extractImpactSnapshot(decision),
        dependenciesJson: packageSnapshot.dependencies ?? [],
        risksJson: this.extractRisksSnapshot(decision),
        unvalidatedSegmentsJson: packageSnapshot.unvalidatedSegments ?? { note: 'Scale requiere distinguir validacion real de extrapolacion.' },
      },
    });
    await this.updateDecisionLifecycleProjectionTx(tx, projectId, 'SCALING_APPROVED', 'scaling_approved', 'Scaling approved');
    const route = await tx.continuationRoute.create({
      data: { projectId, decisionId: decision.id, routeType: 'scaling_handoff', handoffId: handoff.id, idempotencyKey },
    });
    await this.recordEventTx(tx, projectId, 'decision_effects_applied', 'Efectos de decision aplicados: handoff de escalamiento.', { decisionId: decision.id, routeType: 'scaling_handoff', handoffId: handoff.id }, decision.decidedById, `decision-effects-applied:${decision.id}`);
    await this.recordEventTx(tx, projectId, 'scaling_handoff_created', 'Handoff liviano de escalamiento creado.', { decisionId: decision.id, handoffId: handoff.id }, decision.decidedById, `scaling-handoff-created:${decision.id}`);
    return route;
  }

  private async applyPauseEffectTx(tx: any, projectId: string, decision: any, idempotencyKey: string) {
    await this.updateDecisionLifecycleProjectionTx(tx, projectId, 'PAUSED', 'paused', 'Paused');
    const route = await tx.continuationRoute.create({
      data: {
        projectId,
        decisionId: decision.id,
        routeType: 'paused',
        idempotencyKey,
        handoffId: null,
      },
    });
    await this.recordEventTx(tx, projectId, 'decision_effects_applied', 'Efectos de decision aplicados: iniciativa pausada.', { decisionId: decision.id, routeType: 'paused', reason: decision.rationale, conditions: decision.conditionsJson ?? null }, decision.decidedById, `decision-effects-applied:${decision.id}`);
    await this.recordEventTx(tx, projectId, 'initiative_paused', 'La iniciativa quedo pausada sin borrar historial.', { decisionId: decision.id, pausedAt: route.appliedAt }, decision.decidedById, `initiative-paused:${decision.id}`);
    return route;
  }

  private async applyCloseWithLearningEffectTx(tx: any, projectId: string, decision: any, idempotencyKey: string) {
    const closure = await tx.closureSummary.create({
      data: {
        projectId,
        decisionId: decision.id,
        closureReason: decision.rationale,
        learningSummaryJson: this.extractLearningSnapshot(decision),
        validatedClaimsJson: this.extractValidatedClaimsSnapshot(decision),
        evidenceReferencesJson: this.extractEvidenceSnapshot(decision),
        reusableLearningJson: this.extractReusableLearningSnapshot(decision),
        futureConsiderationsJson: this.recordFrom(decision.presentationSnapshotJson).futureConsiderations ?? [],
      },
    });
    await this.updateDecisionLifecycleProjectionTx(tx, projectId, 'CLOSED', 'closed', 'Closed');
    const route = await tx.continuationRoute.create({
      data: { projectId, decisionId: decision.id, routeType: 'closed', handoffId: closure.id, idempotencyKey },
    });
    await this.recordEventTx(tx, projectId, 'decision_effects_applied', 'Efectos de decision aplicados: cierre con aprendizaje.', { decisionId: decision.id, routeType: 'closed', closureSummaryId: closure.id }, decision.decidedById, `decision-effects-applied:${decision.id}`);
    await this.recordEventTx(tx, projectId, 'initiative_closed', 'La iniciativa se cerro preservando aprendizaje e historial.', { decisionId: decision.id, closureSummaryId: closure.id }, decision.decidedById, `initiative-closed:${decision.id}`);
    return route;
  }

  private async updateDecisionLifecycleProjectionTx(tx: any, projectId: string, projectStatus: string, portfolioStatus: string, portfolioStep: string) {
    await tx.project.update({
      where: { id: projectId },
      data: { status: projectStatus, lastModified: new Date() } as any,
    });
    await tx.initiativePortfolioMeta.updateMany({
      where: { projectId },
      data: { status: portfolioStatus, currentStep: portfolioStep, readyForDecision: false } as any,
    });
  }

  private async createDecisionReentryStepStatesTx(tx: any, sourceCycleId: string, nextCycleId: string, reentryStep: StepNumber) {
    for (const stepNumber of [0, 1, 2, 3, 4] as StepNumber[]) {
      const confirmedOutput = await tx.adaptiveStepOutput.findFirst({
        where: { cycleId: sourceCycleId, stepNumber, status: 'confirmed' },
        orderBy: { version: 'desc' },
      }).catch(() => null);
      const state = stepNumber < reentryStep && confirmedOutput
        ? 'inherited'
        : stepNumber === reentryStep
          ? 'active'
          : 'pending';
      await tx.cycleStepState.create({
        data: {
          cycleId: nextCycleId,
          stepNumber,
          state,
          inheritedFromCycleId: state === 'inherited' ? sourceCycleId : null,
          inheritedFromOutputId: state === 'inherited' ? confirmedOutput?.id ?? null : null,
        },
      });
    }
  }

  private async findFallbackConfigurationTx(tx: any, projectId: string, sourceCycleId: string, reentryStep: StepNumber) {
    return tx.adaptiveStepConfiguration.findFirst({
      where: { projectId, cycleId: sourceCycleId, stepNumber: reentryStep },
      orderBy: { version: 'desc' },
    }).catch(() => null);
  }

  private resolveDecisionReentryStep(decision: any): StepNumber {
    const readiness = this.recordFrom(decision.readinessSnapshotJson);
    const issues = [
      ...(Array.isArray(readiness.hardBlockers) ? readiness.hardBlockers : []),
      ...(Array.isArray(readiness.conditions) ? readiness.conditions : []),
      ...(Array.isArray(readiness.unresolvedQuestions) ? readiness.unresolvedQuestions : []),
    ];
    const mapped = issues
      .map((issue: any) => this.stepForReadinessDimension(String(issue?.dimension ?? '')))
      .filter((step): step is StepNumber => step != null);
    if (mapped.length > 0) return Math.min(...mapped) as StepNumber;
    return 3;
  }

  private stepForReadinessDimension(dimension: string): StepNumber | null {
    if (dimension === 'evidence' || dimension === 'impact') return 2;
    if (dimension === 'execution' || dimension === 'risk') return 3;
    if (dimension === 'governance') return 4;
    return null;
  }

  private extractMetricsSnapshot(decision: any) {
    const packageSnapshot = this.recordFrom(decision.packageSnapshotJson);
    const presentation = this.recordFrom(decision.presentationSnapshotJson);
    return packageSnapshot.metrics ?? presentation.metrics ?? packageSnapshot.successMetrics ?? null;
  }

  private extractEvidenceSnapshot(decision: any) {
    const packageSnapshot = this.recordFrom(decision.packageSnapshotJson);
    const presentation = this.recordFrom(decision.presentationSnapshotJson);
    return packageSnapshot.evidenceReferences ?? presentation.evidence ?? presentation.evidenceReferences ?? null;
  }

  private extractRisksSnapshot(decision: any) {
    const packageSnapshot = this.recordFrom(decision.packageSnapshotJson);
    const presentation = this.recordFrom(decision.presentationSnapshotJson);
    return packageSnapshot.risks ?? presentation.risks ?? null;
  }

  private extractImpactSnapshot(decision: any) {
    const readiness = this.recordFrom(decision.readinessSnapshotJson);
    const packageSnapshot = this.recordFrom(decision.packageSnapshotJson);
    return packageSnapshot.impact ?? readiness.dimensions?.impact ?? null;
  }

  private extractLearningSnapshot(decision: any) {
    const presentation = this.recordFrom(decision.presentationSnapshotJson);
    const packageSnapshot = this.recordFrom(decision.packageSnapshotJson);
    return presentation.learning ?? presentation.step4Output ?? packageSnapshot.learning ?? packageSnapshot;
  }

  private extractValidatedClaimsSnapshot(decision: any) {
    const presentation = this.recordFrom(decision.presentationSnapshotJson);
    return presentation.validatedClaims ?? presentation.truthClaims ?? null;
  }

  private extractReusableLearningSnapshot(decision: any) {
    const presentation = this.recordFrom(decision.presentationSnapshotJson);
    const packageSnapshot = this.recordFrom(decision.packageSnapshotJson);
    return presentation.reusableLearning ?? packageSnapshot.reusableLearning ?? null;
  }

  private async buildDecisionEffectsResult(db: any, projectId: string, decisionId: string, route: any): Promise<DecisionEffectsResult> {
    const decision = await db.decision.findFirst({ where: { id: decisionId, projectId } });
    if (!decision) throw AppError.notFound('Decision', 'DECISION_NOT_FOUND');
    const [implementationHandoff, scalingHandoff, closureSummary] = await Promise.all([
      db.implementationHandoff?.findFirst ? db.implementationHandoff.findFirst({ where: { decisionId } }) : null,
      db.scalingHandoff?.findFirst ? db.scalingHandoff.findFirst({ where: { decisionId } }) : null,
      db.closureSummary?.findFirst ? db.closureSummary.findFirst({ where: { decisionId } }) : null,
    ]);
    return {
      decision: this.mapDecision(decision),
      route: this.mapContinuationRoute(route),
      lifecycleProjection: this.lifecycleProjectionForRoute(route.routeType),
      resultingCycleId: route.resultingCycleId ?? null,
      handoff: implementationHandoff ?? scalingHandoff ?? null,
      closureSummary: closureSummary ?? null,
    };
  }

  private lifecycleProjectionForRoute(routeType: ContinuationRouteType | string) {
    if (routeType === 'new_cycle') return 'active';
    if (routeType === 'implementation_handoff') return 'implementation_approved';
    if (routeType === 'scaling_handoff') return 'scaling_approved';
    if (routeType === 'paused') return 'paused';
    return 'closed';
  }

  private mapDecisionRequest(row: any): DecisionRequestResult {
    return {
      id: row.id,
      projectId: row.projectId,
      sourceCycleId: row.sourceCycleId,
      requestedById: row.requestedById,
      requestedAt: row.requestedAt,
      status: row.status,
      authorityType: row.authorityType,
      authorityUserId: row.authorityUserId ?? null,
      readinessSnapshotJson: row.readinessSnapshotJson,
      authoritySnapshotJson: row.authoritySnapshotJson,
      decisionPackageSnapshotJson: row.decisionPackageSnapshotJson,
      recommendationSnapshotJson: row.recommendationSnapshotJson ?? null,
      presentationSnapshotJson: row.presentationSnapshotJson ?? null,
      requestVersion: row.requestVersion,
      idempotencyKey: row.idempotencyKey,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapDecision(row: any): DecisionResult {
    return {
      id: row.id,
      projectId: row.projectId,
      sourceCycleId: row.sourceCycleId,
      decisionRequestId: row.decisionRequestId,
      outcome: row.outcome,
      decidedById: row.decidedById,
      decidedAt: row.decidedAt,
      rationale: row.rationale,
      conditionsJson: row.conditionsJson ?? null,
      authoritySnapshotJson: row.authoritySnapshotJson,
      readinessSnapshotJson: row.readinessSnapshotJson,
      recommendationSnapshotJson: row.recommendationSnapshotJson ?? null,
      packageSnapshotJson: row.packageSnapshotJson,
      presentationSnapshotJson: row.presentationSnapshotJson,
      idempotencyKey: row.idempotencyKey,
      createdAt: row.createdAt,
    };
  }

  private mapContinuationRoute(row: any): ContinuationRouteResult {
    return {
      id: row.id,
      projectId: row.projectId,
      decisionId: row.decisionId,
      routeType: row.routeType,
      resultingCycleId: row.resultingCycleId ?? null,
      handoffId: row.handoffId ?? null,
      appliedAt: row.appliedAt,
      idempotencyKey: row.idempotencyKey ?? null,
      createdAt: row.createdAt,
    };
  }

  private async getOperationalCycleReadOnly(projectId: string, client?: any) {
    const db = client ?? this.prisma as any;
    const active = await db.initiativeCycle.findFirst({
      where: { projectId, status: 'active' },
      orderBy: { cycleNumber: 'desc' },
    });
    if (active) return active;
    const latest = await db.initiativeCycle.findFirst({
      where: { projectId },
      orderBy: { cycleNumber: 'desc' },
    });
    if (latest) return latest;
    throw AppError.conflict('La iniciativa no tiene un ciclo operativo inicializado.', 'NO_OPERATIONAL_CYCLE');
  }

  private assertCycleMutable(cycle: any) {
    if (cycle?.status === 'completed' || cycle?.status === 'superseded') {
      throw AppError.conflict('El contenido confirmado de un ciclo historico es de solo lectura. Continua la iniciativa mediante un nuevo ciclo.', 'HISTORICAL_CYCLE_READ_ONLY');
    }
  }

  private async resolveInitiativeAlignment(project: any, client?: any): Promise<InitiativeAlignmentResult> {
    const db = client ?? this.prisma as any;
    const governance = db.initiativeGovernance?.findUnique
      ? await db.initiativeGovernance.findUnique({ where: { projectId: project.id } })
        ?? (db.initiativeGovernance?.findFirst ? await db.initiativeGovernance.findFirst({ where: { projectId: project.id } }) : null)
      : db.initiativeGovernance?.findFirst
        ? await db.initiativeGovernance.findFirst({ where: { projectId: project.id } })
        : null;
    const portfolioMeta = (project.portfolioMeta ?? [])[0] ?? (db.initiativePortfolioMeta?.findFirst ? await db.initiativePortfolioMeta.findFirst({
      where: { projectId: project.id },
      orderBy: { createdAt: 'asc' },
    }) : null);
    return this.initiativeCompletion.resolveAlignment({
      projectId: project.id,
      governanceMode: governance?.mode ?? null,
      hasExplicitGovernanceConfig: Boolean(governance),
      challengeId: portfolioMeta?.challengeId ?? null,
      strategicFrontId: portfolioMeta?.strategicFrontId ?? portfolioMeta?.challenge?.strategicFrontId ?? null,
    });
  }

  private async hasMethodologicalCompletion(projectId: string, cycleId: string, client?: any): Promise<boolean> {
    const db = client ?? this.prisma as any;
    const cycle = await db.initiativeCycle.findUnique({ where: { id: cycleId } });
    if (cycle?.projectId !== projectId || cycle.status !== 'completed' || !cycle.completedAt) return false;
    const step4Output = await db.adaptiveStepOutput.findFirst({
      where: { projectId, cycleId, stepNumber: 4, status: 'confirmed' },
      orderBy: { version: 'desc' },
    });
    return Boolean(step4Output?.confirmedAt);
  }

  private async loadDecisionReadinessInput(project: any, cycle: any, decisionType: DecisionType, client?: any): Promise<DecisionReadinessInput> {
    const db = client ?? this.prisma as any;
    const [claims, evidence, validations, impacts, attentionItems, outputs] = await Promise.all([
      db.truthClaim.findMany({ where: { projectId: project.id } }),
      db.evidence.findMany({ where: { projectId: project.id } }),
      db.truthValidation.findMany({ where: { projectId: project.id } }),
      db.impactAssertion.findMany({ where: { projectId: project.id } }),
      db.attentionItem.findMany({ where: { projectId: project.id, status: 'open' } }),
      db.adaptiveStepOutput.findMany({ where: { projectId: project.id, cycleId: cycle.id }, orderBy: [{ stepNumber: 'asc' }, { version: 'desc' }] }),
    ]);
    const outputJson = outputs.map((item: any) => item.outputJson ?? {});
    const unresolvedFromOutputs = outputJson.reduce((count: number, output: any) => count + this.countMeaningfulFields(output, [
      'unresolvedQuestions',
      'pendingQuestions',
      'validationQuestions',
      'learningQuestions',
      'openQuestions',
      'hypotheses',
    ]), 0);
    const capturedLearningFromOutputs = outputJson.reduce((count: number, output: any) => count + this.countMeaningfulFields(output, [
      'learning',
      'learnings',
      'insights',
      'resultAnalysis',
      'evidenceNarrative',
      'hypothesisResult',
      'decision',
    ]), 0);
    const operationalBlockersFromOutputs = outputJson.reduce((count: number, output: any) => count + this.countMeaningfulFields(output, [
      'operationalBlockers',
      'blockers',
      'dependencies',
    ]), 0);
    const risksFromOutputs = outputJson.reduce((count: number, output: any) => count + this.countMeaningfulFields(output, [
      'risks',
      'mainRisk',
      'riskOfBeingWrong',
      'limitations',
    ]), 0);

    return {
      projectId: project.id,
      cycleId: cycle.id,
      decisionType,
      evidenceContext: {
        claimCount: claims.length,
        evidenceCount: evidence.length,
        supportingEvidenceCount: evidence.filter((item: any) => item.truthStatus === 'supports').length,
        contradictedEvidenceCount: evidence.filter((item: any) => item.truthStatus === 'contradicts').length,
        insufficientEvidenceCount: evidence.filter((item: any) => item.truthStatus === 'insufficient').length,
        supportedClaimCount: claims.filter((item: any) => item.verificationState === 'supported').length,
        contradictedClaimCount: claims.filter((item: any) => item.verificationState === 'contradicted').length,
        insufficientClaimCount: claims.filter((item: any) => item.verificationState === 'insufficient').length,
        supportedValidationCount: validations.filter((item: any) => item.result === 'supported').length,
        contradictedValidationCount: validations.filter((item: any) => item.result === 'contradicted').length,
        insufficientValidationCount: validations.filter((item: any) => item.result === 'insufficient').length,
      },
      impactContext: {
        declaredCount: impacts.filter((item: any) => item.status === 'declared').length,
        estimatedCount: impacts.filter((item: any) => item.status === 'estimated').length,
        validatedCount: impacts.filter((item: any) => item.status === 'validated').length,
        realizedCount: impacts.filter((item: any) => item.status === 'realized').length,
      },
      executionContext: {
        currentStep: this.toStepNumber(cycle.currentStep ?? project.currentStep ?? 0),
        hasExecutionSignal: outputJson.some((output: any) => this.hasAnyMeaningfulField(output, ['executionPlan', 'executionDesign', 'selectedBet', 'experimentPlan', 'pilotPlan'])),
        hasOperationalReadinessSignal: outputJson.some((output: any) => this.hasAnyMeaningfulField(output, ['operationalReadiness', 'operationalReadinessChecklist', 'readiness', 'transferOrClosure'])),
        hasProvenExecutionReadiness: false,
        openOperationalBlockerCount: attentionItems.filter((item: any) => this.isOperationalAttention(item)).length + operationalBlockersFromOutputs,
      },
      riskContext: {
        hasRiskSignal: attentionItems.some((item: any) => this.isRiskAttention(item)) || risksFromOutputs > 0 || this.hasValue(project.step0Data?.mainRisk),
        hasProvenRiskReadiness: false,
        knownRiskCount: attentionItems.filter((item: any) => this.isRiskAttention(item)).length + risksFromOutputs + (this.hasValue(project.step0Data?.mainRisk) ? 1 : 0),
        openHighRiskCount: attentionItems.filter((item: any) => this.isRiskAttention(item) && item.severity === 'high').length,
        openCriticalRiskCount: attentionItems.filter((item: any) => this.isRiskAttention(item) && item.severity === 'critical').length,
      },
      governanceContext: {
        hasProjectOwner: this.hasValue(project.ownerId),
        hasActiveTeamMember: (project.teamMembers ?? []).some((member: any) => member.status === 'ACTIVE' || member.status === 'active'),
        hasPortfolioContext: (project.portfolioMeta ?? []).length > 0,
      },
      learningContext: {
        unresolvedQuestionCount: unresolvedFromOutputs + this.countMeaningfulFields(project.step0Data ?? {}, ['pendingQuestions', 'validationQuestions']),
        capturedLearningCount: capturedLearningFromOutputs,
      },
    };
  }

  private isOperationalAttention(item: any) {
    const text = `${item.category ?? ''} ${item.reason ?? ''} ${item.exitCondition ?? ''}`.toLowerCase();
    return /operat|ejec|bloque|depend|aprob/.test(text);
  }

  private isRiskAttention(item: any) {
    const text = `${item.category ?? ''} ${item.reason ?? ''} ${item.exitCondition ?? ''}`.toLowerCase();
    return /risk|riesgo|legal|regulator|datos|seguridad|bloque/.test(text);
  }

  private hasAnyMeaningfulField(source: any, fields: string[]) {
    return fields.some((field) => this.countMeaningfulFields(source, [field]) > 0);
  }

  private countMeaningfulFields(source: any, fields: string[]): number {
    if (!source || typeof source !== 'object') return 0;
    let count = 0;
    for (const field of fields) count += this.countMeaningfulValue(source[field]);
    return count;
  }

  private countMeaningfulValue(value: unknown): number {
    if (Array.isArray(value)) return value.filter((item) => this.hasValue(item)).length;
    if (value && typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0 ? 1 : 0;
    return this.hasValue(value) ? 1 : 0;
  }

  private toStepNumber(value: unknown): StepNumber {
    const numeric = Number(value);
    if (numeric === 1 || numeric === 2 || numeric === 3 || numeric === 4) return numeric;
    return 0;
  }

  private async getAccessibleProject(projectId: string, userId: string, role: Role) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        teamMembers: true,
        portfolioMeta: { include: { challenge: { include: { strategicFront: true } } } },
        contextSnapshots: { orderBy: { createdAt: 'desc' }, take: 1 },
        steps: true,
      },
    });
    if (!project) throw AppError.notFound('Proyecto', 'PROJECT_NOT_FOUND');
    if (role !== 'admin' && role !== 'mentor') {
      const isMember = (project as any).teamMembers.some((m: any) => m.userId === userId);
      // El Portfolio Lead asignado lee y decide sin ser miembro del equipo (§23, ADR-025); la
      // autoridad para decidir la resuelve resolveDecisionAuthority. El trabajo del equipo
      // (checkpoints, cambios críticos) exige además assertTeamWorkAccess.
      const isAssignedPortfolioLead = !isMember && Boolean(
        (await (this.prisma as any).initiativeGovernance.findUnique({ where: { projectId } }))?.portfolioLeadUserId === userId,
      );
      if (!isMember && !isAssignedPortfolioLead) throw AppError.forbidden('No tienes acceso a este proyecto.', 'PROJECT_ACCESS_DENIED');
    }
    return project as any;
  }

  private assertTeamWorkAccess(project: any, userId: string, role: Role) {
    if (role === 'admin' || role === 'mentor') return;
    if ((project.teamMembers ?? []).some((m: any) => m.userId === userId)) return;
    throw AppError.forbidden('Sólo el equipo de la iniciativa puede avanzar sus Steps.', 'PROJECT_TEAM_ACCESS_REQUIRED');
  }

  private parseCriticalChangeImpact(raw: unknown): ChangeImpactResult {
    const impact = raw as Partial<ChangeImpactResult> | null;
    if (!impact || impact.assessmentVersion !== 1 || !impact.transition || !impact.sourceCycleId) {
      throw AppError.badRequest('El cambio critico no tiene una evaluacion aplicable.', 'CRITICAL_CHANGE_IMPACT_MISSING');
    }
    return impact as ChangeImpactResult;
  }

  private async lockCriticalChangeTx(tx: any, criticalChangeId: string) {
    if (typeof tx.$queryRawUnsafe !== 'function') return;
    await tx.$queryRawUnsafe('SELECT id FROM "CriticalChange" WHERE id = $1 FOR UPDATE', criticalChangeId);
  }

  private async validateReturnBasedOnCycleTx(tx: any, projectId: string, sourceCycle: any, basedOnCycleId: string) {
    const basedOnCycle = await tx.initiativeCycle.findUnique({ where: { id: basedOnCycleId } });
    if (!basedOnCycle || basedOnCycle.projectId !== projectId) {
      throw AppError.badRequest('El ciclo historico base no pertenece a la iniciativa.', 'CRITICAL_CHANGE_BASED_ON_INVALID');
    }
    if (basedOnCycle.id === sourceCycle.id) {
      throw AppError.badRequest('El ciclo base debe ser historico y distinto del ciclo actual.', 'CRITICAL_CHANGE_BASED_ON_CURRENT');
    }
    if (basedOnCycle.status === 'active') {
      throw AppError.badRequest('El ciclo base debe ser historico, no activo.', 'CRITICAL_CHANGE_BASED_ON_ACTIVE');
    }
    if (Number(basedOnCycle.cycleNumber ?? 0) >= Number(sourceCycle.cycleNumber ?? 0)) {
      throw AppError.badRequest('El ciclo base debe anteceder al ciclo operativo actual.', 'CRITICAL_CHANGE_BASED_ON_ORDER_INVALID');
    }
    return basedOnCycle;
  }

  private resolveConfirmedReentryStep(impact: ChangeImpactResult, requested?: StepNumber | null): StepNumber | null {
    if (impact.transition === 'same_cycle') {
      if (impact.reentryStep === null || impact.reentryStep === undefined) {
        if (requested !== undefined && requested !== null) {
          throw AppError.badRequest('El assessment same-cycle no define reentrada; no confirmes un paso artificial.', 'CRITICAL_CHANGE_REENTRY_MISMATCH');
        }
        return null;
      }
      if (requested !== undefined && requested !== null && requested !== impact.reentryStep) {
        throw AppError.badRequest('El punto de reentrada confirmado no coincide con la evaluacion.', 'CRITICAL_CHANGE_REENTRY_MISMATCH');
      }
      return impact.reentryStep;
    }

    const assessed = impact.reentryStep;
    if (assessed === null || assessed === undefined) {
      throw AppError.badRequest('La evaluacion no define un punto de reentrada.', 'CRITICAL_CHANGE_REENTRY_MISSING');
    }
    if (requested !== undefined && requested !== null && requested !== assessed) {
      throw AppError.badRequest('El punto de reentrada confirmado no coincide con la evaluacion.', 'CRITICAL_CHANGE_REENTRY_MISMATCH');
    }
    return assessed as StepNumber;
  }

  private resolveConfirmedBasedOnCycleId(impact: ChangeImpactResult, assessed?: string | null, requested?: string | null): string | null {
    if (impact.transition !== 'return_to_prior_direction') return null;
    const basedOnCycleId = requested ?? assessed ?? impact.basedOnCycleId ?? null;
    if (!basedOnCycleId) {
      throw AppError.badRequest('Retomar una direccion anterior requiere basedOnCycleId.', 'CRITICAL_CHANGE_BASED_ON_REQUIRED');
    }
    if (assessed && requested && assessed !== requested) {
      throw AppError.badRequest('El ciclo base confirmado no coincide con la evaluacion.', 'CRITICAL_CHANGE_BASED_ON_MISMATCH');
    }
    return basedOnCycleId;
  }

  private async applyCriticalChangeSameCycleTx(
    tx: any,
    projectId: string,
    criticalChange: any,
    sourceCycle: any,
    impact: ChangeImpactResult,
    reentryStep: StepNumber | null,
    appliedAt: Date,
  ) {
    await this.upsertProgressSignalTx(tx, projectId, {
      step: sourceCycle.currentStep ?? reentryStep,
      checkpointCode: 'critical-change-applied',
      checkpointTitle: 'Cambio critico aplicado',
      health: impact.materialChange ? 'attention' : 'healthy',
      hypothesis: String(criticalChange.nextValueJson ?? ''),
      evidence: String(criticalChange.reason ?? 'Cambio critico aplicado sin crear nuevo ciclo.'),
      evidenceStrength: 'weak',
      blocker: '',
      actorRequired: 'Owner de iniciativa',
      nextAction: 'Continuar en el ciclo actual con la transicion confirmada.',
      upcomingDecision: 'Seguimiento del cambio critico aplicado.',
      updatedAt: appliedAt.toISOString(),
      criticalChangeId: criticalChange.id,
      criticalChangeTransition: impact.transition,
    });
    return null;
  }

  private async applyCriticalChangeNewCycleTx(
    tx: any,
    projectId: string,
    userId: string,
    criticalChange: any,
    sourceCycle: any,
    impact: ChangeImpactResult,
    reentryStep: StepNumber | null,
    appliedAt: Date,
  ) {
    if (impact.transition !== 'new_cycle') {
      throw AppError.badRequest('La evaluacion no recomienda nuevo ciclo.', 'CRITICAL_CHANGE_TRANSITION_INVALID');
    }
    if (reentryStep === null) {
      throw AppError.badRequest('La evaluacion new-cycle requiere reentrada.', 'CRITICAL_CHANGE_REENTRY_MISSING');
    }
    const activeCycles = await tx.initiativeCycle.findMany({ where: { projectId, status: 'active' } });
    const activeOutsideSource = activeCycles.filter((cycle: any) => cycle.id !== sourceCycle.id);
    if (activeOutsideSource.length > 0 || sourceCycle.status !== 'active') {
      throw AppError.conflict('La iniciativa ya tiene otro ciclo activo.', 'ACTIVE_CYCLE_CONFLICT');
    }

    await tx.initiativeCycle.update({
      where: { id: sourceCycle.id },
      data: { status: 'superseded', completedAt: appliedAt, currentStep: sourceCycle.currentStep ?? reentryStep },
    });

    const latestCycle = await tx.initiativeCycle.findFirst({
      where: { projectId },
      orderBy: { cycleNumber: 'desc' },
    });
    const nextCycle = await tx.initiativeCycle.create({
      data: {
        projectId,
        cycleNumber: Number(latestCycle?.cycleNumber ?? sourceCycle.cycleNumber ?? 0) + 1,
        parentCycleId: sourceCycle.id,
        basedOnCycleId: null,
        triggerType: 'critical_change',
        triggerRefId: criticalChange.id,
        startStep: reentryStep,
        currentStep: reentryStep,
        status: 'active',
      },
    });

    await this.createCriticalChangeCycleStepStatesTx(tx, sourceCycle.id, nextCycle.id, impact, reentryStep);

    const sourceConfig = await tx.adaptiveStepConfiguration.findFirst({
      where: { projectId, cycleId: sourceCycle.id, stepNumber: reentryStep },
      orderBy: { version: 'desc' },
    });
    const fallbackConfig = sourceConfig ?? await tx.adaptiveStepConfiguration.findFirst({
      where: { projectId, cycleId: sourceCycle.id, status: 'active' },
      orderBy: [{ stepNumber: 'desc' }, { version: 'desc' }],
    });
    if (!fallbackConfig) {
      throw AppError.badRequest('No existe configuracion fuente para reentrada.', 'REENTRY_CONFIGURATION_MISSING');
    }

    const nextVersion = await this.nextConfigVersionTx(tx, projectId, nextCycle.id, reentryStep);
    const nextContext = this.applyCriticalChange(fallbackConfig.sourceContextJson ?? {}, {
      idempotencyKey: criticalChange.idempotencyKey,
      field: criticalChange.field,
      previousValue: criticalChange.previousValueJson,
      nextValue: criticalChange.nextValueJson,
      reason: criticalChange.reason ?? undefined,
      confirmed: true,
      action: 'update_route',
    } as CriticalChangeInput);
    const nextConfigJson = this.buildStepConfiguration(reentryStep, nextVersion, nextContext);
    const nextConfig = await tx.adaptiveStepConfiguration.create({
      data: {
        projectId,
        cycleId: nextCycle.id,
        stepNumber: reentryStep,
        version: nextVersion,
        status: 'active',
        routeType: nextContext.routeType ?? fallbackConfig.routeType ?? 'explore_validate',
        depthLevel: nextContext.depthLevel ?? fallbackConfig.depthLevel ?? 'standard',
        maturity: nextContext.maturity ?? fallbackConfig.maturity ?? 'problem',
        configurationJson: nextConfigJson,
        sourceContextJson: nextContext,
      },
    });
    await this.materializeCheckpointTx(tx, projectId, nextConfig, this.firstCheckpointForStep(reentryStep), [], userId, `critical-change-reentry-checkpoint:${criticalChange.id}:${nextCycle.id}:${reentryStep}`);

    await tx.project.update({
      where: { id: projectId },
      data: { currentStep: reentryStep, lastModified: appliedAt },
    });
    await this.upsertProgressSignalTx(tx, projectId, {
      step: reentryStep,
      checkpointCode: 'critical-change-reentry',
      checkpointTitle: `Reentrada Step ${reentryStep}`,
      health: 'attention',
      hypothesis: String(criticalChange.nextValueJson ?? ''),
      evidence: String(criticalChange.reason ?? 'Nuevo ciclo creado por cambio critico confirmado.'),
      evidenceStrength: 'weak',
      blocker: '',
      actorRequired: 'Owner de iniciativa',
      nextAction: `Retomar desde Step ${reentryStep} con el cambio critico aplicado.`,
      upcomingDecision: 'Completar la reentrada antes de avanzar.',
      updatedAt: appliedAt.toISOString(),
      criticalChangeId: criticalChange.id,
      sourceCycleId: sourceCycle.id,
      resultingCycleId: nextCycle.id,
      criticalChangeTransition: impact.transition,
    });
    return nextCycle;
  }

  private async applyCriticalChangeReturnToPriorDirectionTx(
    tx: any,
    projectId: string,
    userId: string,
    criticalChange: any,
    sourceCycle: any,
    impact: ChangeImpactResult,
    reentryStep: StepNumber | null,
    basedOnCycleId: string | null,
    appliedAt: Date,
  ) {
    if (impact.transition !== 'return_to_prior_direction') {
      throw AppError.badRequest('La evaluacion no recomienda retomar direccion anterior.', 'CRITICAL_CHANGE_TRANSITION_INVALID');
    }
    if (reentryStep === null) {
      throw AppError.badRequest('Retomar direccion anterior requiere reentrada.', 'CRITICAL_CHANGE_REENTRY_MISSING');
    }
    if (!basedOnCycleId) {
      throw AppError.badRequest('Retomar direccion anterior requiere basedOnCycleId.', 'CRITICAL_CHANGE_BASED_ON_REQUIRED');
    }
    const basedOnCycle = await tx.initiativeCycle.findUnique({ where: { id: basedOnCycleId } });
    if (!basedOnCycle || basedOnCycle.projectId !== projectId) {
      throw AppError.badRequest('El ciclo historico base no pertenece a la iniciativa.', 'CRITICAL_CHANGE_BASED_ON_INVALID');
    }
    if (basedOnCycle.id === sourceCycle.id) {
      throw AppError.badRequest('El ciclo base debe ser historico y distinto del ciclo actual.', 'CRITICAL_CHANGE_BASED_ON_CURRENT');
    }
    if (basedOnCycle.status === 'active') {
      throw AppError.badRequest('El ciclo base debe ser historico, no activo.', 'CRITICAL_CHANGE_BASED_ON_ACTIVE');
    }
    if (Number(basedOnCycle.cycleNumber ?? 0) >= Number(sourceCycle.cycleNumber ?? 0)) {
      throw AppError.badRequest('El ciclo base debe anteceder al ciclo operativo actual.', 'CRITICAL_CHANGE_BASED_ON_ORDER_INVALID');
    }

    const activeCycles = await tx.initiativeCycle.findMany({ where: { projectId, status: 'active' } });
    const activeOutsideSource = activeCycles.filter((cycle: any) => cycle.id !== sourceCycle.id);
    if (activeOutsideSource.length > 0 || sourceCycle.status !== 'active') {
      throw AppError.conflict('La iniciativa ya tiene otro ciclo activo.', 'ACTIVE_CYCLE_CONFLICT');
    }

    await tx.initiativeCycle.update({
      where: { id: sourceCycle.id },
      data: { status: 'superseded', completedAt: appliedAt, currentStep: sourceCycle.currentStep ?? reentryStep },
    });
    const latestCycle = await tx.initiativeCycle.findFirst({
      where: { projectId },
      orderBy: { cycleNumber: 'desc' },
    });
    const nextCycle = await tx.initiativeCycle.create({
      data: {
        projectId,
        cycleNumber: Number(latestCycle?.cycleNumber ?? sourceCycle.cycleNumber ?? 0) + 1,
        parentCycleId: sourceCycle.id,
        basedOnCycleId: basedOnCycle.id,
        triggerType: 'return_to_prior_direction',
        triggerRefId: criticalChange.id,
        startStep: reentryStep,
        currentStep: reentryStep,
        status: 'active',
      },
    });

    await this.createCriticalChangeCycleStepStatesTx(tx, sourceCycle.id, nextCycle.id, impact, reentryStep);
    const fallbackConfig = await tx.adaptiveStepConfiguration.findFirst({
      where: { projectId, cycleId: basedOnCycle.id, stepNumber: reentryStep },
      orderBy: { version: 'desc' },
    }) ?? await tx.adaptiveStepConfiguration.findFirst({
      where: { projectId, cycleId: sourceCycle.id, stepNumber: reentryStep },
      orderBy: { version: 'desc' },
    });
    if (!fallbackConfig) {
      throw AppError.badRequest('No existe configuracion historica para reentrada.', 'REENTRY_CONFIGURATION_MISSING');
    }

    const historicalContext = fallbackConfig.sourceContextJson ?? {};
    const changedHistoricalContext = this.applyCriticalChange(historicalContext, {
      idempotencyKey: `critical-change-return-context:${criticalChange.id}`,
      field: criticalChange.field,
      previousValue: criticalChange.previousValueJson,
      nextValue: criticalChange.nextValueJson,
      reason: criticalChange.reason ?? undefined,
      confirmed: true,
    } as CriticalChangeInput);
    const nextVersion = await this.nextConfigVersionTx(tx, projectId, nextCycle.id, reentryStep);
    const nextContext = {
      ...changedHistoricalContext,
      returnToPriorDirection: {
        basedOnCycleId: basedOnCycle.id,
        sourceCycleId: sourceCycle.id,
        criticalChangeId: criticalChange.id,
        note: 'Nueva iteracion basada en una direccion anterior; no es rollback.',
      },
    };
    const nextConfigJson = this.buildStepConfiguration(reentryStep, nextVersion, nextContext);
    const nextConfig = await tx.adaptiveStepConfiguration.create({
      data: {
        projectId,
        cycleId: nextCycle.id,
        stepNumber: reentryStep,
        version: nextVersion,
        status: 'active',
        routeType: fallbackConfig.routeType ?? 'explore_validate',
        depthLevel: fallbackConfig.depthLevel ?? 'standard',
        maturity: fallbackConfig.maturity ?? 'problem',
        configurationJson: nextConfigJson,
        sourceContextJson: nextContext,
      },
    });
    await this.materializeCheckpointTx(tx, projectId, nextConfig, this.firstCheckpointForStep(reentryStep), [], userId, `critical-change-return-checkpoint:${criticalChange.id}:${nextCycle.id}:${reentryStep}`);

    await tx.project.update({
      where: { id: projectId },
      data: { currentStep: reentryStep, lastModified: appliedAt },
    });
    await this.upsertProgressSignalTx(tx, projectId, {
      step: reentryStep,
      checkpointCode: 'critical-change-return-reentry',
      checkpointTitle: `Retomar direccion anterior desde Step ${reentryStep}`,
      health: 'attention',
      hypothesis: String(criticalChange.nextValueJson ?? ''),
      evidence: String(criticalChange.reason ?? 'Nueva iteracion basada en direccion anterior confirmada.'),
      evidenceStrength: 'weak',
      blocker: '',
      actorRequired: 'Owner de iniciativa',
      nextAction: `Retomar desde Step ${reentryStep} conservando el aprendizaje posterior.`,
      upcomingDecision: 'Completar la reentrada antes de avanzar.',
      updatedAt: appliedAt.toISOString(),
      criticalChangeId: criticalChange.id,
      sourceCycleId: sourceCycle.id,
      resultingCycleId: nextCycle.id,
      basedOnCycleId: basedOnCycle.id,
      criticalChangeTransition: impact.transition,
    });
    return nextCycle;
  }

  private async createCriticalChangeCycleStepStatesTx(tx: any, sourceCycleId: string, nextCycleId: string, impact: ChangeImpactResult, reentryStep: StepNumber) {
    const inherited = new Set(impact.inheritedSteps);
    const reopened = new Set(impact.reopenedSteps);
    for (const stepNumber of [0, 1, 2, 3, 4] as StepNumber[]) {
      const sourceOutput = await tx.adaptiveStepOutput.findFirst({
        where: { cycleId: sourceCycleId, stepNumber, status: 'confirmed' },
        orderBy: { version: 'desc' },
      });
      const sourceState = await tx.cycleStepState.findFirst({ where: { cycleId: sourceCycleId, stepNumber } });
      const state = stepNumber < reentryStep && inherited.has(stepNumber)
        ? 'inherited'
        : stepNumber === reentryStep
          ? 'active'
          : stepNumber > reentryStep && reopened.has(stepNumber) && (sourceOutput || sourceState?.state === 'confirmed')
            ? 'reopened'
            : 'pending';
      await tx.cycleStepState.create({
        data: {
          cycleId: nextCycleId,
          stepNumber,
          state,
          inheritedFromCycleId: state === 'inherited' ? sourceState?.state === 'inherited' ? sourceState.inheritedFromCycleId ?? sourceCycleId : sourceCycleId : null,
          inheritedFromOutputId: state === 'inherited' ? sourceOutput?.id ?? sourceState?.inheritedFromOutputId ?? null : null,
        },
      });
    }
  }

  private firstCheckpointForStep(stepNumber: StepNumber) {
    return stepNumber === 0 ? 'CP-0.1'
      : stepNumber === 1 ? 'CP-1.1'
        : stepNumber === 2 ? 'CP-2.1'
          : stepNumber === 3 ? 'CP-3.1'
            : 'CP-4.1';
  }

  private buildMasterContext(project: any) {
    const raw = (project.step0Data ?? {}) as Record<string, any>;
    const legacy = raw.adaptiveCore?.masterContext ?? {};
    const portfolioMeta = project.portfolioMeta?.[0];
    const companySnapshot = project.contextSnapshots?.[0];
    const companyJson = companySnapshot?.snapshotJson ?? null;
    const companyCoverage = Number(companySnapshot?.contextScore ?? companyJson?.contextScore ?? 0);
    const routeType = String(legacy.routeType ?? this.deriveRouteType(raw, portfolioMeta)) as AdaptiveRouteType;
    const depthLevel = String(legacy.depthLevel ?? this.deriveDepthLevel(raw, companyCoverage)) as AdaptiveDepthLevel;
    const company = companyJson ? {
      id: companyJson.company?.id ?? companySnapshot.companyId,
      name: companyJson.company?.name ?? 'Empresa seleccionada',
      area: companyJson.areas?.[0]?.name ?? null,
      coverage: companyCoverage,
      restrictions: this.extractCompanyDimension(companyJson, ['restriction', 'restriccion', 'guardrail']),
      culture: this.extractCompanyDimension(companyJson, ['culture', 'cultura']),
      actors: this.extractCompanyDimension(companyJson, ['actor', 'stakeholder', 'sponsor']),
      decisionModel: this.extractCompanyDimension(companyJson, ['decision', 'comite', 'gobernanza']),
      formats: this.extractCompanyDimension(companyJson, ['format', 'formato', 'template']),
      sources: (companyJson.sources ?? []).map((s: any) => s.id ?? s.url ?? s.originalFilename).filter(Boolean),
      lowCoverage: companyCoverage < 50,
      versionId: companyJson.versionId,
      versionNumber: companyJson.versionNumber,
    } : null;
    return {
      id: legacy.id ?? `master-context-${project.initialReviewSnapshotId ?? project.id}-v1`,
      version: Number(legacy.version ?? 1),
      legacyFallback: !raw.adaptiveCore,
      // Nombre y encuadre pasaron al catalogo de checkpoints; se exponen aqui para que el
      // planificador los reconozca como ya resueltos y no los vuelva a preguntar.
      initiativeTitle: raw.initiativeTitle ?? project.name ?? '',
      initiativeFrame: raw.initiativeFrame ?? '',
      challengeType: legacy.challengeType ?? raw.challengeType ?? portfolioMeta?.challenge?.type ?? 'exploration',
      routeType,
      depthLevel,
      maturity: legacy.maturity ?? (routeType === 'implement_handoff' ? 'solution_proposed' : 'problem'),
      knownFacts: this.compact([raw.contextInitial, raw.initialFocus, raw.expectedImpact, raw.quePasaQueQuieres]),
      assumptions: this.compact([...(Array.isArray(raw.pendingQuestions) ? raw.pendingQuestions.map((q: any) => typeof q === 'string' ? q : q.question) : []), raw.validationSignal]),
      missingCriticalInformation: this.compact(Array.isArray(raw.pendingQuestions) ? raw.pendingQuestions.map((q: any) => typeof q === 'string' ? q : q.question) : []),
      risks: this.compact([raw.mainRisk]),
      decisions: this.compact([raw.nextRecommendedStep, raw.decisionRequested]),
      companySnapshot: company,
      challengeSnapshot: portfolioMeta ? {
        id: portfolioMeta.challengeId,
        title: portfolioMeta.challenge?.title ?? portfolioMeta.challenge?.name,
        strategicFrontId: portfolioMeta.strategicFrontId,
        objective: portfolioMeta.challenge?.objective,
        successCriteria: portfolioMeta.challenge?.successCriteria,
        challengeOwner: portfolioMeta.challenge?.challengeOwner,
        strategicFront: portfolioMeta.challenge?.strategicFront?.name,
      } : null,
      createdAt: new Date().toISOString(),
    };
  }

  private buildStepConfiguration(step: StepNumber, version: number, masterContext: any, step0Output?: Record<string, unknown>) {
    const routeType = (masterContext.routeType ?? 'explore_validate') as AdaptiveRouteType;
    const checkpointSpecs = step === 0
      ? STEP0_CHECKPOINTS
      : step === 1
        ? STEP1_CHECKPOINTS
        : step === 2
          ? STEP2_CHECKPOINTS.filter((cp) => cp.key !== 'CP-2.5' || this.shouldActivateReadiness(masterContext))
          : step === 3
            ? STEP3_CHECKPOINTS.filter((cp) => cp.key !== 'CP-3.5' || this.shouldActivateOperationalReadiness(masterContext))
            : STEP4_CHECKPOINTS;
    const checkpoints = checkpointSpecs.map((cp, idx) => ({
      id: cp.key.toLowerCase().replace('.', '-'),
      step,
      code: cp.key,
      title: cp.title,
      status: idx === 0 ? 'ready' : 'locked',
      outputKey: cp.outputKey,
      questions: idx === 0 ? this.buildQuestions(cp.key, version, masterContext, []) : [],
      completionCriteria: step === 0
        ? ['Sintesis suficiente', 'Faltantes visibles', 'Siguiente accion definida']
        : step === 1
          ? ['Foco visible', 'Evidencia con sourceRefs', 'Decision de continuidad explicita']
          : step === 2
            ? ['Foco transferido', 'Hipotesis de Step 1 visible', 'Restricciones y criterios heredados']
            : step === 3
              ? ['Ejecucion registrada', 'Resultado analizado', 'Decision confirmable']
              : ['Decision Step 3 transferida', 'Continuidad configurada'],
    }));
    return {
      id: `step-${step}-${routeType}-v${version}`,
      step,
      version,
      visibleName: step === 0 ? STEP0_VISIBLE_NAME_BY_ROUTE[routeType] : step === 1 ? 'Step 1 adaptativo' : step === 2 ? 'Step 2 adaptativo' : step === 3 ? 'Step 3 adaptativo' : 'Step 4 configurado',
      objective: step === 0
        ? 'Convertir la intencion inicial en hipotesis estrategica delimitada y contrato de validacion o ejecucion.'
        : step === 1
          ? 'Delimitar y fundamentar el foco mediante evidencia suficiente.'
          : step === 2
            ? 'Convertir el foco sustentado en una apuesta seleccionada y una forma ejecutable de probarla o implementarla.'
            : step === 3
              ? 'Ejecutar, analizar resultados y confirmar una decision trazable desde la apuesta seleccionada.'
              : 'Preparar continuidad o cierre operativo desde la decision confirmada de Step 3.',
      expectedOutput: step === 0 ? STEP0_OUTPUT_BY_ROUTE[routeType] : step === 1 ? STEP1_OUTPUT_BY_ROUTE[routeType] : step === 2 ? STEP2_OUTPUT_BY_ROUTE[routeType] : step === 3 ? STEP3_OUTPUT_BY_ROUTE[routeType] : STEP4_OUTPUT_BY_ROUTE[routeType],
      routeType,
      depthLevel: masterContext.depthLevel ?? 'standard',
      transferredFromStep0: step0Output ?? null,
      transferredFromStep1: step === 2 ? masterContext.step1Output ?? null : null,
      transferredFromStep2: step === 3 ? masterContext.step2Output ?? null : null,
      transferredFromStep3: step === 4 ? masterContext.step3Output ?? null : null,
      returnToPriorDirection: masterContext.returnToPriorDirection ?? null,
      returnedDirectionContext: masterContext.returnToPriorDirection ? {
        step2Output: masterContext.step2Output ?? null,
      } : null,
      checkpoints,
    };
  }

  /**
   * Step 0 se planifica con el motor adaptativo (checkpoint-planner): sus preguntas se
   * arman con lo ya respondido, la revision inicial y el contexto de empresa. Steps 1-4
   * siguen con el catalogo fijo de `buildStaticQuestions` hasta que se migren.
   */
  private buildQuestions(checkpointKey: string, configurationVersion: number, masterContext: any, previousAnswers: Record<string, unknown>[]): MaterializedQuestion[] {
    if (CHECKPOINT_VARIABLES[checkpointKey]) {
      return planCheckpointQuestions({ checkpointKey, configurationVersion, masterContext, previousAnswers });
    }
    return this.buildStaticQuestions(checkpointKey, configurationVersion, masterContext, previousAnswers);
  }

  private buildStaticQuestions(checkpointKey: string, configurationVersion: number, masterContext: any, previousAnswers: Record<string, unknown>[]): MaterializedQuestion[] {
    const questions: MaterializedQuestion[] = [];
    const add = (source: AdaptiveQuestionSource, prompt: string, clarifiesVariable: string, required: boolean, reason: string, sourceRefs: string[] = [], extra: Partial<MaterializedQuestion> = {}) => {
      questions.push({
        id: `${checkpointKey.toLowerCase().replace('.', '-')}-v${configurationVersion}-q${questions.length + 1}`,
        checkpointKey,
        configurationVersion,
        prompt,
        purpose: reason,
        clarifiesVariable,
        answerType: extra.answerType ?? 'free_text',
        reason,
        source,
        sourceRefs,
        required,
        allowsUnknown: extra.allowsUnknown ?? true,
        contextDerived: extra.contextDerived,
        confirmationRequired: extra.confirmationRequired,
      });
    };

    if (checkpointKey === 'CP-0.1') {
      add('core', 'Que resultado o cambio debe quedar entendible para un lider?', 'objective', true, 'Step 0 no puede cerrar sin proposito entendible.', ['PRD-03:9.4'], { allowsUnknown: false });
      add('challenge_type', 'Que tipo de reto describe mejor la iniciativa hoy?', 'challengeType', true, 'El tipo de reto ajusta profundidad y preguntas posteriores.', [String(masterContext.challengeType ?? '')]);
      if (masterContext.challengeSnapshot) add('challenge_context', 'Que parte del reto padre aborda esta iniciativa?', 'challengeContribution.subproblem', true, 'La iniciativa vinculada debe reportar contribucion al reto.', [masterContext.challengeSnapshot.id], { contextDerived: true });
    }
    if (checkpointKey === 'CP-0.2') {
      add('core', 'Cual es el alcance inicial y que queda fuera por ahora?', 'scope', true, 'El cierre de Step 0 requiere alcance inicial.', ['PRD-03:9.4']);
      add('core', 'Quien es el owner operativo y que actor debe confirmar condiciones?', 'owner_and_actor_required', true, 'Sin owner hay hard gate de Step 0.', ['PRD-03:9.5'], { answerType: 'owner', allowsUnknown: false });
      if (masterContext.companySnapshot) {
        add(
          'company_context',
          'Que restriccion de empresa podria afectar evidencia, datos o aprobaciones?',
          'company_constraints',
          !masterContext.companySnapshot.lowCoverage,
          masterContext.companySnapshot.lowCoverage
            ? 'La cobertura de contexto es baja; se presenta como hipotesis a confirmar, no como hard gate.'
            : 'El contexto empresarial sugiere revisar restricciones antes de avanzar.',
          masterContext.companySnapshot.sources ?? [],
          { contextDerived: true, confirmationRequired: true },
        );
      }
    }
    if (checkpointKey === 'CP-0.3') {
      add('core', 'Cual es la hipotesis prioritaria que debe validarse o decidirse?', 'priorityHypothesis', true, 'Step 0 debe cerrar con hipotesis o pregunta central.', ['PRD-03:9.4'], { allowsUnknown: false });
      add('previous_answer', 'Que evidencia o criterio permitiria tomar la siguiente decision?', 'decisionCriteria', true, 'El criterio de decision se deriva de respuestas previas y faltantes.', previousAnswers.map((_, i) => `checkpoint-response-${i + 1}`));
    }
    if (checkpointKey === 'CP-1.1') {
      add('core', 'Cual es la hipotesis principal que debe validarse primero?', 'mainHypothesis', true, 'Step 1 delimita una hipotesis principal antes de disenar evidencia.', ['Step0AlignmentBrief'], { allowsUnknown: false });
      add('core', 'Cual es el supuesto critico detras de esa hipotesis?', 'criticalAssumption', true, 'El plan de evidencia depende del supuesto con mayor riesgo.', ['PRD-03:CP-1.1'], { allowsUnknown: false });
      add('core', 'Que pregunta de aprendizaje debe responder la evidencia?', 'learningQuestion', true, 'Toda evidencia debe conectar con una pregunta verificable.', ['PRD-03:CP-1.1'], { allowsUnknown: false });
      add('core', 'Que riesgo existe si se equivocan en esta hipotesis?', 'riskOfBeingWrong', true, 'El riesgo prioriza profundidad y metodo.', ['PRD-03:CP-1.1']);
      add('core', 'Que decision depende de esta evidencia?', 'dependentDecision', true, 'Step 1 debe preparar una decision posterior explicita.', ['Step0AlignmentBrief']);
      if (masterContext.companySnapshot) {
        const influence = this.buildCompanyInfluence(masterContext.companySnapshot, 'validators');
        add('company_context', 'Que actor de empresa debe validar o abrir acceso para esta evidencia?', 'companyValidator', false, influence.reason, influence.sourceRefs, { contextDerived: true, confirmationRequired: influence.confirmationStatus !== 'confirmed' });
      }
    }
    if (checkpointKey === 'CP-1.2') {
      add('method_catalog', 'Que metodo usaran para conseguir evidencia suficiente?', 'methods', true, 'El metodo debe corresponder a hipotesis, reto, empresa, restricciones y acceso.', ['PRD-03:CP-1.2'], { answerType: 'multi_choice', allowsUnknown: false });
      add('core', 'Que fuentes y actores participaran?', 'sourcesAndActors', true, 'El plan exige fuentes, actores y responsables.', ['PRD-03:CP-1.2']);
      add('core', 'Quien es responsable y en que fechas se conseguira la evidencia?', 'responsibleAndDates', true, 'Sin responsable y fechas el plan no es ejecutable.', ['PRD-03:CP-1.2'], { answerType: 'date' });
      add('core', 'Que evidencia esperan obtener y cual es el criterio de suficiencia?', 'expectedEvidenceAndSufficiency', true, 'El criterio evita cerrar Step 1 por opinion.', ['PRD-03:CP-1.2']);
    }
    if (checkpointKey === 'CP-1.3') {
      add('core', 'Que evidencias capturaron? Incluye archivos, links, texto, metricas, entrevistas, observaciones o documentos.', 'evidenceItems', true, 'Step 1 requiere evidencia explicita antes de sintetizar.', ['PRD-03:CP-1.3'], { allowsUnknown: false });
      add('core', 'Clasifica cada evidencia como supports, contradicts, weak_signal, insufficient, context o new_uncertainty.', 'evidenceClassifications', true, 'La clasificacion alimenta contradicciones y suficiencia.', ['PRD-03:CP-1.3'], { allowsUnknown: false });
      add('core', 'Que sourceRefs respaldan cada conclusion?', 'sourceRefs', true, 'Toda conclusion debe preservar referencias de fuente.', ['PRD-03:CP-1.3'], { allowsUnknown: false });
    }
    if (checkpointKey === 'CP-1.4') {
      add('core', 'Cuales son los hechos, contradicciones, vacios y aprendizajes principales?', 'synthesis', true, 'La sintesis debe separar evidencia de interpretacion.', ['EvidenceMap'], { allowsUnknown: false });
      add('core', 'Cual es el foco actualizado y que hipotesis pasa a Step 2?', 'updatedFocusAndHypothesis', true, 'Step 2 se configura desde este foco confirmado.', ['ValidationFocus', 'EvidenceMap'], { allowsUnknown: false });
      add('core', 'Decision de continuidad: mantener, acotar, reformular, cambiar, pausar, cerrar o avanzar con observaciones.', 'continuityDecision', true, 'Step 1 no cierra sin decision revisada por usuario.', ['PRD-03:CP-1.4'], { allowsUnknown: false });
    }
    if (checkpointKey === 'CP-2.1') {
      add('previous_answer', 'Cual es el resultado esperado de la apuesta?', 'expectedOutcome', true, 'Los criterios de diseno parten del foco confirmado de Step 1.', ['Step1ConfirmedOutput'], { allowsUnknown: false });
      add('core', 'Define criterios de exito, evidencia esperada y tiempo hasta senal.', 'successCriteria', true, 'Step 2 necesita criterios para comparar alternativas.', ['PRD-03:CP-2.1'], { allowsUnknown: false });
      add('core', 'Que restricciones, guardrails y condiciones no negociables aplican?', 'constraintsGuardrails', true, 'La seleccion debe respetar restricciones y guardrails.', ['Step1ConfirmedOutput']);
      add('core', 'Cual es el nivel de reversibilidad de la apuesta?', 'reversibilityLevel', true, 'La reversibilidad ajusta riesgo y modalidad de prueba.', ['PRD-03:CP-2.1'], { answerType: 'single_choice' });
      if (masterContext.companySnapshot) {
        const influence = this.buildCompanyInfluence(masterContext.companySnapshot, 'guardrails');
        add('company_context', 'Confirma que guardrails empresariales deben afectar el diseno.', 'companyGuardrails', false, influence.reason, influence.sourceRefs, { contextDerived: true, confirmationRequired: influence.confirmationStatus !== 'confirmed' });
      }
    }
    if (checkpointKey === 'CP-2.2') {
      add('method_catalog', 'Registra o genera alternativas suficientes para esta ruta, incluyendo opcion de no hacer nada si aplica.', 'alternatives', true, 'No se exige idear 10 opciones; se comparan alternativas pertinentes.', ['PRD-03:CP-2.2'], { allowsUnknown: false });
      add('route', 'Que modalidad aplica: build, buy, partner, implementar, coordinar, recuperar o no hacer nada?', 'implementationModes', true, 'La modalidad cambia por routeType y madurez.', [String(masterContext.routeType ?? '')], { answerType: 'multi_choice' });
      add('previous_answer', 'Que evidenceRefs respaldan cada alternativa?', 'alternativeEvidenceRefs', true, 'Las alternativas deben preservar trazabilidad a evidencia.', ['EvidenceMap'], { allowsUnknown: false });
    }
    if (checkpointKey === 'CP-2.3') {
      add('core', 'Compara alternativas por valor, alineamiento, factibilidad, viabilidad, riesgo, reversibilidad, tiempo hasta senal, carga operativa y compatibilidad empresarial.', 'comparison', true, 'La apuesta seleccionada debe tener comparacion explicita.', ['AlternativeSet'], { allowsUnknown: false });
      add('core', 'Cual es la apuesta principal, cual es el backup y por que?', 'selectedBet', true, 'El output requiere apuesta, backup y justificacion.', ['PRD-03:CP-2.3'], { allowsUnknown: false });
      add('previous_answer', 'Que supuestos, riesgos y evidenceRefs sustentan la seleccion?', 'selectedBetEvidenceRefs', true, 'La seleccion debe preservar evidencia y supuestos.', ['EvidenceMap', 'AlternativeSet'], { allowsUnknown: false });
    }
    if (checkpointKey === 'CP-2.4') {
      add('route', 'Describe la prueba o ejecucion: alcance, participantes, baseline, metrica, umbral y duracion.', 'executionDesign', true, 'Cada ruta produce un diseno ejecutable.', [String(masterContext.routeType ?? '')], { allowsUnknown: false });
      add('core', 'Quienes son responsables, que recursos se requieren y que evidencia se capturara?', 'ownersResourcesEvidence', true, 'El diseno debe poder ejecutarse y medirse.', ['SelectedBet']);
      add('core', 'Define riesgos, guardrails y criterio Go/No-Go.', 'goNoGoCriteria', true, 'El cierre de Step 2 prepara la decision futura.', ['PRD-03:CP-2.4'], { allowsUnknown: false });
    }
    if (checkpointKey === 'CP-2.5') {
      add('core', 'Confirma owner, tiempo, recursos, datos, tecnologia, permisos, seguridad y presupuesto.', 'readinessChecklist', true, 'Readiness se activa para iniciativas complejas, transversales, reguladas, con dependencias, implementacion o alto riesgo.', ['PRD-03:CP-2.5'], { allowsUnknown: false });
      add('core', 'Que dependencias, bloqueos y plan alternativo quedan?', 'dependenciesAndFallback', true, 'Sin plan alternativo, una apuesta riesgosa no debe avanzar sin observaciones.', ['SelectedBet']);
    }
    if (checkpointKey === 'CP-3.1') {
      add('previous_answer', 'Confirma hipotesis, prueba o plan, alcance, baseline, metrica, umbral y guardrails transferidos desde Step 2.', 'step3TransferConfirmation', true, 'Step 3 se configura desde el output confirmado de Step 2.', ['Step2ConfirmedOutput'], { allowsUnknown: false });
      add('core', 'Que requisitos ya estan cumplidos para ejecutar y cuales faltan?', 'executionReadinessChecklist', true, 'CP-3.1 genera ExecutionReadiness antes de operar.', ['PRD-03:CP-3.1'], { allowsUnknown: false });
      add('core', 'Que permisos, dependencias, bloqueos, actores requeridos y fallbackPlan aplican?', 'executionDependencies', true, 'La ejecucion debe distinguir quick wins de implementaciones complejas y hard gates.', ['Step2Readiness'], { allowsUnknown: false });
    }
    if (checkpointKey === 'CP-3.2') {
      add('core', 'Registra actividades, mediciones, observaciones, entrevistas, incidentes, decisiones o evidencias relevantes de ejecucion.', 'executionRecords', true, 'CP-3.2 registra hechos relevantes, no cada clic ni edicion menor.', ['PRD-03:CP-3.2'], { allowsUnknown: false });
      add('core', 'Que sourceRefs o evidenceRefs respaldan esos registros?', 'executionSourceRefs', true, 'Los registros operativos deben preservar trazabilidad.', ['ExecutionLog'], { allowsUnknown: false });
      add('core', 'Hubo cambios de alcance, hipotesis, dependencias o riesgos criticos?', 'criticalExecutionChanges', false, 'Los cambios criticos alimentan CriticalChangeReview.', ['CriticalChangeReview']);
    }
    if (checkpointKey === 'CP-3.3') {
      add('core', 'Compara baseline, resultado, umbral, adopcion, esfuerzo, carga operativa, riesgos y efectos no previstos.', 'resultComparison', true, 'CP-3.3 analiza resultado contra el diseno de ejecucion.', ['ExecutionDesign', 'ExecutionLog'], { allowsUnknown: false });
      add('core', 'Clasifica la hipotesis y separa evidencia que apoya, contradice o limita la interpretacion.', 'hypothesisClassification', true, 'La IA puede proponer interpretacion, pero el usuario debe confirmarla.', ['PRD-03:CP-3.3'], { allowsUnknown: false });
      add('core', 'Confirma interpretacion, limitaciones y efectos inesperados.', 'confirmedInterpretation', true, 'Step 3 no debe avanzar a decision sin interpretacion confirmada.', ['ExperimentResultAnalysis'], { allowsUnknown: false });
    }
    if (checkpointKey === 'CP-3.4') {
      add('core', 'Elige decision: iterate, repeat_test, expand_sample, change_scope, pivot, scale_pilot, continue_implementation, transfer, integrate_to_roadmap, pause, close_with_learning o reformulate_challenge.', 'decision', true, 'Step 3 no cierra automaticamente; requiere decision del usuario.', ['PRD-03:CP-3.4'], { answerType: 'single_choice', allowsUnknown: false });
      add('core', 'Explica rationale, riesgos, incertidumbres restantes, nextAction, owner, dueDate y requiredApprover.', 'decisionDetails', true, 'La decision debe ser ejecutable y trazable.', ['ExperimentResultAnalysis'], { allowsUnknown: false });
      add('previous_answer', 'Que evidenceRefs sustentan la decision?', 'decisionEvidenceRefs', true, 'La decision debe estar respaldada por evidencia.', ['ExecutionLog', 'ExperimentResultAnalysis'], { allowsUnknown: false });
    }
    if (checkpointKey === 'CP-3.5') {
      add('core', 'Confirma owner futuro, soporte, mantenimiento, infraestructura, seguridad, presupuesto, adopcion, documentacion, metricas, rollback y aceptacion del area receptora.', 'operationalReadinessChecklist', true, 'CP-3.5 solo aplica cuando la decision operacionaliza o escala.', ['PRD-03:CP-3.5'], { allowsUnknown: false });
      add('core', 'Que bloqueos, aprobadores o plan alternativo quedan para operacionalizar?', 'operationalBlockers', true, 'El escalamiento no debe avanzar sin readiness operacional visible.', ['Step3Decision'], { allowsUnknown: false });
    }
    if (checkpointKey === 'CP-4.1') {
      add('previous_answer', 'Confirma decision, resultados, evidencia, limitaciones, riesgos, proximo paso, owner y aprobador transferidos desde Step 3.', 'step4TransferConfirmation', true, 'Step 4 se configura desde output confirmado de Step 3.', ['Step3ConfirmedOutput'], { allowsUnknown: false });
      add('core', 'Quien es la audiencia primaria, decision maker, audiencias secundarias y deadline?', 'decisionAudience', true, 'CP-4.1 define audiencia y decision solicitada antes de redactar narrativa.', ['PRD-03:CP-4.1'], { allowsUnknown: false });
      add('core', 'Que decision se solicita, que evidencia requieren, que objeciones anticipan y que formato prefieren?', 'audienceDecisionNeeds', true, 'El paquete debe responder a necesidades reales de decision, no forzar pitch.', ['Step3Decision'], { allowsUnknown: false });
    }
    if (checkpointKey === 'CP-4.2') {
      add('core', 'Redacta narrativa con contexto, foco, hipotesis, apuesta, ejecucion, resultados, aprendizajes, contradicciones, riesgos, limitaciones, recomendacion y proximo paso.', 'evidenceNarrative', true, 'CP-4.2 produce narrativa respaldada por evidencia.', ['PRD-03:CP-4.2'], { allowsUnknown: false });
      add('previous_answer', 'Que evidenceRefs/sourceRefs respaldan las afirmaciones criticas y que limitaciones mantienen?', 'narrativeEvidenceRefs', true, 'Toda afirmacion critica debe preservar trazabilidad y confianza.', ['Step3Output'], { allowsUnknown: false });
    }
    if (checkpointKey === 'CP-4.3') {
      add('route', 'Define el siguiente horizonte segun decision: roadmap, transferencia, operacion, iteracion o cierre.', 'nextHorizonPlan', true, 'CP-4.3 materializa el plan posterior adecuado al decisionType.', ['Step3Decision'], { allowsUnknown: false });
      add('core', 'Incluye fases, alcance, owner, recursos, inversion, gobernanza, adopcion, riesgos, metricas, hitos, dependencias, rollback y seguimiento segun aplique.', 'nextHorizonDetails', true, 'El horizonte debe ser ejecutable pero minimo.', ['PRD-03:CP-4.3'], { allowsUnknown: false });
    }
    if (checkpointKey === 'CP-4.4') {
      add('core', 'Que artefactos minimos necesita esta audiencia: one-pager, memo, business case, pilot report, deck outline, implementation plan, handoff, learning report o closure report?', 'decisionArtifacts', true, 'No se generan todos los artefactos por defecto.', ['PRD-03:CP-4.4'], { allowsUnknown: false });
      add('previous_answer', 'Confirma version, autor, fecha, limitaciones y evidenceRefs por artefacto.', 'artifactTraceability', true, 'Cada artefacto debe ser editable y trazable.', ['EvidenceBackedNarrative'], { allowsUnknown: false });
    }
    if (checkpointKey === 'CP-4.5') {
      add('core', 'Registra transferencia, decision final o cierre: receptor, aceptacion, recursos, documentacion, capacitacion, soporte, permisos, fecha, metricas y seguimiento segun aplique.', 'transferOrClosure', true, 'CP-4.5 materializa transferencia o cierre organizacional.', ['PRD-03:CP-4.5'], { allowsUnknown: false });
      add('core', 'Confirma estado final: completed, transferred, scaled, integrated_to_roadmap, closed_with_learning, paused, new_iteration_required, pivoted, seeking_capability o benefit_tracking.', 'finalState', true, 'El estado final se separa de resultado de hipotesis y contribucion al reto.', ['PRD-03:Estados finales'], { answerType: 'single_choice', allowsUnknown: false });
      add('challenge_context', 'Como cambia la cobertura del reto sin marcarlo automaticamente como resuelto?', 'challengeCoverageUpdate', false, 'La cobertura final se actualiza con contribucion, evidencia, solapamiento y metricas.', ['ChallengeContribution']);
    }
    return questions;
  }

  private async materializeCheckpointTx(tx: any, projectId: string, config: any, checkpointKey: string, previousAnswers: Record<string, unknown>[], userId?: string, idempotencyKey?: string) {
    const spec = [...STEP0_CHECKPOINTS, ...STEP1_CHECKPOINTS, ...STEP2_CHECKPOINTS, ...STEP3_CHECKPOINTS, ...STEP4_CHECKPOINTS].find((cp) => cp.key === checkpointKey);
    if (!spec) throw new Error(`Unsupported checkpoint ${checkpointKey}`);
    if (!config?.cycleId) throw AppError.badRequest('La configuracion activa no tiene ciclo.', 'CONFIGURATION_CYCLE_MISSING');
    if (config.projectId && config.projectId !== projectId) throw AppError.badRequest('La configuracion no pertenece a la iniciativa.', 'CONFIG_PROJECT_MISMATCH');
    const exists = await tx.adaptiveCheckpointInstance.findFirst({ where: { projectId, cycleId: config.cycleId, stepConfigurationId: config.id, checkpointKey } });
    if (exists) return exists;
    const questions = this.buildQuestions(checkpointKey, config.version, config.sourceContextJson ?? {}, previousAnswers);
    const created = await tx.adaptiveCheckpointInstance.create({
      data: {
        projectId,
        cycleId: config.cycleId,
        stepConfigurationId: config.id,
        stepNumber: checkpointKey.startsWith('CP-4') ? 4 : checkpointKey.startsWith('CP-3') ? 3 : checkpointKey.startsWith('CP-2') ? 2 : checkpointKey.startsWith('CP-1') ? 1 : 0,
        checkpointKey,
        sequence: spec.sequence,
        status: 'ready',
        materializedQuestionsJson: questions,
        idempotencyKey,
      },
    });
    await this.recordEventTx(tx, projectId, 'checkpoint_started', `${checkpointKey} iniciado.`, { checkpointKey, questionCount: questions.length }, userId, idempotencyKey ? `${idempotencyKey}:event` : undefined);
    return created;
  }

  private evaluateCheckpoint(checkpointKey: string, responses: Record<string, unknown>, previous: Record<string, unknown>[], masterContext?: any) {
    // Para los checkpoints planificados, el gate lo calcula el mismo motor que armo las
    // preguntas: si una variable ya venia resuelta del contexto, no puede bloquear.
    if (CHECKPOINT_VARIABLES[checkpointKey]) {
      const missing = missingRequiredVariables(checkpointKey, masterContext ?? {}, previous, responses);
      return { sufficient: missing.length === 0, missing, previousResponseCount: previous.length };
    }
    const requiredByCheckpoint: Record<string, string[]> = {
      'CP-0.1': ['objective'],
      'CP-0.2': ['scope', 'owner_and_actor_required'],
      'CP-0.3': ['priorityHypothesis', 'decisionCriteria'],
      'CP-1.1': ['mainHypothesis', 'criticalAssumption', 'learningQuestion', 'riskOfBeingWrong', 'dependentDecision'],
      'CP-1.2': ['methods', 'sourcesAndActors', 'responsibleAndDates', 'expectedEvidenceAndSufficiency'],
      'CP-1.3': ['evidenceItems', 'evidenceClassifications', 'sourceRefs'],
      'CP-1.4': ['synthesis', 'updatedFocusAndHypothesis', 'continuityDecision'],
      'CP-2.1': ['expectedOutcome', 'successCriteria', 'constraintsGuardrails', 'reversibilityLevel'],
      'CP-2.2': ['alternatives', 'implementationModes', 'alternativeEvidenceRefs'],
      'CP-2.3': ['comparison', 'selectedBet', 'selectedBetEvidenceRefs'],
      'CP-2.4': ['executionDesign', 'ownersResourcesEvidence', 'goNoGoCriteria'],
      'CP-2.5': ['readinessChecklist', 'dependenciesAndFallback'],
      'CP-3.1': ['step3TransferConfirmation', 'executionReadinessChecklist', 'executionDependencies'],
      'CP-3.2': ['executionRecords', 'executionSourceRefs'],
      'CP-3.3': ['resultComparison', 'hypothesisClassification', 'confirmedInterpretation'],
      'CP-3.4': ['decision', 'decisionDetails', 'decisionEvidenceRefs'],
      'CP-3.5': ['operationalReadinessChecklist', 'operationalBlockers'],
      'CP-4.1': ['step4TransferConfirmation', 'decisionAudience', 'audienceDecisionNeeds'],
      'CP-4.2': ['evidenceNarrative', 'narrativeEvidenceRefs'],
      'CP-4.3': ['nextHorizonPlan', 'nextHorizonDetails'],
      'CP-4.4': ['decisionArtifacts', 'artifactTraceability'],
      'CP-4.5': ['transferOrClosure', 'finalState'],
    };
    const required = requiredByCheckpoint[checkpointKey] ?? [];
    const missing = required.filter((field) => !this.hasValue(responses[field]));
    return { sufficient: missing.length === 0, missing, previousResponseCount: previous.length };
  }

  private async evaluateCheckpointReadiness(projectId: string, checkpointKey: string, input: CheckpointResponseInput) {
    const policy = getCheckpointEvidencePolicy(checkpointKey);
    const truth = new TruthService(this.prisma);
    if (policy.requirements.includes('validated_support_required')) {
      const binding = this.normalizeTruthBindings(input.truthBindings) ?? this.extractTruthBindings(input.responses);
      if (!binding) {
        throw AppError.badRequest('Este checkpoint requiere binding explicito a Claim, Evidence y SourceRef persistentes.', 'CHECKPOINT_TRUTH_BINDING_REQUIRED');
      }
      const readiness = await truth.evaluateValidatedSupportBinding(projectId, binding);
      if (!readiness.satisfiesValidatedSupport) {
        const code = readiness.verificationState === 'contradicted'
          ? 'CHECKPOINT_CLAIM_CONTRADICTED'
          : readiness.verificationState === 'insufficient'
            ? 'CHECKPOINT_CLAIM_INSUFFICIENT'
            : 'CHECKPOINT_CLAIM_UNVALIDATED';
        throw AppError.badRequest('El Claim ligado al checkpoint no tiene soporte validado.', code, {
          details: [{ field: 'truthBindings.claimId', code, message: String(readiness.verificationState) }],
        });
      }
      return { policy, truthRequired: true, ...readiness };
    }
    if (!policy.requirements.includes('evidence_reference_required')) {
      return { policy, truthRequired: false, evidenceReferenceRequired: false, satisfiesValidatedSupport: null };
    }
    const binding = this.normalizeEvidenceReferenceBindings(input.evidenceBindings)
      ?? this.extractEvidenceReferenceBindings(input.responses)
      ?? this.evidenceReferenceFromTruthBinding(this.normalizeTruthBindings(input.truthBindings) ?? this.extractTruthBindings(input.responses));
    if (!binding) {
      throw AppError.badRequest('Este checkpoint requiere Evidence y SourceRef persistentes.', 'CHECKPOINT_EVIDENCE_REFERENCE_REQUIRED');
    }
    const reference = await truth.evaluateEvidenceReferenceBinding(projectId, binding);
    return { policy, truthRequired: false, evidenceReferenceRequired: true, ...reference, satisfiesValidatedSupport: null };
  }

  private responseWithPolicyBindings(responses: Record<string, unknown>, bindings?: unknown, evidenceBindings?: unknown) {
    const normalized = this.normalizeTruthBindings(bindings) ?? this.extractTruthBindings(responses);
    const normalizedEvidence = this.normalizeEvidenceReferenceBindings(evidenceBindings) ?? this.extractEvidenceReferenceBindings(responses);
    const {
      truthBinding: _truthBinding,
      truthBindings: _truthBindings,
      evidenceBinding: _evidenceBinding,
      evidenceBindings: _evidenceBindings,
      evidenceReferences: _evidenceReferences,
      ...rest
    } = responses as Record<string, unknown>;
    return {
      ...rest,
      ...(normalizedEvidence ? { evidenceBindings: normalizedEvidence } : {}),
      ...(normalized ? { truthBindings: normalized } : {}),
    };
  }

  private extractTruthBindings(responses: Record<string, unknown>): ValidatedSupportBindingInput | null {
    const raw = responses.truthBindings ?? responses.truthBinding;
    return this.normalizeTruthBindings(raw);
  }

  private normalizeTruthBindings(raw: unknown): ValidatedSupportBindingInput | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const record = raw as Record<string, unknown>;
    const claimId = typeof record.claimId === 'string' ? record.claimId.trim() : '';
    const evidenceIds = this.idList(record.evidenceIds ?? record.evidenceId);
    const sourceRefIds = this.idList(record.sourceRefIds ?? record.sourceRefId);
    if (!claimId || evidenceIds.length === 0 || sourceRefIds.length === 0) return null;
    return { claimId, evidenceIds, sourceRefIds };
  }

  private extractEvidenceReferenceBindings(responses: Record<string, unknown>): EvidenceReferenceBindingInput | null {
    const raw = responses.evidenceBindings ?? responses.evidenceBinding ?? responses.evidenceReferences ?? responses.truthBindings ?? responses.truthBinding ?? responses;
    return this.normalizeEvidenceReferenceBindings(raw);
  }

  private normalizeEvidenceReferenceBindings(raw: unknown): EvidenceReferenceBindingInput | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const record = raw as Record<string, unknown>;
    const evidenceIds = this.idList(record.evidenceIds ?? record.evidenceId);
    const sourceRefIds = this.idList(record.sourceRefIds ?? record.sourceRefId);
    if (evidenceIds.length === 0 || sourceRefIds.length === 0) return null;
    return { evidenceIds, sourceRefIds };
  }

  private evidenceReferenceFromTruthBinding(binding: ValidatedSupportBindingInput | null): EvidenceReferenceBindingInput | null {
    return binding ? { evidenceIds: binding.evidenceIds, sourceRefIds: binding.sourceRefIds } : null;
  }

  private idList(value: unknown): string[] {
    if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean);
    if (typeof value === 'string') return [value.trim()].filter(Boolean);
    return [];
  }

  private buildStep0Brief(masterContext: any, responses: Record<string, any>[]): Step0AlignmentBrief {
    const merged = Object.assign({}, ...responses);
    return {
      intention: String(merged.objective ?? masterContext.knownFacts?.[0] ?? ''),
      origin: String(merged.origin ?? 'revision_inicial'),
      challengeType: String(merged.challengeType ?? masterContext.challengeType ?? ''),
      objective: String(merged.objective ?? ''),
      scope: String(merged.scope ?? ''),
      inclusions: this.toList(merged.inclusions),
      exclusions: this.toList(merged.exclusions),
      output: String(merged.output ?? masterContext.decisions?.[0] ?? ''),
      adoption: String(merged.adoption ?? ''),
      outcome: String(merged.outcome ?? ''),
      actors: this.compact([merged.owner_and_actor_required, ...(masterContext.companySnapshot?.actors ?? []), masterContext.challengeSnapshot?.challengeOwner]),
      restrictions: this.compact([merged.company_constraints, ...(masterContext.companySnapshot?.restrictions ?? [])]),
      facts: masterContext.knownFacts ?? [],
      signals: this.compact([merged.availableEvidence, merged.signal, ...(masterContext.knownFacts ?? []).slice(1)]),
      assumptions: this.compact([...(masterContext.assumptions ?? []), merged.priorityHypothesis]),
      priorityHypothesis: String(merged.priorityHypothesis ?? masterContext.assumptions?.[0] ?? ''),
      validationQuestions: this.compact([merged.validationQuestion, ...(masterContext.missingCriticalInformation ?? [])]),
      decisionCriteria: String(merged.decisionCriteria ?? masterContext.decisions?.[0] ?? ''),
      availableEvidence: this.compact([merged.availableEvidence, merged.currentEvidence]),
      missingInformation: this.compact([...(masterContext.missingCriticalInformation ?? []), merged.missingInformation]),
    };
  }

  private async buildStep1Output(
    projectId: string,
    masterContext: any,
    responses: Record<string, any>[],
    checkpointResponses: { checkpointKey: string; responseJson: Record<string, any> }[] = [],
  ) {
    const merged = Object.assign({}, ...responses);
    const routeType = (masterContext.routeType ?? 'explore_validate') as AdaptiveRouteType;
    const outputKey = STEP1_OUTPUT_BY_ROUTE[routeType];
    const evidenceItems = this.normalizeEvidenceItems(merged.evidenceItems, merged.evidenceClassifications, merged.sourceRefs);
    const truthReadiness = await this.resolveStep1TruthReadiness(projectId, checkpointResponses);
    const classifications = evidenceItems.map((item) => item.classification);
    const contradictions = evidenceItems.filter((item) => item.classification === 'contradicts');
    const insufficient = evidenceItems.filter((item) => item.classification === 'insufficient' || item.classification === 'weak_signal');
    const supports = evidenceItems.filter((item) => item.classification === 'supports');
    const companyInfluences = this.buildCompanyInfluences(masterContext.companySnapshot);
    const methodologicalSufficiency = supports.length > 0 && contradictions.length === 0 && insufficient.length <= supports.length ? 'sufficient' : 'partial';
    const truthSupported = truthReadiness?.satisfiesValidatedSupport === true;
    const sufficiency = methodologicalSufficiency === 'sufficient' && truthSupported ? 'sufficient' : 'partial';
    const blocker = contradictions[0]?.summary ?? insufficient[0]?.summary ?? '';
    const validationFocus = {
      mainHypothesis: String(merged.mainHypothesis ?? merged.validationFocus ?? masterContext.step0Output?.priorityHypothesis ?? ''),
      criticalAssumption: String(merged.criticalAssumption ?? ''),
      learningQuestion: String(merged.learningQuestion ?? ''),
      riskOfBeingWrong: String(merged.riskOfBeingWrong ?? ''),
      dependentDecision: String(merged.dependentDecision ?? masterContext.step0Output?.decisionCriteria ?? ''),
      sourceRefs: ['Step0AlignmentBrief', ...this.sourceRefsFrom(merged.sourceRefs)],
    };
    const evidencePlan = {
      suggestedMethods: this.suggestEvidenceMethods(validationFocus.mainHypothesis, routeType, masterContext),
      methods: this.toList(merged.methods),
      sourcesAndActors: this.toList(merged.sourcesAndActors),
      responsibleAndDates: this.toList(merged.responsibleAndDates),
      expectedEvidenceAndSufficiency: String(merged.expectedEvidenceAndSufficiency ?? ''),
      companyInfluences,
    };
    const evidenceMap = {
      items: evidenceItems,
      classifications,
      conclusions: this.toList(merged.synthesis).map((conclusion, index) => ({
        conclusion,
        sourceRefs: evidenceItems[index]?.sourceRefs?.length ? evidenceItems[index].sourceRefs : this.sourceRefsFrom(merged.sourceRefs),
      })),
    };
    const updatedFocus = String(merged.updatedFocusAndHypothesis ?? validationFocus.mainHypothesis);
    const continuityDecision = String(merged.continuityDecision ?? 'avanzar_con_observaciones');
    return {
      outputKey,
      routeType,
      validationFocus,
      evidencePlan,
      evidenceMap,
      truthReadiness,
      facts: this.toList(merged.facts),
      contradictions: contradictions.map((item) => item.summary),
      gaps: this.compact([merged.gaps, ...insufficient.map((item) => item.summary)]),
      learning: String(merged.synthesis ?? ''),
      updatedFocus,
      hypothesisForStep2: updatedFocus,
      continuityDecision,
      methodologicalSufficiency,
      sufficiency,
      evidenceSummary: `${supports.length} evidencia(s) apoyan; ${contradictions.length} contradicen; ${insufficient.length} son debiles o insuficientes.`,
      blocker,
      actorRequired: String(merged.companyValidator ?? masterContext.companySnapshot?.actors?.[0] ?? masterContext.challengeSnapshot?.challengeOwner ?? 'Owner de iniciativa'),
      futureDecision: validationFocus.dependentDecision,
      sourceRefs: Array.from(new Set(['Step0AlignmentBrief', ...evidenceItems.flatMap((item) => item.sourceRefs)])),
      challengeContribution: masterContext.challengeSnapshot ? {
        challengeId: masterContext.challengeSnapshot.id,
        contribution: continuityDecision === 'cerrar' ? 'aprendizaje para reformular o cerrar' : 'evidencia para decidir foco del reto',
        evidenceStrength: sufficiency === 'sufficient' ? 'medium' : 'weak',
      } : null,
      createdAt: new Date().toISOString(),
    };
  }

  private async resolveStep1TruthReadiness(projectId: string, responses: { checkpointKey: string; responseJson: Record<string, any> }[]) {
    const cp13 = [...responses].reverse().find((response) => response.checkpointKey === 'CP-1.3');
    const binding = cp13 ? this.extractTruthBindings(cp13.responseJson) : null;
    if (!binding) {
      return {
        verificationState: 'missing',
        satisfiesValidatedSupport: false,
        claimId: null,
        evidenceIds: [],
        sourceRefIds: [],
      };
    }
    const readiness = await new TruthService(this.prisma).evaluateValidatedSupportBinding(projectId, binding);
    return {
      claimId: readiness.claimId,
      verificationState: readiness.verificationState,
      satisfiesValidatedSupport: readiness.satisfiesValidatedSupport,
      evidenceIds: readiness.evidenceIds,
      sourceRefIds: readiness.sourceRefIds,
    };
  }

  private contractualStep1Sufficiency(draftOutput: any, brief: Record<string, unknown>) {
    const truthReadiness = draftOutput?.truthReadiness ?? null;
    if (truthReadiness?.satisfiesValidatedSupport !== true) return 'partial';
    return String(draftOutput?.sufficiency ?? (brief as any)?.sufficiency ?? '') === 'sufficient' ? 'sufficient' : 'partial';
  }

  private buildStep2MasterContext(masterContext: any, step1Output: Record<string, any>) {
    return {
      ...masterContext,
      version: Number(masterContext.version ?? 1) + 1,
      step1Output,
      knownFacts: this.compact([...(masterContext.knownFacts ?? []), ...(step1Output.facts ?? []), step1Output.evidenceSummary]),
      assumptions: this.compact([step1Output.hypothesisForStep2, ...(masterContext.assumptions ?? [])]),
      missingCriticalInformation: this.compact([...(step1Output.gaps ?? []), ...(masterContext.missingCriticalInformation ?? [])]),
      risks: this.compact([step1Output.blocker, ...(masterContext.risks ?? [])]),
      decisions: this.compact([step1Output.futureDecision, step1Output.continuityDecision, ...(masterContext.decisions ?? [])]),
      step2Transfer: {
        focus: step1Output.updatedFocus,
        hypothesis: step1Output.hypothesisForStep2,
        evidence: step1Output.evidenceMap,
        truthReadiness: step1Output.truthReadiness ?? null,
        restrictions: masterContext.step0Output?.restrictions ?? [],
        criteria: step1Output.validationFocus?.dependentDecision ?? step1Output.futureDecision,
        baseline: step1Output.evidenceSummary,
        actors: this.compact([step1Output.actorRequired, ...(masterContext.step0Output?.actors ?? [])]),
        futureDecision: step1Output.futureDecision,
      },
    };
  }

  private buildStep2Output(masterContext: any, responses: Record<string, any>[]) {
    const merged = Object.assign({}, ...responses);
    const routeType = (masterContext.routeType ?? 'explore_validate') as AdaptiveRouteType;
    const step1Output = masterContext.step1Output ?? {};
    const outputKey = STEP2_OUTPUT_BY_ROUTE[routeType];
    const designCriteria = {
      expectedOutcome: String(merged.expectedOutcome ?? step1Output.updatedFocus ?? ''),
      successCriteria: this.toList(merged.successCriteria),
      constraints: this.compact([merged.constraintsGuardrails, ...(step1Output.validationFocus?.restrictions ?? []), ...(masterContext.step2Transfer?.restrictions ?? [])]),
      guardrails: this.compact([merged.companyGuardrails, ...(masterContext.companySnapshot?.restrictions ?? [])]),
      nonNegotiables: this.toList(merged.nonNegotiables ?? merged.constraintsGuardrails),
      reversibilityLevel: String(merged.reversibilityLevel ?? 'medium'),
      timeToSignal: String(merged.timeToSignal ?? merged.successCriteria ?? ''),
      expectedEvidence: this.toList(merged.expectedEvidence ?? merged.successCriteria),
      companyInfluences: this.buildCompanyInfluences(masterContext.companySnapshot),
    };
    const alternatives = this.normalizeAlternatives(merged.alternatives, merged.alternativeEvidenceRefs, routeType);
    const selectedBet = this.normalizeSelectedBet(merged.selectedBet, alternatives, merged.selectedBetEvidenceRefs, merged.comparison);
    const execution = this.normalizeExecutionDesign(merged.executionDesign, merged.ownersResourcesEvidence, merged.goNoGoCriteria, selectedBet, routeType, step1Output);
    const readiness = this.buildReadiness(merged.readinessChecklist, merged.dependenciesAndFallback, masterContext, execution);
    const evidenceUsed = Array.from(new Set([
      ...this.sourceRefsFrom(merged.alternativeEvidenceRefs),
      ...this.sourceRefsFrom(merged.selectedBetEvidenceRefs),
      ...(step1Output.sourceRefs ?? []),
    ]));
    const risks = this.compact([merged.risks, ...(step1Output.contradictions ?? []), readiness.blockers]);
    return {
      outputKey,
      routeType,
      designCriteria,
      alternativeSet: {
        routeType,
        alternatives,
        generationRule: routeType === 'lightweight_plan' ? 'lightweight_not_10_ideas' : 'fit_for_route_not_fixed_count',
      },
      selectedBet,
      executionDesign: execution,
      readiness,
      hypothesis: String(selectedBet.hypothesis ?? step1Output.hypothesisForStep2 ?? step1Output.updatedFocus ?? ''),
      testOrExecution: execution.testOrExecution,
      scope: execution.scope,
      participants: execution.participants,
      baseline: execution.baseline,
      metric: execution.metric,
      threshold: execution.threshold,
      duration: execution.duration,
      responsibles: execution.responsibles,
      resources: execution.resources,
      evidence: execution.evidence,
      evidenceUsed,
      guardrails: designCriteria.guardrails,
      goNoGoCriteria: execution.goNoGoCriteria,
      risks,
      challengeContribution: masterContext.challengeSnapshot ? {
        challengeId: masterContext.challengeSnapshot.id,
        selectedBet: selectedBet.primary,
        contribution: `Apuesta ${selectedBet.primary} aporta evidencia para ${masterContext.challengeSnapshot.title ?? 'el reto'}.`,
        evidenceStrength: evidenceUsed.length > 0 ? 'medium' : 'weak',
      } : null,
      createdAt: new Date().toISOString(),
    };
  }

  private buildStep3MasterContext(masterContext: any, step2Output: Record<string, any>) {
    return {
      ...masterContext,
      version: Number(masterContext.version ?? 1) + 1,
      step2Output,
      knownFacts: this.compact([...(masterContext.knownFacts ?? []), ...(step2Output.evidenceUsed ?? [])]),
      assumptions: this.compact([step2Output.hypothesis, ...(masterContext.assumptions ?? [])]),
      missingCriticalInformation: this.compact([...(step2Output.readiness?.blockers ?? []), ...(masterContext.missingCriticalInformation ?? [])]),
      risks: this.compact([...(step2Output.risks ?? []), ...(masterContext.risks ?? [])]),
      decisions: this.compact([step2Output.goNoGoCriteria, ...(masterContext.decisions ?? [])]),
      step3Transfer: {
        selectedBet: step2Output.selectedBet,
        hypothesis: step2Output.hypothesis,
        executionDesign: step2Output.executionDesign,
        readiness: step2Output.readiness,
        goNoGoCriteria: step2Output.goNoGoCriteria,
      },
    };
  }

  private buildStep3Output(masterContext: any, responses: Record<string, any>[]) {
    const merged = Object.assign({}, ...responses);
    const routeType = (masterContext.routeType ?? 'explore_validate') as AdaptiveRouteType;
    const step2Output = masterContext.step2Output ?? {};
    const executionDesign = step2Output.executionDesign ?? {};
    const outputKey = STEP3_OUTPUT_BY_ROUTE[routeType];
    const executionReadiness = this.buildExecutionReadiness(merged, masterContext, step2Output);
    const executionLog = this.buildExecutionLog(merged, masterContext);
    const resultAnalysis = this.buildResultAnalysis(merged, executionLog, step2Output);
    const decision = this.buildStep3Decision(merged, resultAnalysis, executionDesign);
    const operationalReadiness = this.shouldActivateOperationalReadiness(masterContext, responses)
      ? this.buildOperationalReadiness(merged, decision, executionReadiness)
      : null;
    const challengeContribution = this.buildStep3ChallengeContribution(masterContext, step2Output, resultAnalysis, decision);
    return {
      outputKey,
      routeType,
      hypothesis: String(step2Output.hypothesis ?? executionDesign.hypothesis ?? ''),
      selectedBet: step2Output.selectedBet ?? null,
      executionSummary: {
        testOrExecution: String(step2Output.testOrExecution ?? executionDesign.testOrExecution ?? ''),
        scope: String(step2Output.scope ?? executionDesign.scope ?? ''),
        baseline: String(step2Output.baseline ?? executionDesign.baseline ?? ''),
        metric: String(step2Output.metric ?? executionDesign.metric ?? ''),
        threshold: String(step2Output.threshold ?? executionDesign.threshold ?? ''),
        participants: this.toList(step2Output.participants ?? executionDesign.participants),
        responsibles: this.toList(step2Output.responsibles ?? executionDesign.responsibles),
        guardrails: this.toList(step2Output.guardrails ?? executionDesign.guardrails),
        expectedEvidence: this.toList(step2Output.evidence ?? executionDesign.evidence),
      },
      executionReadiness,
      executionLog,
      resultAnalysis,
      decision,
      operationalReadiness,
      sourceRefs: Array.from(new Set([
        ...(step2Output.evidenceUsed ?? []),
        ...this.sourceRefsFrom(merged.executionSourceRefs),
        ...this.sourceRefsFrom(merged.decisionEvidenceRefs),
      ])),
      challengeContribution,
      createdAt: new Date().toISOString(),
    };
  }

  private buildExecutionReadiness(merged: Record<string, any>, masterContext: any, step2Output: Record<string, any>) {
    const checklist = this.toList(merged.executionReadinessChecklist);
    const dependencies = this.toList(merged.executionDependencies);
    const lowCoverage = Boolean(masterContext.companySnapshot?.lowCoverage);
    const criticalRestriction = this.compact([...(masterContext.companySnapshot?.restrictions ?? []), ...(step2Output.guardrails ?? [])])
      .some((item) => /critica|critico|seguridad|regulad|legal|permiso|hard gate/i.test(item));
    const missing = checklist.filter((item) => this.isReadinessGap(item));
    const blockers = criticalRestriction
      ? this.compact([dependencies.filter((item) => this.isReadinessBlocker(item)), missing])
      : dependencies.filter((item) => this.isReadinessBlocker(item) && /bloque/i.test(item));
    const status = blockers.length > 0 ? 'blocked' : missing.length > 0 ? 'ready_with_observations' : 'ready';
    return {
      readinessStatus: status,
      reviewMode: step2Output.readiness?.required || masterContext.depthLevel === 'extended' || criticalRestriction ? 'expanded' : 'lightweight',
      fulfilledRequirements: checklist.filter((item) => !missing.includes(item)),
      missingRequirements: lowCoverage ? missing.map((item) => `${item} (confirmable)`) : missing,
      blockers,
      actorsRequired: this.compact([merged.actorRequired, step2Output.responsibles?.[0], masterContext.challengeSnapshot?.challengeOwner]),
      permissions: dependencies.filter((item) => /permiso|aprob/i.test(item)),
      dependencies,
      fallbackPlan: dependencies.find((item) => /fallback|alternativo|plan b/i.test(item)) ?? step2Output.readiness?.fallbackPlan ?? '',
      hardGate: criticalRestriction && blockers.length > 0,
      companyContextLowCoverage: lowCoverage,
    };
  }

  private buildExecutionLog(merged: Record<string, any>, masterContext: any) {
    const refs = this.sourceRefsFrom(merged.executionSourceRefs);
    const records = this.normalizeExecutionRecords(merged.executionRecords, refs);
    const criticalChanges = this.toList(merged.criticalExecutionChanges).map((change, index) => this.buildCriticalChangeReview({
      idempotencyKey: `step3-critical-${index + 1}`,
      field: change.toLowerCase().includes('hipotes') ? 'hypothesis' : 'scope',
      previousValue: null,
      nextValue: change,
      reason: 'Detectado durante CP-3.2 Execution Log.',
      confirmed: true,
      action: 'update_route',
    } as CriticalChangeInput));
    return {
      records,
      deviations: records.filter((record) => /desvi|scope|alcance|incidente|riesgo/i.test(`${record.type} ${record.description}`)).map((record) => record.title),
      criticalChanges,
      sourceRefs: refs,
      challengeContext: masterContext.challengeSnapshot?.id ?? null,
    };
  }

  private buildResultAnalysis(merged: Record<string, any>, executionLog: Record<string, any>, step2Output: Record<string, any>) {
    const comparison = typeof merged.resultComparison === 'object' && merged.resultComparison !== null ? merged.resultComparison as Record<string, any> : {};
    const classification = this.normalizeHypothesisClassification(merged.hypothesisClassification, executionLog.records);
    const supportRefs = this.sourceRefsFrom(comparison.supportingEvidenceRefs ?? merged.supportingEvidenceRefs ?? merged.executionSourceRefs);
    const contradictRefs = this.sourceRefsFrom(comparison.contradictingEvidenceRefs ?? merged.contradictingEvidenceRefs);
    const limitations = this.toList(comparison.limitations ?? merged.limitations);
    const unexpectedEffects = this.toList(comparison.unexpectedEffects ?? merged.unexpectedEffects);
    const evidenceStrength = classification === 'supported'
      ? 'strong'
      : classification === 'partially_supported' || classification === 'mixed_signal'
        ? 'medium'
        : supportRefs.length || contradictRefs.length
          ? 'weak'
          : 'insufficient';
    return {
      baseline: String(comparison.baseline ?? step2Output.baseline ?? ''),
      result: String(comparison.result ?? comparison.outcome ?? ''),
      threshold: String(comparison.threshold ?? step2Output.threshold ?? ''),
      adoption: String(comparison.adoption ?? ''),
      effort: String(comparison.effort ?? ''),
      operationalLoad: String(comparison.operationalLoad ?? comparison.cargaOperativa ?? ''),
      risks: this.toList(comparison.risks ?? step2Output.risks),
      unexpectedEffects,
      classification,
      evidenceStrength,
      supportingEvidenceRefs: supportRefs,
      contradictingEvidenceRefs: contradictRefs,
      limitations,
      interpretation: String(merged.confirmedInterpretation ?? comparison.interpretation ?? `Resultado clasificado como ${classification}.`),
      userConfirmed: this.hasValue(merged.confirmedInterpretation),
    };
  }

  private buildStep3Decision(merged: Record<string, any>, resultAnalysis: Record<string, any>, executionDesign: Record<string, any>) {
    const details = typeof merged.decisionDetails === 'object' && merged.decisionDetails !== null ? merged.decisionDetails as Record<string, any> : {};
    const rawDecision = typeof merged.decision === 'object' && merged.decision !== null ? merged.decision as Record<string, any> : { decision: merged.decision };
    const decision = String(rawDecision.decision ?? rawDecision.type ?? merged.decision ?? 'iterate');
    return {
      decision,
      rationale: String(rawDecision.rationale ?? details.rationale ?? resultAnalysis.interpretation ?? ''),
      evidenceRefs: this.sourceRefsFrom(rawDecision.evidenceRefs ?? details.evidenceRefs ?? merged.decisionEvidenceRefs),
      risks: this.toList(rawDecision.risks ?? details.risks ?? resultAnalysis.risks),
      remainingUncertainties: this.toList(rawDecision.remainingUncertainties ?? details.remainingUncertainties ?? resultAnalysis.limitations),
      nextAction: String(rawDecision.nextAction ?? details.nextAction ?? executionDesign.goNoGoCriteria ?? ''),
      owner: String(rawDecision.owner ?? details.owner ?? executionDesign.responsibles?.[0] ?? 'Owner de iniciativa'),
      dueDate: String(rawDecision.dueDate ?? details.dueDate ?? ''),
      requiredApprover: String(rawDecision.requiredApprover ?? details.requiredApprover ?? ''),
    };
  }

  private buildOperationalReadiness(merged: Record<string, any>, decision: Record<string, any>, executionReadiness: Record<string, any>) {
    const checklist = this.toList(merged.operationalReadinessChecklist);
    const blockers = this.compact([
      checklist.filter((item) => this.isReadinessGap(item)),
      this.toList(merged.operationalBlockers).filter((item) => this.isReadinessGap(item) || this.isReadinessBlocker(item)),
    ]);
    return {
      required: true,
      status: blockers.length > 0 ? 'blocked' : 'ready_with_observations',
      futureOwner: checklist.find((item) => /owner|dueno|responsable/i.test(item)) ?? decision.owner,
      support: checklist.filter((item) => /soporte|mantenimiento/i.test(item)),
      infrastructure: checklist.filter((item) => /infra|tecnolog/i.test(item)),
      security: checklist.filter((item) => /seguridad|permiso/i.test(item)),
      budget: checklist.filter((item) => /presupuesto|costo/i.test(item)),
      adoption: checklist.filter((item) => /adopcion|aceptacion/i.test(item)),
      documentation: checklist.filter((item) => /document/i.test(item)),
      metrics: checklist.filter((item) => /metrica|metric/i.test(item)),
      rollback: checklist.find((item) => /rollback|reversa|retroceso/i.test(item)) ?? executionReadiness.fallbackPlan ?? '',
      receivingAreaAcceptance: checklist.find((item) => /area receptora|aceptacion/i.test(item)) ?? '',
      blockers,
      requiredApprover: decision.requiredApprover,
    };
  }

  private isReadinessGap(item: string) {
    const normalized = item.trim().toLowerCase();
    if (/^sin (faltantes|pendientes|bloqueos|riesgos)/i.test(normalized)) {
      return false;
    }
    return /falt|pendiente|sin |no confirmado|bloque|riesgo/i.test(item);
  }

  private isReadinessBlocker(item: string) {
    const normalized = item.trim().toLowerCase();
    if (/^sin (bloqueos|pendientes|riesgos)/i.test(normalized)) {
      return false;
    }
    return /bloque|permiso|seguridad|regulad|legal|pendiente|hard gate/i.test(item);
  }

  private buildStep4MasterContext(masterContext: any, step3Output: Record<string, any>) {
    return {
      ...masterContext,
      version: Number(masterContext.version ?? 1) + 1,
      step3Output,
      knownFacts: this.compact([...(masterContext.knownFacts ?? []), step3Output.resultAnalysis?.interpretation]),
      assumptions: this.compact([step3Output.hypothesis, ...(masterContext.assumptions ?? [])]),
      missingCriticalInformation: this.compact([...(step3Output.decision?.remainingUncertainties ?? []), ...(masterContext.missingCriticalInformation ?? [])]),
      risks: this.compact([...(step3Output.decision?.risks ?? []), ...(masterContext.risks ?? [])]),
      decisions: this.compact([step3Output.decision?.decision, step3Output.decision?.nextAction, ...(masterContext.decisions ?? [])]),
      step4Transfer: {
        decision: step3Output.decision,
        resultAnalysis: step3Output.resultAnalysis,
        operationalReadiness: step3Output.operationalReadiness,
        challengeContribution: step3Output.challengeContribution,
      },
    };
  }

  private buildStep4Output(masterContext: any, responses: Record<string, any>[]) {
    const merged = Object.assign({}, ...responses);
    const routeType = (masterContext.routeType ?? 'explore_validate') as AdaptiveRouteType;
    const step3Output = masterContext.step3Output ?? {};
    const decisionType = String(step3Output.decision?.decision ?? merged.finalState ?? 'close_with_learning');
    const audienceBrief = this.buildDecisionAudienceBrief(merged, masterContext, step3Output);
    const outputKey = this.step4OutputKey(routeType, decisionType, audienceBrief.preferredFormat);
    const narrative = this.buildEvidenceBackedNarrative(merged, masterContext, step3Output);
    const nextHorizon = this.buildNextHorizon(merged, decisionType, step3Output);
    const decisionPackage = this.buildDecisionPackage(merged, routeType, decisionType, audienceBrief, narrative);
    const transferOrClosure = this.buildTransferOrClosure(merged, decisionType, audienceBrief, nextHorizon);
    const finalState = this.normalizeFinalState(merged.finalState ?? transferOrClosure.finalState);
    const finalChallengeContribution = this.buildFinalChallengeContribution(masterContext, step3Output, narrative, transferOrClosure, finalState);
    const challengeCoverage = this.buildChallengeCoverage(masterContext, finalChallengeContribution, finalState, merged);
    // Decision Brief (E2E Job-Driven §21): además de lo que no podemos afirmar
    // (audienceBrief.unsupportedClaims), qué alternativas existen y qué sí podemos sostener.
    const alternatives = this.buildBriefAlternatives(masterContext.step2Output, step3Output);
    const sustainableClaims = this.buildSustainableClaims(narrative, audienceBrief.unsupportedClaims);
    return {
      outputKey,
      routeType,
      decisionType,
      finalState,
      hypothesis: String(step3Output.hypothesis ?? ''),
      hypothesisResult: String(step3Output.resultAnalysis?.classification ?? ''),
      organizationalDecision: transferOrClosure.finalDecision,
      recommendation: narrative.recommendation,
      audienceBrief,
      narrative,
      nextHorizon,
      decisionPackage,
      transferOrClosure,
      finalChallengeContribution,
      challengeCoverage,
      alternatives,
      sustainableClaims,
      sourceRefs: Array.from(new Set([
        ...(step3Output.sourceRefs ?? []),
        ...this.sourceRefsFrom(merged.narrativeEvidenceRefs),
        ...this.sourceRefsFrom(merged.artifactTraceability),
        ...this.sourceRefsFrom(merged.challengeCoverageUpdate),
      ])),
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Alternativas del Brief: las que se compararon en Step 2 (CP-2.2) marcando cuál fue la
   * apuesta y cuál el backup, para que quien decide vea qué otras salidas había.
   */
  private buildBriefAlternatives(step2Output: any, step3Output: Record<string, any>) {
    const alternatives: Array<Record<string, any>> = Array.isArray(step2Output?.alternativeSet?.alternatives)
      ? step2Output.alternativeSet.alternatives
      : [];
    const primary = String(step3Output.selectedBet?.primary ?? step2Output?.selectedBet?.primary ?? '');
    const backup = String(step2Output?.selectedBet?.backup ?? '');
    return alternatives
      .map((alternative) => {
        const name = String(alternative.name ?? alternative.title ?? alternative.label ?? '');
        return {
          name,
          mode: String(alternative.mode ?? ''),
          role: name && name === primary ? 'selected' : name && name === backup ? 'backup' : 'considered',
          evidenceRefs: this.toList(alternative.evidenceRefs),
        };
      })
      .filter((alternative) => alternative.name);
  }

  /**
   * Qué podemos sostener: claims críticos con evidencia y confianza no baja, excluyendo los
   * que la persona marcó como no afirmables. Es lo complementario de unsupportedClaims.
   */
  private buildSustainableClaims(narrative: Record<string, any>, unsupportedClaims: string[]) {
    const unsupported = new Set(unsupportedClaims.map((claim) => claim.toLowerCase()));
    const claims: Array<Record<string, any>> = Array.isArray(narrative.criticalClaims) ? narrative.criticalClaims : [];
    return claims
      .filter((claim) => (claim.evidenceRefs?.length ?? 0) > 0 && claim.confidence !== 'low')
      .map((claim) => {
        const value = narrative[claim.key];
        const text = typeof value === 'string' ? value : String(value?.text ?? '');
        return { key: claim.key, text, evidenceRefs: claim.evidenceRefs, confidence: claim.confidence };
      })
      .filter((claim) => claim.text && !unsupported.has(claim.text.toLowerCase()));
  }

  private buildDecisionAudienceBrief(merged: Record<string, any>, masterContext: any, step3Output: Record<string, any>) {
    const audience = this.recordFrom(merged.decisionAudience);
    const needs = this.recordFrom(merged.audienceDecisionNeeds);
    const companyFormats = masterContext.companySnapshot?.formats ?? [];
    const decision = step3Output.decision ?? {};
    return {
      primaryAudience: String(audience.primaryAudience ?? audience.audience ?? needs.primaryAudience ?? decision.requiredApprover ?? 'Owner de iniciativa'),
      decisionMaker: String(audience.decisionMaker ?? audience.decisor ?? needs.decisionMaker ?? decision.requiredApprover ?? decision.owner ?? 'Owner de iniciativa'),
      secondaryAudiences: this.compact([audience.secondaryAudiences, needs.secondaryAudiences, masterContext.challengeSnapshot?.challengeOwner]),
      requestedDecision: String(needs.requestedDecision ?? audience.requestedDecision ?? decision.nextAction ?? decision.decision ?? ''),
      deadline: String(audience.deadline ?? needs.deadline ?? decision.dueDate ?? ''),
      audienceNeeds: this.toList(needs.audienceNeeds ?? needs.needs ?? audience.audienceNeeds),
      objections: this.toList(needs.objections ?? audience.objections ?? decision.risks),
      requiredEvidenceRefs: Array.from(new Set([
        ...(step3Output.decision?.evidenceRefs ?? []),
        ...(step3Output.resultAnalysis?.supportingEvidenceRefs ?? []),
        ...(step3Output.resultAnalysis?.contradictingEvidenceRefs ?? []),
        ...this.sourceRefsFrom(needs.requiredEvidenceRefs ?? audience.requiredEvidenceRefs),
      ])),
      unsupportedClaims: this.toList(needs.unsupportedClaims ?? audience.unsupportedClaims),
      preferredFormat: String(needs.preferredFormat ?? audience.preferredFormat ?? companyFormats[0] ?? this.defaultArtifactKind(step3Output.decision?.decision, masterContext.routeType)),
    };
  }

  private buildEvidenceBackedNarrative(merged: Record<string, any>, masterContext: any, step3Output: Record<string, any>) {
    const raw = this.recordFrom(merged.evidenceNarrative);
    const refs = Array.from(new Set([
      ...(step3Output.sourceRefs ?? []),
      ...this.sourceRefsFrom(merged.narrativeEvidenceRefs),
    ]));
    const limitations = this.compact([raw.limitations, ...(step3Output.resultAnalysis?.limitations ?? []), ...(step3Output.decision?.remainingUncertainties ?? [])]);
    const claim = (topic: string, text: unknown, evidenceRefs: string[] = refs) => ({
      topic,
      text: String(text ?? ''),
      evidenceRefs,
      sourceRefs: evidenceRefs,
      confidence: evidenceRefs.length > 0 ? String(step3Output.resultAnalysis?.evidenceStrength ?? 'medium') : 'low',
      limitations,
    });
    const recommendation = String(raw.recommendation ?? step3Output.decision?.nextAction ?? step3Output.decision?.rationale ?? '');
    return {
      context: claim('context', raw.context ?? masterContext.knownFacts?.[0] ?? ''),
      focus: claim('focus', raw.focus ?? masterContext.step2Transfer?.focus ?? step3Output.executionSummary?.scope ?? ''),
      hypothesis: claim('hypothesis', raw.hypothesis ?? step3Output.hypothesis ?? ''),
      selectedBet: claim('selected_bet', raw.selectedBet ?? step3Output.selectedBet?.primary ?? ''),
      execution: claim('execution', raw.execution ?? step3Output.executionSummary?.testOrExecution ?? ''),
      results: claim('results', raw.results ?? step3Output.resultAnalysis?.interpretation ?? ''),
      learnings: claim('learnings', raw.learnings ?? step3Output.resultAnalysis?.interpretation ?? ''),
      contradictions: claim('contradictions', raw.contradictions ?? (step3Output.resultAnalysis?.contradictingEvidenceRefs ?? []).join(', '), step3Output.resultAnalysis?.contradictingEvidenceRefs ?? refs),
      risks: claim('risks', raw.risks ?? (step3Output.decision?.risks ?? []).join(', ')),
      limitations,
      recommendation,
      nextStep: String(raw.nextStep ?? step3Output.decision?.nextAction ?? ''),
      criticalClaims: ['context', 'focus', 'hypothesis', 'selectedBet', 'execution', 'results', 'recommendation'].map((key) => ({
        key,
        evidenceRefs: refs,
        sourceRefs: refs,
        confidence: refs.length > 0 ? String(step3Output.resultAnalysis?.evidenceStrength ?? 'medium') : 'low',
        limitations,
      })),
      userConfirmed: this.hasValue(merged.evidenceNarrative),
    };
  }

  private buildNextHorizon(merged: Record<string, any>, decisionType: string, step3Output: Record<string, any>) {
    const plan = this.recordFrom(merged.nextHorizonPlan);
    const details = this.recordFrom(merged.nextHorizonDetails);
    const planTypeByDecision: Record<string, string> = {
      scale_pilot: 'ScalingRoadmap',
      transfer: 'TransferPlan',
      continue_implementation: 'OperationalizationPlan',
      integrate_to_roadmap: 'OperationalizationPlan',
      iterate: 'IterationPlan',
      repeat_test: 'IterationPlan',
      expand_sample: 'IterationPlan',
      change_scope: 'IterationPlan',
      pivot: 'IterationPlan',
      pause: 'ClosurePlan',
      close_with_learning: 'ClosurePlan',
      reformulate_challenge: 'ClosurePlan',
    };
    return {
      planType: String(plan.planType ?? planTypeByDecision[decisionType] ?? 'ClosurePlan'),
      phases: this.toList(plan.phases ?? details.phases ?? ['Siguiente accion']),
      scope: String(plan.scope ?? details.scope ?? step3Output.executionSummary?.scope ?? ''),
      owner: String(plan.owner ?? details.owner ?? step3Output.decision?.owner ?? 'Owner de iniciativa'),
      resources: this.toList(plan.resources ?? details.resources),
      investment: String(plan.investment ?? details.investment ?? ''),
      capabilities: this.toList(plan.capabilities ?? details.capabilities),
      governance: this.toList(plan.governance ?? details.governance),
      adoption: this.toList(plan.adoption ?? details.adoption),
      risks: this.toList(plan.risks ?? details.risks ?? step3Output.decision?.risks),
      metrics: this.toList(plan.metrics ?? details.metrics ?? step3Output.executionSummary?.metric),
      milestones: this.toList(plan.milestones ?? details.milestones),
      dependencies: this.toList(plan.dependencies ?? details.dependencies),
      rollback: String(plan.rollback ?? details.rollback ?? step3Output.operationalReadiness?.rollback ?? ''),
      followUp: String(plan.followUp ?? details.followUp ?? step3Output.decision?.nextAction ?? ''),
    };
  }

  private buildDecisionPackage(merged: Record<string, any>, routeType: AdaptiveRouteType, decisionType: string, audienceBrief: Record<string, any>, narrative: Record<string, any>) {
    const requested = this.toList(merged.decisionArtifacts);
    const trace = this.recordFrom(merged.artifactTraceability);
    const defaults = this.defaultArtifactsFor(routeType, decisionType, audienceBrief.preferredFormat);
    const artifacts = (requested.length > 0 ? requested : defaults).slice(0, 3).map((kind, index) => ({
      id: `artifact-${index + 1}`,
      kind,
      title: this.artifactTitle(kind, narrative.recommendation),
      editable: true,
      evidenceRefs: this.sourceRefsFrom((trace as any)[kind]?.evidenceRefs ?? trace.evidenceRefs ?? narrative.criticalClaims),
      limitations: this.toList((trace as any)[kind]?.limitations ?? trace.limitations ?? narrative.limitations),
      version: Number((trace as any)[kind]?.version ?? trace.version ?? 1),
      author: String((trace as any)[kind]?.author ?? trace.author ?? 'adaptive-core'),
      date: String((trace as any)[kind]?.date ?? trace.date ?? new Date().toISOString()),
    }));
    return {
      generationRule: 'minimum_useful_package',
      artifacts,
      notGeneratedByDefault: ['one-pager', 'memo', 'business case', 'pilot report', 'deck outline', 'implementation plan', 'handoff package', 'learning report', 'closure report'].filter((kind) => !artifacts.some((artifact) => artifact.kind === kind)),
    };
  }

  private buildTransferOrClosure(merged: Record<string, any>, decisionType: string, audienceBrief: Record<string, any>, nextHorizon: Record<string, any>) {
    const raw = this.recordFrom(merged.transferOrClosure);
    const finalState = this.normalizeFinalState(merged.finalState ?? raw.finalState ?? decisionType);
    const isTransfer = ['transferred', 'scaled', 'integrated_to_roadmap', 'completed', 'benefit_tracking'].includes(finalState);
    const receiverOwner = String(raw.receiverOwner ?? raw.ownerReceptor ?? raw.futureOwner ?? '');
    const blockers = isTransfer && !this.hasValue(receiverOwner) ? ['Owner receptor requerido para transferencia u operacion.'] : this.toList(raw.blockers);
    return {
      mode: isTransfer ? 'transfer_or_operation' : 'closure_or_iteration',
      status: blockers.length > 0 ? 'blocked' : 'ready',
      receiverOwner,
      acceptance: String(raw.acceptance ?? raw.aceptacion ?? ''),
      resources: this.toList(raw.resources),
      documentation: this.toList(raw.documentation),
      training: this.toList(raw.training ?? raw.capacitacion),
      support: this.toList(raw.support ?? raw.soporte),
      permissions: this.toList(raw.permissions ?? raw.permisos),
      date: String(raw.date ?? raw.fecha ?? new Date().toISOString()),
      metrics: this.toList(raw.metrics ?? nextHorizon.metrics),
      followUp: String(raw.followUp ?? raw.seguimiento ?? nextHorizon.followUp ?? ''),
      finalDecision: String(raw.finalDecision ?? raw.decisionFinal ?? audienceBrief.requestedDecision ?? decisionType),
      decisionMaker: String(raw.decisionMaker ?? audienceBrief.decisionMaker ?? ''),
      conditions: this.toList(raw.conditions),
      comments: String(raw.comments ?? ''),
      nextStep: String(raw.nextStep ?? nextHorizon.followUp ?? ''),
      owner: String(raw.owner ?? receiverOwner ?? nextHorizon.owner ?? ''),
      dueDate: String(raw.dueDate ?? ''),
      closureReason: String(raw.reason ?? raw.razon ?? ''),
      learning: String(raw.learning ?? raw.aprendizaje ?? ''),
      evidenceRefs: this.sourceRefsFrom(raw.evidenceRefs),
      reusableAssets: this.toList(raw.reusableAssets ?? raw.activosReutilizables),
      communication: String(raw.communication ?? raw.comunicacion ?? ''),
      finalState,
      blockers,
    };
  }

  private buildFinalChallengeContribution(masterContext: any, step3Output: Record<string, any>, narrative: Record<string, any>, transferOrClosure: Record<string, any>, finalState: string) {
    if (!masterContext.challengeSnapshot) {
      return {
        challengeId: null,
        contributionType: this.contributionTypeForFinalState(finalState),
        evidenceStrength: String(step3Output.resultAnalysis?.evidenceStrength ?? 'medium'),
        result: String(step3Output.resultAnalysis?.classification ?? ''),
        recommendation: narrative.recommendation,
        evidenceRefs: Array.from(new Set([...(step3Output.sourceRefs ?? []), ...(transferOrClosure.evidenceRefs ?? [])])),
        challengeResolved: false,
      };
    }
    return {
      challengeId: masterContext.challengeSnapshot.id,
      subproblem: masterContext.step2Transfer?.focus ?? step3Output.executionSummary?.scope ?? '',
      hypothesis: step3Output.hypothesis ?? '',
      metric: step3Output.executionSummary?.metric ?? '',
      contributionType: this.contributionTypeForFinalState(finalState),
      evidenceStrength: String(step3Output.resultAnalysis?.evidenceStrength ?? 'medium'),
      result: String(step3Output.resultAnalysis?.classification ?? ''),
      decision: transferOrClosure.finalDecision,
      recommendation: narrative.recommendation || transferOrClosure.nextStep,
      evidenceRefs: Array.from(new Set([...(step3Output.sourceRefs ?? []), ...(transferOrClosure.evidenceRefs ?? [])])),
      finalState,
      challengeResolved: false,
    };
  }

  private buildChallengeCoverage(masterContext: any, contribution: Record<string, any>, finalState: string, merged: Record<string, any> = {}) {
    const requested = this.recordFrom(merged.challengeCoverageUpdate);
    const result = String(contribution.result ?? '');
    const evidenceStrength = String(contribution.evidenceStrength ?? 'medium');
    let status = 'partial';
    if (!contribution.challengeId) status = 'no_coverage';
    else if (['new_iteration_required', 'pivoted', 'paused'].includes(finalState)) status = 'needs_reformulation';
    else if (finalState === 'seeking_capability') status = 'partial';
    else if (finalState === 'closed_with_learning') status = result === 'insufficient_evidence' ? 'exploratory_coverage' : 'partial';
    else if (['scaled', 'transferred', 'integrated_to_roadmap', 'completed', 'benefit_tracking'].includes(finalState)) status = evidenceStrength === 'strong' ? 'ready_for_decision' : 'supported';
    return {
      status: contribution.challengeId ? String(requested.status ?? status) : 'no_coverage',
      evidenceStrength,
      result,
      decision: contribution.decision ?? finalState,
      overlap: requested.overlap ?? 'not_evaluated',
      metrics: this.toList(requested.metrics ?? contribution.metric),
      relatedInitiatives: this.toList(requested.relatedInitiatives),
      rationale: String(requested.rationale ?? contribution.recommendation ?? ''),
      autoResolved: false,
    };
  }

  private buildFinalMasterContext(masterContext: any, step4Output: Record<string, any>, finalState: string) {
    return {
      ...masterContext,
      version: Number(masterContext.version ?? 1) + 1,
      step4Output,
      finalState,
      organizationalDecision: step4Output.organizationalDecision,
      challengeCoverage: step4Output.challengeCoverage,
      knownFacts: this.compact([...(masterContext.knownFacts ?? []), step4Output.recommendation]),
      decisions: this.compact([step4Output.organizationalDecision, finalState, ...(masterContext.decisions ?? [])]),
      risks: this.compact([...(step4Output.narrative?.risks?.limitations ?? []), ...(masterContext.risks ?? [])]),
      closedAt: new Date().toISOString(),
    };
  }

  private normalizeFinalState(raw: unknown) {
    const value = String(raw ?? '').trim();
    const byDecision: Record<string, string> = {
      iterate: 'new_iteration_required',
      repeat_test: 'new_iteration_required',
      expand_sample: 'new_iteration_required',
      change_scope: 'new_iteration_required',
      // Core §25–§26 / E2E Job-Driven §22: pivotear, buscar capacidad y benefit tracking son
      // rutas de continuidad propias, no variantes de iterar o cerrar.
      pivot: 'pivoted',
      seek_capability: 'seeking_capability',
      seek_external_capability_or_partner: 'seeking_capability',
      seek_alignment_or_sponsor: 'seeking_capability',
      benefit_tracking: 'benefit_tracking',
      scale_pilot: 'scaled',
      continue_implementation: 'completed',
      transfer: 'transferred',
      integrate_to_roadmap: 'integrated_to_roadmap',
      pause: 'paused',
      close_with_learning: 'closed_with_learning',
      reformulate_challenge: 'new_iteration_required',
    };
    const normalized = byDecision[value] ?? value;
    const allowed = new Set([
      'completed', 'transferred', 'scaled', 'integrated_to_roadmap', 'closed_with_learning', 'paused', 'new_iteration_required',
      'pivoted', 'seeking_capability', 'benefit_tracking',
    ]);
    return allowed.has(normalized) ? normalized : 'closed_with_learning';
  }

  private projectStatusForFinalState(finalState: string) {
    if (finalState === 'new_iteration_required' || finalState === 'pivoted') return 'ITERATION';
    // Buscar capacidad deja el ciclo abierto: la iniciativa espera sponsor, socio o capacidad.
    if (finalState === 'paused' || finalState === 'seeking_capability') return 'IN_PROGRESS';
    return 'COMPLETED';
  }

  private portfolioMetaFinalUpdate(step4Output: Record<string, any>, finalState: string) {
    const closed = ['completed', 'transferred', 'scaled', 'integrated_to_roadmap', 'closed_with_learning', 'benefit_tracking'].includes(finalState);
    return {
      // ADR-030 (reconciliacion): dos arreglos aqui.
      //  1. 'cerrada' -> 'closed': mismo estado, un solo deletreo.
      //  2. paused -> 'paused', NO 'bloqueada'. Eran conceptos distintos mapeados al
      //     mismo valor: `bloqueada` es un impedimento reversible y SIGUE aceptando
      //     escrituras de step, asi que una iniciativa pausada por aqui no quedaba en
      //     solo lectura — justo lo que la pausa tiene que garantizar.
      status: closed ? 'closed' : finalState === 'paused' ? 'paused' : 'en_step_4',
      currentStep: 'Step 4',
      readyForDecision: false,
      signalSummary: String(step4Output.recommendation ?? ''),
      nextActionRecommended: String(step4Output.transferOrClosure?.nextStep ?? ''),
      mainBlocker: String(step4Output.transferOrClosure?.blockers?.[0] ?? ''),
      hypothesisCovered: String(step4Output.hypothesis ?? ''),
      contributionType: this.portfolioContributionType(step4Output.finalChallengeContribution?.contributionType),
      estimatedContribution: this.estimatedContribution(step4Output.finalChallengeContribution?.evidenceStrength),
      partialSignal: ['mixed_signal', 'partially_supported'].includes(String(step4Output.finalChallengeContribution?.result ?? '')),
      resolvedCorePart: false,
      executiveSummary: String(step4Output.narrative?.recommendation ?? step4Output.recommendation ?? ''),
      experimentSummary: String(step4Output.narrative?.results?.text ?? ''),
      decisionRecommendationReason: String(step4Output.transferOrClosure?.finalDecision ?? ''),
      deliverables: step4Output.decisionPackage?.artifacts ?? [],
      stepsTimeline: step4Output.nextHorizon?.milestones ?? [],
      coverageScore: this.coverageScore(step4Output.challengeCoverage?.status),
      alignmentNotes: String(step4Output.challengeCoverage?.rationale ?? ''),
      decisionNotes: String(step4Output.organizationalDecision ?? ''),
      lastActivity: new Date().toISOString(),
    };
  }

  private portfolioMetaCompletionUpdate(step4Output: Record<string, any>, routing: InitiativeCompletionRoutingResult) {
    return {
      // ADR-030 (reconciliacion): antes escribia 'cerrada' (legacy) mientras
      // updateDecisionLifecycleProjectionTx escribia 'closed' (canonico) para el MISMO
      // concepto. Dos deletreos del mismo estado hacian imposible preguntar "esta cerrada?"
      // sin conocer que camino la escribio. Gana el canonico; el backfill unifica lo viejo.
      status: routing.route === 'portfolio_presented' ? 'lista_para_decision' : 'closed',
      currentStep: 'Step 4',
      readyForDecision: routing.portfolioReviewRequired,
      signalSummary: String(step4Output.recommendation ?? step4Output.narrative?.recommendation ?? ''),
      nextActionRecommended: routing.portfolioReviewRequired
        ? 'Esperar revision posterior de Portfolio Lead.'
        : 'Iniciativa completada; historial disponible en modo lectura.',
      mainBlocker: '',
      hypothesisCovered: String(step4Output.hypothesis ?? ''),
      contributionType: this.portfolioContributionType(step4Output.finalChallengeContribution?.contributionType),
      estimatedContribution: this.estimatedContribution(step4Output.finalChallengeContribution?.evidenceStrength),
      partialSignal: ['mixed_signal', 'partially_supported'].includes(String(step4Output.finalChallengeContribution?.result ?? '')),
      resolvedCorePart: routing.route === 'portfolio_presented',
      executiveSummary: String(step4Output.narrative?.recommendation ?? step4Output.recommendation ?? ''),
      experimentSummary: String(step4Output.narrative?.results?.text ?? ''),
      decisionRecommendationReason: routing.portfolioReviewRequired ? 'Lista para revision de portafolio; DecisionRequest aun no existe en C2B.' : '',
      deliverables: step4Output.decisionPackage?.artifacts ?? [],
      stepsTimeline: step4Output.nextHorizon?.milestones ?? [],
      coverageScore: this.coverageScore(step4Output.challengeCoverage?.status),
      alignmentNotes: String(step4Output.challengeCoverage?.rationale ?? ''),
      decisionNotes: '',
      lastActivity: new Date().toISOString(),
    };
  }

  private prismaCoverageStatus(status: unknown) {
    const value = String(status ?? '');
    if (value === 'resolved') return 'resuelto';
    if (value === 'needs_reformulation') return 'reformular';
    if (value === 'supported' || value === 'ready_for_decision') return 'cobertura_suficiente';
    if (value === 'partial' || value === 'exploratory_coverage' || value === 'overlapped') return 'cobertura_parcial';
    return 'sin_cobertura';
  }

  private coverageScore(status: unknown) {
    const value = String(status ?? '');
    if (value === 'ready_for_decision' || value === 'supported') return 0.75;
    if (value === 'partial') return 0.5;
    if (value === 'exploratory_coverage' || value === 'overlapped') return 0.35;
    if (value === 'needs_reformulation') return 0.2;
    if (value === 'resolved') return 1;
    return 0;
  }

  private portfolioContributionType(type: unknown) {
    const value = String(type ?? '');
    if (value === 'resolver_directamente') return 'resolver_directamente';
    if (value === 'resolver_parcialmente') return 'resolver_parcialmente';
    if (value === 'validar') return 'validar';
    return 'descubrir';
  }

  private contributionTypeForFinalState(finalState: string) {
    if (['scaled', 'transferred', 'integrated_to_roadmap', 'completed', 'benefit_tracking'].includes(finalState)) return 'resolver_parcialmente';
    if (finalState === 'new_iteration_required' || finalState === 'pivoted') return 'validar';
    return 'descubrir';
  }

  private estimatedContribution(evidenceStrength: unknown) {
    const value = String(evidenceStrength ?? '');
    if (value === 'strong') return 'alto';
    if (value === 'medium') return 'medio';
    return 'bajo';
  }

  private step4OutputKey(routeType: AdaptiveRouteType, decisionType: string, preferredFormat?: unknown) {
    if (String(preferredFormat ?? '').toLowerCase().includes('one-pager')) return 'LightweightDecisionBrief';
    if (routeType === 'lightweight_plan') return 'LightweightDecisionBrief';
    if (decisionType === 'scale_pilot' || decisionType === 'integrate_to_roadmap') return 'BusinessCaseRoadmap';
    if (decisionType === 'transfer' || decisionType === 'continue_implementation') return 'OperationalHandoffPackage';
    return STEP4_OUTPUT_BY_ROUTE[routeType];
  }

  private defaultArtifactKind(decisionType: unknown, routeType: unknown) {
    const decision = String(decisionType ?? '');
    if (decision === 'close_with_learning' || decision === 'pause') return 'learning report';
    if (decision === 'transfer' || routeType === 'implement_handoff') return 'handoff package';
    if (decision === 'scale_pilot' || decision === 'integrate_to_roadmap') return 'business case';
    if (routeType === 'lightweight_plan') return 'one-pager';
    return 'memo';
  }

  private defaultArtifactsFor(routeType: AdaptiveRouteType, decisionType: string, preferredFormat: unknown) {
    const preferred = String(preferredFormat ?? '').trim();
    if (preferred) return [preferred];
    const first = this.defaultArtifactKind(decisionType, routeType);
    if (decisionType === 'scale_pilot') return [first, 'roadmap'];
    if (decisionType === 'transfer' || decisionType === 'continue_implementation') return [first, 'implementation plan'];
    if (decisionType === 'close_with_learning' || decisionType === 'pause') return [first, 'closure report'];
    return [first];
  }

  private artifactTitle(kind: string, recommendation: unknown) {
    const suffix = String(recommendation ?? '').trim();
    return suffix ? `${kind}: ${suffix}` : kind;
  }

  private recordFrom(value: unknown): Record<string, any> {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;
    if (typeof value === 'string') return { text: value };
    return {};
  }

  private buildStep3ChallengeContribution(masterContext: any, step2Output: Record<string, any>, resultAnalysis: Record<string, any>, decision: Record<string, any>) {
    if (!masterContext.challengeSnapshot) return null;
    return {
      challengeId: masterContext.challengeSnapshot.id,
      subproblem: masterContext.step2Transfer?.focus ?? step2Output.scope ?? '',
      hypothesis: step2Output.hypothesis ?? '',
      metric: step2Output.metric ?? step2Output.executionDesign?.metric ?? '',
      contributionType: decision.decision,
      evidenceStrength: resultAnalysis.evidenceStrength,
      result: resultAnalysis.classification,
      recommendation: decision.nextAction || decision.rationale,
      evidenceRefs: Array.from(new Set([...(step2Output.evidenceUsed ?? []), ...(decision.evidenceRefs ?? []), ...(resultAnalysis.supportingEvidenceRefs ?? []), ...(resultAnalysis.contradictingEvidenceRefs ?? [])])),
      coverageUpdated: true,
      challengeResolved: false,
    };
  }

  private normalizeAlternatives(rawAlternatives: unknown, rawEvidenceRefs: unknown, routeType: AdaptiveRouteType) {
    const values = Array.isArray(rawAlternatives) ? rawAlternatives : this.toList(rawAlternatives);
    const refs = this.sourceRefsFrom(rawEvidenceRefs);
    const fallback = routeType === 'lightweight_plan'
      ? ['Ejecutar quick win controlado', 'No hacer nada por ahora']
      : ['Build interno', 'Buy externo', 'Partner', 'No hacer nada'];
    const source = values.length > 0 ? values : fallback;
    return source.map((item: any, index) => ({
      id: String(item?.id ?? `alt-${index + 1}`),
      name: typeof item === 'string' ? item : String(item?.name ?? item?.title ?? `Alternativa ${index + 1}`),
      mode: String(item?.mode ?? item?.implementationMode ?? this.defaultAlternativeMode(routeType, index)),
      description: typeof item === 'string' ? item : String(item?.description ?? item?.summary ?? ''),
      evidenceRefs: this.sourceRefsFrom(item?.evidenceRefs ?? item?.sourceRefs ?? refs[index] ?? refs),
      prescribed: Boolean(item?.prescribed),
    }));
  }

  private normalizeSelectedBet(rawSelected: unknown, alternatives: Array<Record<string, any>>, rawEvidenceRefs: unknown, rawComparison: unknown) {
    const selected = rawSelected && typeof rawSelected === 'object' && !Array.isArray(rawSelected) ? rawSelected as Record<string, any> : {};
    const primary = String(selected.primary ?? selected.name ?? selected.apuestaPrincipal ?? alternatives[0]?.name ?? 'Apuesta principal pendiente');
    return {
      primary,
      backup: String(selected.backup ?? alternatives[1]?.name ?? 'No hacer nada por ahora'),
      justification: String(selected.justification ?? selected.justificacion ?? rawComparison ?? `Seleccionada por mejor balance de valor, factibilidad y tiempo hasta senal: ${primary}.`),
      assumptions: this.toList(selected.assumptions ?? selected.supuestos),
      risks: this.toList(selected.risks ?? selected.riesgos),
      hypothesis: String(selected.hypothesis ?? selected.hipotesis ?? primary),
      evidenceRefs: this.sourceRefsFrom(selected.evidenceRefs ?? selected.sourceRefs ?? rawEvidenceRefs),
      comparison: rawComparison ?? {},
    };
  }

  private normalizeExecutionDesign(rawExecution: unknown, rawOwnersResources: unknown, rawGoNoGo: unknown, selectedBet: Record<string, any>, routeType: AdaptiveRouteType, step1Output: any) {
    const execution = rawExecution && typeof rawExecution === 'object' && !Array.isArray(rawExecution) ? rawExecution as Record<string, any> : {};
    return {
      outputKind: STEP2_OUTPUT_BY_ROUTE[routeType],
      hypothesis: String(execution.hypothesis ?? selectedBet.hypothesis ?? step1Output.hypothesisForStep2 ?? ''),
      testOrExecution: String(execution.testOrExecution ?? execution.test ?? execution.execution ?? selectedBet.primary),
      scope: String(execution.scope ?? step1Output.updatedFocus ?? ''),
      participants: this.toList(execution.participants ?? execution.participantes),
      baseline: String(execution.baseline ?? step1Output.evidenceSummary ?? ''),
      metric: String(execution.metric ?? execution.metrica ?? 'Senal principal definida por Step 2'),
      threshold: String(execution.threshold ?? execution.umbral ?? ''),
      duration: String(execution.duration ?? execution.duracion ?? ''),
      responsibles: this.toList(execution.responsibles ?? rawOwnersResources),
      resources: this.toList(execution.resources ?? rawOwnersResources),
      evidence: this.toList(execution.evidence ?? execution.evidencia),
      risks: this.toList(execution.risks ?? execution.riesgos),
      guardrails: this.toList(execution.guardrails),
      goNoGoCriteria: String(execution.goNoGoCriteria ?? rawGoNoGo ?? ''),
    };
  }

  private buildReadiness(rawChecklist: unknown, rawDependencies: unknown, masterContext: any, execution: Record<string, any>) {
    const required = this.shouldActivateReadiness(masterContext, execution);
    const checklist = this.toList(rawChecklist);
    const dependencies = this.toList(rawDependencies);
    const blockers = required ? this.compact([
      checklist.length === 0 ? 'Checklist de readiness pendiente.' : '',
      dependencies.filter((item) => /bloque|pendiente|sin permiso|riesgo/i.test(item)),
    ]) : [];
    return {
      required,
      status: blockers.length > 0 ? 'blocked' : required ? 'ready_with_observations' : 'not_required',
      checklist,
      dependencies,
      blockers,
      actorRequired: blockers.length > 0 ? 'Owner / sponsor de dependencia' : execution.responsibles?.[0] ?? 'Owner de iniciativa',
      fallbackPlan: dependencies.find((item) => /alternativo|fallback|plan b/i.test(item)) ?? '',
    };
  }

  private shouldActivateReadiness(masterContext: any, latest?: Record<string, unknown>) {
    const routeType = String(masterContext.routeType ?? '');
    const readinessSignals = {
      risks: masterContext.risks ?? [],
      missingCriticalInformation: masterContext.missingCriticalInformation ?? [],
      knownFacts: masterContext.knownFacts ?? [],
      companyRestrictions: masterContext.companySnapshot?.restrictions ?? [],
      latest,
    };
    const text = JSON.stringify(readinessSignals).toLowerCase();
    return routeType === 'implement_handoff'
      || masterContext.depthLevel === 'extended'
      || (masterContext.companySnapshot?.restrictions ?? []).length > 0
      || /regulad|seguridad|permiso|presupuesto|dependenc|transversal|tecnologia|datos|alto riesgo/.test(text);
  }

  private shouldActivateOperationalReadiness(masterContext: any, responses: Record<string, any>[] = []) {
    const merged = Object.assign({}, ...responses);
    const decision = typeof merged.decision === 'object' && merged.decision !== null
      ? String((merged.decision as Record<string, any>).decision ?? (merged.decision as Record<string, any>).type ?? '')
      : String(merged.decision ?? '');
    return ['scale_pilot', 'continue_implementation', 'transfer', 'integrate_to_roadmap'].includes(decision)
      || ['scale_pilot', 'continue_implementation', 'transfer', 'integrate_to_roadmap'].includes(String(masterContext.step3Output?.decision?.decision ?? ''));
  }

  private defaultAlternativeMode(routeType: AdaptiveRouteType, index: number) {
    if (routeType === 'design_solution') return ['build', 'buy', 'partner', 'do_nothing'][index] ?? 'build';
    if (routeType === 'implement_handoff') return ['controlled_implementation', 'phased_rollout', 'do_nothing'][index] ?? 'controlled_implementation';
    if (routeType === 'plan_coordinate') return ['delivery_path', 'scope_reduction', 'do_nothing'][index] ?? 'delivery_path';
    if (routeType === 'reconstruct_existing') return ['recover', 'rebuild_evidence', 'do_nothing'][index] ?? 'recover';
    return ['experiment', 'concierge_test', 'do_nothing'][index] ?? 'experiment';
  }

  private normalizeExecutionRecords(rawRecords: unknown, refs: string[]) {
    const values = Array.isArray(rawRecords) ? rawRecords : this.toList(rawRecords);
    return values.map((item: any, index) => {
      const record = item && typeof item === 'object' && !Array.isArray(item) ? item as Record<string, any> : {};
      const text = typeof item === 'string' ? item : String(record.description ?? record.title ?? `Registro ${index + 1}`);
      return {
        type: String(record.type ?? this.inferExecutionRecordType(text)),
        title: String((record.title ?? text.slice(0, 80)) || `Registro ${index + 1}`),
        description: String(record.description ?? text),
        occurredAt: String(record.occurredAt ?? new Date().toISOString()),
        actor: String(record.actor ?? 'Owner de iniciativa'),
        evidenceRefs: this.sourceRefsFrom(record.evidenceRefs ?? refs[index] ?? refs),
        sourceRefs: this.sourceRefsFrom(record.sourceRefs ?? refs[index] ?? refs),
        impact: String(record.impact ?? ''),
        configurationVersion: Number(record.configurationVersion ?? 1),
        checkpointKey: String(record.checkpointKey ?? 'CP-3.2'),
      };
    });
  }

  private inferExecutionRecordType(text: string) {
    const lower = text.toLowerCase();
    if (/metric|medic|baseline|resultado/.test(lower)) return 'measurement';
    if (/entrevista|usuario|actor/.test(lower)) return 'interview';
    if (/incidente|bloque|riesgo/.test(lower)) return 'incident';
    if (/decision|go|no-go/.test(lower)) return 'decision';
    if (/alcance|hipotes|dependenc/.test(lower)) return 'scope_or_hypothesis_change';
    if (/evidencia|archivo|fuente/.test(lower)) return 'evidence';
    return 'activity';
  }

  private normalizeHypothesisClassification(raw: unknown, records: Array<Record<string, any>>) {
    const value = typeof raw === 'object' && raw !== null && !Array.isArray(raw)
      ? String((raw as Record<string, any>).classification ?? (raw as Record<string, any>).status ?? '')
      : String(raw ?? '');
    const allowed = new Set(['supported', 'partially_supported', 'contradicted', 'mixed_signal', 'insufficient_evidence', 'not_interpretable']);
    if (allowed.has(value)) return value;
    const text = `${value} ${JSON.stringify(records)}`.toLowerCase();
    if (/contradic|empeor|no cumple|fall/.test(text) && /apoya|mejor|cumple/.test(text)) return 'mixed_signal';
    if (/contradic|empeor|no cumple|fall/.test(text)) return 'contradicted';
    if (/parcial|algunos|mitad/.test(text)) return 'partially_supported';
    if (/insuf|sin evidencia|pocos datos/.test(text)) return 'insufficient_evidence';
    if (/no interpretable|confuso/.test(text)) return 'not_interpretable';
    return 'supported';
  }

  private hasSelectedBetChanged(previous: any, next: any) {
    const prevBet = previous?.selectedBet?.primary ?? previous?.selectedBet ?? null;
    const nextBet = next?.selectedBet?.primary ?? next?.selectedBet ?? null;
    return this.hasValue(prevBet) && this.hasValue(nextBet) && JSON.stringify(prevBet) !== JSON.stringify(nextBet);
  }

  private normalizeEvidenceItems(rawItems: unknown, rawClassifications: unknown, rawRefs: unknown) {
    const items = Array.isArray(rawItems) ? rawItems : this.toList(rawItems);
    const classifications = this.toList(rawClassifications);
    const refs = this.sourceRefsFrom(rawRefs);
    const allowed = new Set(['supports', 'contradicts', 'weak_signal', 'insufficient', 'context', 'new_uncertainty']);
    return items.map((item: any, index) => {
      const itemRefs = this.sourceRefsFrom(item?.sourceRefs ?? item?.sourceRef ?? item?.id ?? refs[index] ?? refs);
      const classification = String(item?.classification ?? classifications[index] ?? 'context');
      return {
        id: String(item?.id ?? `evidence-${index + 1}`),
        type: String(item?.type ?? item?.tipo ?? 'text'),
        summary: typeof item === 'string' ? item : String(item?.summary ?? item?.desc ?? item?.text ?? JSON.stringify(item)),
        classification: allowed.has(classification) ? classification : 'context',
        sourceRefs: itemRefs.length > 0 ? itemRefs : [`evidence-${index + 1}`],
      };
    });
  }

  private suggestEvidenceMethods(hypothesis: string, routeType: AdaptiveRouteType, masterContext: any) {
    const text = `${hypothesis} ${routeType} ${(masterContext.challengeType ?? '')}`.toLowerCase();
    const methods = new Set<string>();
    if (text.includes('adop') || routeType === 'implement_handoff') methods.add('readiness interviews').add('process observation').add('adoption metric baseline');
    if (text.includes('cliente') || routeType === 'explore_validate') methods.add('user interviews').add('problem evidence review');
    if (routeType === 'design_solution') methods.add('concept test').add('workflow walkthrough');
    if (routeType === 'plan_coordinate') methods.add('stakeholder alignment review').add('dependency mapping');
    if (routeType === 'reconstruct_existing') methods.add('document reconstruction').add('decision log review');
    if (masterContext.companySnapshot?.restrictions?.length) methods.add('policy and data-access check');
    return Array.from(methods);
  }

  private buildCompanyInfluences(companySnapshot: any) {
    if (!companySnapshot) return [];
    return ['methods', 'actors', 'restrictions', 'evidence', 'artifacts', 'validators'].map((target) => this.buildCompanyInfluence(companySnapshot, target));
  }

  private buildCompanyInfluence(companySnapshot: any, target: string) {
    const coverageLevel = Number(companySnapshot.coverage ?? 0) >= 70 ? 'high' : Number(companySnapshot.coverage ?? 0) >= 50 ? 'medium' : 'low';
    return {
      source: 'CompanyContextSnapshot',
      target,
      reason: coverageLevel === 'low'
        ? 'Cobertura baja: usar como sugerencia y pedir confirmacion; no crear hard gate.'
        : `Contexto empresarial afecta ${target}.`,
      sourceRefs: companySnapshot.sources ?? [],
      coverageLevel,
      confirmationStatus: coverageLevel === 'low' ? 'needs_confirmation' : 'confirmed',
    };
  }

  private buildCriticalChangeReview(input: CriticalChangeInput, newVersion?: number) {
    const affectedByField: Record<string, { checkpoints: string[]; outputs: string[]; nextStep: string }> = {
      scope: { checkpoints: ['CP-0.2', 'CP-0.3', 'CP-1.1'], outputs: ['Step0AlignmentBrief', 'ValidationFocus'], nextStep: 'Step 1' },
      company_or_area: { checkpoints: ['CP-0.2', 'CP-1.2', 'CP-1.3'], outputs: ['EvidencePlan', 'EvidenceMap'], nextStep: 'Step 1' },
      challenge_type: { checkpoints: ['CP-0.1', 'CP-1.1', 'CP-1.4'], outputs: ['Step0AlignmentBrief', 'Step1FocusDecision'], nextStep: 'Step 1' },
      route: { checkpoints: ['CP-0.3', 'CP-1.4'], outputs: ['StepConfiguration', 'Step1FocusDecision'], nextStep: 'Step 1' },
      hypothesis: { checkpoints: ['CP-0.3', 'CP-1.1', 'CP-1.2'], outputs: ['ValidationFocus', 'EvidencePlan'], nextStep: 'Step 1' },
      target_date: { checkpoints: ['CP-0.2', 'CP-1.2'], outputs: ['ExecutionConditionsMap', 'EvidencePlan'], nextStep: 'Step 1' },
      critical_restriction: { checkpoints: ['CP-0.2', 'CP-1.2', 'CP-1.4'], outputs: ['EvidencePlan', 'Step1FocusDecision'], nextStep: 'Step 1' },
      selected_bet: { checkpoints: ['CP-2.1', 'CP-2.3', 'CP-2.4'], outputs: ['SelectedBet', 'ExecutionDesign'], nextStep: 'Step 3' },
    };
    const affected = affectedByField[input.field];
    return {
      field: input.field,
      previousValue: input.previousValue ?? null,
      nextValue: input.nextValue,
      reason: input.reason ?? 'Sin motivo registrado.',
      action: input.action,
      affectedCheckpoints: affected.checkpoints,
      affectedOutputs: affected.outputs,
      affectedNextStep: affected.nextStep,
      newVersion: newVersion ?? null,
      rules: {
        silentUpdateAllowed: false,
        preservePreviousConfiguration: true,
        dependentOutputsRequireReview: true,
      },
    };
  }

  private async upsertStepOutputTx(tx: any, projectId: string, stepNumber: number, sourceConfigurationId: string, outputKey: string, outputJson: Record<string, unknown>, status: string) {
    const sourceConfiguration = await tx.adaptiveStepConfiguration.findUnique({ where: { id: sourceConfigurationId } });
    if (!sourceConfiguration?.cycleId) throw AppError.badRequest('La configuracion fuente no tiene ciclo.', 'OUTPUT_CYCLE_MISSING');
    if (sourceConfiguration.projectId !== projectId) throw AppError.badRequest('La configuracion fuente no pertenece a la iniciativa.', 'OUTPUT_PROJECT_MISMATCH');
    const latest = await tx.adaptiveStepOutput.findFirst({ where: { projectId, cycleId: sourceConfiguration.cycleId, stepNumber }, orderBy: { version: 'desc' } });
    const version = latest ? latest.version + 1 : 1;
    return tx.adaptiveStepOutput.create({ data: { projectId, cycleId: sourceConfiguration.cycleId, stepNumber, version, sourceConfigurationId, outputKey, outputJson, status } });
  }

  private async upsertProgressSignalTx(tx: any, projectId: string, signal: Record<string, any>) {
    const cycle = await this.cycles.getOperationalCycle(projectId, tx);
    await tx.adaptiveProgressSignal.upsert({
      where: { projectId },
      create: { projectId, cycleId: cycle.id, stepNumber: signal.step, checkpointKey: signal.checkpointCode, health: signal.health, signalJson: signal },
      update: { cycleId: cycle.id, stepNumber: signal.step, checkpointKey: signal.checkpointCode, health: signal.health, signalJson: signal },
    });
    if (cycle.status === 'active') {
      await tx.initiativeCycle.update({
        where: { id: cycle.id },
        data: { currentStep: signal.step },
      });
    }
    await tx.initiativePortfolioMeta.updateMany({
      where: { projectId },
      data: {
        currentStep: `Step ${signal.step}`,
        signalSummary: signal.evidence,
        mainBlocker: signal.blocker,
        nextActionRecommended: signal.nextAction,
        hypothesisCovered: signal.hypothesis,
      } as any,
    });
  }

  private async updateSignalForCheckpointTx(tx: any, projectId: string, checkpointKey: string, responses: Record<string, unknown>, masterContext: any) {
    const spec = [...STEP0_CHECKPOINTS, ...STEP1_CHECKPOINTS, ...STEP2_CHECKPOINTS, ...STEP3_CHECKPOINTS, ...STEP4_CHECKPOINTS].find((cp) => cp.key === checkpointKey);
    await this.upsertProgressSignalTx(tx, projectId, {
      step: checkpointKey.startsWith('CP-4') ? 4 : checkpointKey.startsWith('CP-3') ? 3 : checkpointKey.startsWith('CP-2') ? 2 : checkpointKey.startsWith('CP-1') ? 1 : 0,
      checkpointCode: checkpointKey,
      checkpointTitle: spec?.title ?? checkpointKey,
      health: 'healthy' as AdaptiveHealth,
      hypothesis: String(responses.priorityHypothesis ?? responses.objective ?? masterContext.assumptions?.[0] ?? 'Hipotesis pendiente.'),
      evidence: String(responses.availableEvidence ?? responses.currentEvidence ?? masterContext.knownFacts?.[0] ?? 'Evidencia pendiente.'),
      evidenceStrength: responses.availableEvidence || responses.currentEvidence ? 'weak' : 'none',
      blocker: '',
      actorRequired: String(responses.owner_and_actor_required ?? masterContext.challengeSnapshot?.challengeOwner ?? 'Owner de iniciativa'),
      nextAction: `Completar ${checkpointKey}: ${spec?.title ?? checkpointKey}.`,
      upcomingDecision: String(responses.decisionCriteria ?? masterContext.decisions?.[0] ?? 'Decision pendiente.'),
      updatedAt: new Date().toISOString(),
    });
  }

  private async recordEventTx(tx: any, projectId: string, eventType: string, summary: string, payload: unknown, userId?: string, idempotencyKey?: string) {
    if (idempotencyKey) {
      const existing = await tx.adaptiveAdaptationEvent.findUnique({ where: { idempotencyKey } }).catch(() => null);
      if (existing) return existing;
    }
    return tx.adaptiveAdaptationEvent.create({ data: { projectId, eventType, summary, payloadJson: payload as any, createdById: userId, idempotencyKey } });
  }

  private async nextConfigVersionTx(tx: any, projectId: string, cycleId: string, stepNumber: number): Promise<number> {
    const latest = await tx.adaptiveStepConfiguration.findFirst({ where: { projectId, cycleId, stepNumber }, orderBy: { version: 'desc' } });
    return latest ? latest.version + 1 : 1;
  }

  private nextCheckpointKey(key: string): string | null {
    const order = ['CP-0.1', 'CP-0.2', 'CP-0.3', 'CP-1.1', 'CP-1.2', 'CP-1.3', 'CP-1.4', 'CP-2.1', 'CP-2.2', 'CP-2.3', 'CP-2.4', 'CP-2.5', 'CP-3.1', 'CP-3.2', 'CP-3.3', 'CP-3.4', 'CP-3.5', 'CP-4.1', 'CP-4.2', 'CP-4.3', 'CP-4.4', 'CP-4.5'];
    const idx = order.indexOf(key);
    if (idx < 0 || idx >= order.length - 1) return null;
    const next = order[idx + 1];
    if (key.startsWith('CP-0') && next.startsWith('CP-1')) return null;
    if (key.startsWith('CP-1') && next.startsWith('CP-2')) return null;
    if (key.startsWith('CP-2') && next.startsWith('CP-3')) return null;
    if (key.startsWith('CP-3') && next.startsWith('CP-4')) return null;
    return next;
  }

  private serializeCheckpoint(instance: any, responses?: Record<string, unknown>) {
    const spec = [...STEP0_CHECKPOINTS, ...STEP1_CHECKPOINTS, ...STEP2_CHECKPOINTS, ...STEP3_CHECKPOINTS, ...STEP4_CHECKPOINTS].find((cp) => cp.key === instance.checkpointKey);
    return {
      id: instance.id,
      step: instance.stepNumber,
      checkpointKey: instance.checkpointKey,
      title: spec?.title ?? instance.checkpointKey,
      outputKey: spec?.outputKey ?? instance.checkpointKey,
      status: instance.status,
      sequence: instance.sequence,
      questions: instance.materializedQuestionsJson,
      sufficiency: instance.sufficiencyJson,
      responses: responses ?? {},
      startedAt: instance.startedAt,
      completedAt: instance.completedAt,
      configurationId: instance.stepConfigurationId,
    };
  }

  private applyCriticalChange(context: any, input: CriticalChangeInput) {
    const next = { ...context, version: Number(context.version ?? 1) + 1, requiresReview: true };
    if (input.field === 'scope') next.scope = input.nextValue;
    if (input.field === 'challenge_type') next.challengeType = input.nextValue;
    if (input.field === 'route') next.routeType = input.nextValue;
    if (input.field === 'hypothesis') next.assumptions = [String(input.nextValue), ...(context.assumptions ?? [])];
    if (input.field === 'critical_restriction') next.risks = [String(input.nextValue), ...(context.risks ?? [])];
    if (input.field === 'company_or_area') next.companySnapshot = { ...(context.companySnapshot ?? {}), changedTo: input.nextValue, confirmationRequired: true };
    if (input.field === 'target_date') next.targetDate = input.nextValue;
    if (input.field === 'selected_bet') {
      const selectedBetPatch = input.nextValue && typeof input.nextValue === 'object' && !Array.isArray(input.nextValue)
        ? input.nextValue as Record<string, unknown>
        : { selectedBet: input.nextValue };
      next.step2Output = {
        ...(context.step2Output ?? {}),
        ...selectedBetPatch,
        selectedBet: selectedBetPatch.selectedBet ?? input.nextValue,
        requiresReview: true,
      };
    }
    return next;
  }

  private deriveRouteType(raw: Record<string, any>, portfolioMeta: any): AdaptiveRouteType {
    const text = [raw.nextRecommendedStep, raw.initialFocus, raw.mainRisk, raw.decisionRequested].filter(Boolean).join(' ').toLowerCase();
    if (/quick win|rapido|rapida|simple|liger|pequena|pequeña/.test(text)) return 'lightweight_plan';
    if (text.includes('implementar') || text.includes('handoff') || text.includes('adopcion')) return 'implement_handoff';
    if (text.includes('plan') || text.includes('coordinar') || text.includes('deadline')) return 'plan_coordinate';
    if (text.includes('reconstru')) return 'reconstruct_existing';
    if (text.includes('solucion') || text.includes('dise')) return 'design_solution';
    if ((raw.challengeType ?? portfolioMeta?.challenge?.type) === 'correction') return 'plan_coordinate';
    return 'explore_validate';
  }

  private deriveDepthLevel(raw: Record<string, any>, companyCoverage: number): AdaptiveDepthLevel {
    const risk = String(raw.mainRisk ?? '').toLowerCase();
    const pendingCount = Array.isArray(raw.pendingQuestions) ? raw.pendingQuestions.length : 0;
    if (risk.includes('legal') || risk.includes('datos') || risk.includes('regulator') || pendingCount >= 4) return 'extended';
    if (companyCoverage >= 50 || raw.informationReadiness === 'medium' || raw.informationReadiness === 'high') return 'standard';
    return 'essential';
  }

  private extractCompanyDimension(snapshotJson: any, needles: string[]) {
    return (snapshotJson?.entries ?? [])
      .filter((entry: any) => needles.some((needle) => String(entry.dimension ?? entry.fieldKey ?? '').toLowerCase().includes(needle)))
      .map((entry: any) => typeof entry.value === 'string' ? entry.value : JSON.stringify(entry.value))
      .filter(Boolean)
      .slice(0, 6);
  }

  private compact(values: unknown[]): string[] {
    return values.flatMap((value) => this.toList(value)).map((value) => value.trim()).filter(Boolean);
  }

  private toList(value: unknown): string[] {
    if (Array.isArray(value)) return value.flatMap((item) => this.toList(item));
    if (typeof value === 'string') return value.split(/\n|;/).map((item) => item.trim()).filter(Boolean);
    if (value == null) return [];
    return [String(value)];
  }

  private hasValue(value: unknown): boolean {
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'string') return value.trim().length > 0;
    return value !== undefined && value !== null;
  }

  private sourceRefsFrom(value: unknown): string[] {
    if (Array.isArray(value)) return value.flatMap((item) => this.sourceRefsFrom(item));
    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      return this.sourceRefsFrom(record.sourceRefs ?? record.sourceRef ?? record.id ?? record.url ?? record.name);
    }
    if (typeof value === 'string') return value.split(/\n|;|,/).map((item) => item.trim()).filter(Boolean);
    return [];
  }
}
