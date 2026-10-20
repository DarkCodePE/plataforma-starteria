/**
 * RouteConfirmationService — IR-B4 (ADR-025, PRD §12/§13/§21).
 *
 * "Estoy de acuerdo con esta ruta" → crea la iniciativa (Draft) y abre el Overview.
 * IDEMPOTENTE (RB-IR-017/018): a lo sumo un Project por revisión.
 *
 * REUSO milestone #7 sin acoplar: NO modifica ProjectService.createProject (el archivo
 * que reescribe #122). Llama createProject tal cual (Steps 1–4 + InitiativePortfolioMeta
 * en_step_0) y luego aplica los campos propios de initial-review (origin, snapshot,
 * step0Data) con un update — así IR-B4 no choca con #122.
 */
import type { PrismaClient } from '@prisma/client';
import { AppError } from '../../shared/errors/AppError';
import { ProjectService } from '../projects/project.service';
import type { ImprovedProposal, StrategicQuestion, InformationReadiness } from './initial-review.types';
import { toCanonicalChallengeType } from './initial-review.types';
import { buildAdaptiveCorePrefill } from './adaptive-core';
import { AdaptiveCoreService } from '../adaptive-core/adaptive-core.service';

export interface ConfirmRouteResult {
  routeConfirmationId: string;
  initiativeId: string;
  overviewUrl: string;
}

// Un claim `pending` sin proyecto más viejo que esto quedó de un proceso que murió entre el claim
// y la creación del proyecto: se libera para que el reintento no quede bloqueado para siempre.
const STALE_CLAIM_MS = 2 * 60 * 1000;

export class RouteConfirmationService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly projects: ProjectService,
  ) {}

  async confirmRoute(reviewId: string, userId: string, snapshotId?: string): Promise<ConfirmRouteResult> {
    const review = await this.prisma.initialReview.findUnique({ where: { id: reviewId } });
    if (!review) throw AppError.notFound('Revisión inicial', 'INITIAL_REVIEW_NOT_FOUND');
    if (review.ownerId !== userId) throw AppError.forbidden('No puedes confirmar esta revisión.', 'INITIAL_REVIEW_FORBIDDEN');
    const challengeMandate = await this.readChallengeMandate(review.challengeId);

    // Idempotencia (RB-IR-018): si ya hay un Project, devolver el mismo resultado. Si el proyecto
    // se creó pero la finalización no terminó (auditoría E2E F-04), se completa ahora con el mismo
    // proyecto en vez de bloquear el reintento o crear otro.
    const existing = await this.prisma.routeConfirmation.findUnique({ where: { reviewId } });
    if (existing?.createdProjectId) {
      if (existing.status !== 'initiative_created') {
        const pendingSnapshot = await this.prisma.initialReviewSnapshot.findFirst({ where: { id: existing.snapshotId, reviewId } });
        if (pendingSnapshot) await this.finalize(existing.id, existing.createdProjectId, pendingSnapshot, review, userId, challengeMandate);
      }
      return this.result(existing.id, existing.createdProjectId);
    }
    await this.assertHandoffMayConfirm(review as any, userId);
    if (existing && this.isStale(existing)) {
      await this.prisma.routeConfirmation.delete({ where: { id: existing.id } }).catch(() => {});
    }

    const snapshot = snapshotId
      ? await this.prisma.initialReviewSnapshot.findFirst({ where: { id: snapshotId, reviewId } })
      : await this.prisma.initialReviewSnapshot.findFirst({ where: { reviewId }, orderBy: { version: 'desc' } });
    if (!snapshot) throw AppError.badRequest('La revisión aún no tiene una ruta que confirmar.', 'NO_SNAPSHOT_TO_CONFIRM');

    // Claim idempotente: @@unique(reviewId). Una carrera concurrente falla aquí.
    let confirmation;
    try {
      confirmation = await this.prisma.routeConfirmation.create({
        data: { reviewId, snapshotId: snapshot.id, confirmedBy: userId, selectedChallengeType: snapshot.selectedChallengeType, status: 'pending' },
      });
    } catch {
      const now = await this.prisma.routeConfirmation.findUnique({ where: { reviewId } });
      if (now?.createdProjectId) return this.result(now.id, now.createdProjectId);
      throw AppError.conflict('La confirmación ya está en progreso.', 'ROUTE_CONFIRMATION_IN_PROGRESS');
    }

    // Crea el Project reusando createProject (su propia tx, sin modificar).
    const proposal = (snapshot.improvedProposal ?? {}) as unknown as ImprovedProposal;
    let project;
    try {
      project = await this.projects.createProject(userId, {
        name: this.clampName(proposal.suggestedName),
        description: proposal.improvedDescription ? proposal.improvedDescription.slice(0, 1000) : undefined,
        challengeId: review.challengeId ?? undefined,
        companyContext: (snapshot as any).companyContextSelection ?? undefined,
      } as any);
    } catch (err) {
      // Falla la creación → liberar el claim para permitir reintento (edge §26).
      await this.prisma.routeConfirmation.delete({ where: { id: confirmation.id } }).catch(() => {});
      if (err instanceof AppError) throw err;
      throw AppError.badRequest('No pudimos crear la iniciativa.', 'INITIATIVE_CREATE_FAILED', { hint: 'Tu revisión quedó guardada. Intenta nuevamente.' });
    }

    // Se ata el proyecto al claim apenas existe (status `confirmed` = proyecto creado, falta
    // finalizar). Si algo falla después, el reintento lo encuentra y termina con este proyecto.
    try {
      await this.prisma.routeConfirmation.update({ where: { id: confirmation.id }, data: { createdProjectId: project.id, status: 'confirmed' } });
    } catch {
      await this.prisma.routeConfirmation.delete({ where: { id: confirmation.id } }).catch(() => {});
      throw AppError.badRequest('No pudimos terminar de crear la iniciativa.', 'INITIATIVE_CREATE_FAILED', { hint: 'Tu revisión quedó guardada. Intenta nuevamente.' });
    }

    await this.finalize(confirmation.id, project.id, snapshot, review, userId, challengeMandate);
    return this.result(confirmation.id, project.id);
  }

  /** Campos de procedencia + prefill + estados, atómico. Repetible: sólo escribe valores fijos. */
  private async finalize(confirmationId: string, projectId: string, snapshot: any, review: { id: string; challengeId?: string | null; handoffAssignmentId?: string | null }, userId: string, challengeMandate?: any) {
    try {
      await this.prisma.$transaction(async (tx) => {
        if (review.handoffAssignmentId) {
          const linked = await tx.portfolioHandoffAssignment.updateMany({
            where: { id: review.handoffAssignmentId, state: 'STARTED', initiativeId: null },
            data: { initiativeId: projectId, version: { increment: 1 } },
          });
          if (!linked.count) {
            const current = await tx.portfolioHandoffAssignment.findUnique({ where: { id: review.handoffAssignmentId }, select: { initiativeId: true } });
            if (current?.initiativeId !== projectId) {
              throw AppError.conflict('El encargo ya tiene otra Initiative o ya no puede confirmarse.', 'HANDOFF_INITIATIVE_LINK_CONFLICT');
            }
          }
        }
        await tx.project.update({
          where: { id: projectId },
          data: { origin: 'from_initial_review', initialReviewSnapshotId: snapshot.id, step0Data: this.buildStep0Prefill(snapshot, review.challengeId, challengeMandate) as object },
        });
        await tx.routeConfirmation.update({ where: { id: confirmationId }, data: { createdProjectId: projectId, status: 'initiative_created' } });
        await tx.initialReview.update({ where: { id: review.id }, data: { status: 'converted_to_initiative' } });
      });
      await new AdaptiveCoreService(this.prisma).ensureInitialized(projectId, userId, 'participante');
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.badRequest('La iniciativa se creó pero no terminó de prepararse.', 'INITIATIVE_FINALIZE_FAILED', {
        hint: 'Vuelve a confirmar la ruta: se completará con la misma iniciativa, sin duplicarla.',
      });
    }
  }

  /** Owner confirmation creates an Initiative candidate; it never confirms strategic alignment. */
  private async assertHandoffMayConfirm(review: { handoffAssignmentId?: string | null }, userId: string) {
    if (!review.handoffAssignmentId) return;
    const assignment = await (this.prisma as any).portfolioHandoffAssignment.findUnique({
      where: { id: review.handoffAssignmentId }, include: { members: true },
    });
    const owner = assignment?.members?.find((member: any) => member.role === 'OWNER');
    if (!assignment || assignment.state !== 'STARTED' || assignment.targetKind !== 'CHALLENGE' || owner?.userId !== userId) {
      throw AppError.forbidden('Solo el Initiative Owner puede confirmar la formulación de su encargo iniciado.', 'HANDOFF_CONFIRMATION_FORBIDDEN');
    }
    if (assignment.initiativeId) {
      throw AppError.conflict('Este encargo ya está vinculado a una Initiative.', 'HANDOFF_INITIATIVE_ALREADY_LINKED');
    }
  }

  private isStale(claim: { status: string; createdProjectId?: string | null; updatedAt?: Date | string | null }) {
    if (claim.status !== 'pending' || claim.createdProjectId || !claim.updatedAt) return false;
    return Date.now() - new Date(claim.updatedAt).getTime() > STALE_CLAIM_MS;
  }

  /** Step0PrefillFromInitialReview (PRD §13) serializado en Project.step0Data. */
  private buildStep0Prefill(snapshot: any, challengeId?: string | null, challengeMandate?: any) {
    const proposal = (snapshot.improvedProposal ?? {}) as ImprovedProposal;
    const questions = (snapshot.strategicQuestions ?? []) as StrategicQuestion[];
    const critique = (snapshot.critique ?? {}) as { mainRisk?: string };
    const pending = questions.filter((q) => q.status !== 'answered');
    return {
      source: 'initial_review',
      initialReviewSnapshotId: snapshot.id,
      suggestedName: proposal.suggestedName ?? '',
      challengeType: toCanonicalChallengeType(snapshot.selectedChallengeType),
      contextInitial: snapshot.understandingSummary ?? '',
      initialFocus: proposal.initialFocus ?? '',
      expectedImpact: proposal.expectedImpact ?? '',
      mainRisk: critique.mainRisk ?? '',
      informationReadiness: (snapshot.informationReadiness ?? null) as InformationReadiness | null,
      pendingQuestions: pending,
      nextRecommendedStep: proposal.nextRecommendedStep ?? '',
      adaptiveCore: buildAdaptiveCorePrefill({
        snapshotId: snapshot.id,
        selectedChallengeType: snapshot.selectedChallengeType,
        proposal,
        understandingSummary: snapshot.understandingSummary,
        mainRisk: critique.mainRisk,
        informationReadiness: (snapshot.informationReadiness ?? null) as InformationReadiness | null,
        pendingQuestions: pending,
        companyContext: (snapshot as any).companyContextSelection,
        challengeId,
        challengeMandate,
      }),
    };
  }

  /** Captures the already-governed Challenge envelope at the human confirmation boundary. */
  private async readChallengeMandate(challengeId?: string | null) {
    if (!challengeId) return null;
    const challengeDelegate = (this.prisma as any).challenge;
    if (!challengeDelegate?.findUnique) return null;
    const challenge = await challengeDelegate.findUnique({
      where: { id: challengeId },
      select: {
        id: true,
        title: true,
        knownFacts: true,
        openQuestions: true,
        constraints: true,
        dependencies: true,
        expectedDecision: true,
        strategicFront: {
          select: {
            id: true,
            constraints: true,
            mainKpi: true,
            baseline: true,
            target: true,
            horizon: true,
          },
        },
      },
    });
    return challenge ? { capturedAt: new Date().toISOString(), challenge: { ...challenge, strategicFront: undefined }, strategicFront: challenge.strategicFront } : null;
  }

  private clampName(name?: string): string {
    const n = (name ?? '').trim();
    if (n.length < 3) return 'Iniciativa sin nombre';
    return n.slice(0, 200);
  }

  private result(routeConfirmationId: string, initiativeId: string): ConfirmRouteResult {
    return { routeConfirmationId, initiativeId, overviewUrl: `/initiatives/${initiativeId}/overview` };
  }
}
