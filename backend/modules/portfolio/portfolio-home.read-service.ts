/**
 * PH-2: read-only composition for Portfolio Home.
 *
 * This service deliberately does not persist a projection. Canonical domain
 * records remain the source of truth. PortfolioReading is a derived persisted
 * snapshot, not canonical domain state; the returned object is a request-scoped
 * composition for the Home read path.
 */

export type PortfolioHomePersonView = {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  label?: string | null;
  source: 'canonical' | 'legacy-derived' | 'unknown';
};

export type PortfolioReadingView = {
  summary: string | null;
  strategicUnitCount: number | null;
  activeInitiativeCount: number | null;
  pendingActivationCount: number | null;
  blockerCount: number | null;
  pendingDecisionCount: number | null;
  coverageGapCount: number | null;
  evidenceGapCount: number | null;
  homeState: string | null;
  generatedAt: string | null;
  source: 'portfolio_reading' | 'unavailable';
};

export type PortfolioInvitationView = {
  invitationId: string;
  recipient: string | null;
  status: string | null;
  role: string | null;
  createdAt: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  targetKind: string | null;
  derivationSource: 'canonical' | 'legacy-derived';
};

export type InitiativePortfolioView = {
  initiativeId: string;
  title: string | null;
  strategicFrontId: string | null;
  challengeId: string | null;
  alignmentState: string | null;
  owner: PortfolioHomePersonView | null;
  currentExecutionState: {
    projectStatus: string | null;
    step0Status: string | null;
    currentStep: number | null;
  };
  activationVisibility: 'initiative_exists' | 'initiative_active' | 'unknown';
  blockers: Array<{ summary: string; severity: string | null; source: string }>;
  evidenceSummary: { count: number | null } | null;
  contributionSummary: {
    expected: string | number | null;
    observed: string | number | null;
    attributed: string | number | null;
    derivationSource: 'legacy-derived' | 'unavailable';
  };
  decisionSummary: {
    pendingRequestId: string | null;
    status: string | null;
    recommendation: unknown | null;
  } | null;
  updatedAt: string | null;
};

export type StrategicUnitView = {
  strategicFront: {
    id: string;
    name: string;
    status: string | null;
    priority: string | null;
  };
  desiredOutcome: string | null;
  signal: string | null;
  horizon: string | null;
  challenges: Array<{
    id: string;
    title: string;
    status: string | null;
    owner: string | null;
    invitations: PortfolioInvitationView[];
    initiatives: InitiativePortfolioView[];
    activationVisibility: 'no_invitation' | 'invitation_pending' | 'invitation_terminal' | 'initiative_exists' | 'unknown';
  }>;
  initiativeSummary: {
    total: number;
    activeExecution: number;
    pendingActivation: number;
  };
  attentionSummary: { total: number; blockers: number };
  nextGovernanceAction: string | null;
};

export type AttentionView = {
  type: string;
  source: string;
  entity: { type: string; id: string | null };
  summary: string;
  reason: string | null;
  severity: string | null;
  nextMoveOwner: PortfolioHomePersonView | null;
  suggestedAction: string | null;
  updatedAt: string | null;
  derivationSource: 'canonical' | 'portfolio_reading' | 'legacy-derived' | 'frontend_legacy';
};

export type PendingDecisionView = {
  decisionId: string | null;
  requestId: string;
  initiativeId: string;
  requestedDecision: string | null;
  status: string | null;
  recommendation: unknown | null;
  evidenceSummary: unknown | null;
  decisionAuthority: PortfolioHomePersonView | null;
  updatedAt: string | null;
};

export type PortfolioLearningView = {
  decisionId: string;
  projectId: string;
  initiativeName: string | null;
  challengeId: string | null;
  challengeTitle: string | null;
  strategicFrontId: string | null;
  outcome: string;
  learning: string | null;
  nextAction: string | null;
  coverageBefore: string | null;
  coverageAfter: string | null;
  suggestedReformulation: string | null;
  decidedAt: string;
};

export type PortfolioHomeReadModel = {
  portfolioReading: PortfolioReadingView;
  governance: {
    portfolioLead: PortfolioHomePersonView | null;
    sponsors: PortfolioHomePersonView[];
    challengeOwners: PortfolioHomePersonView[];
    initiativeOwners: PortfolioHomePersonView[];
    decisionAuthorities: PortfolioHomePersonView[];
  };
  strategicUnits: StrategicUnitView[];
  attention: AttentionView[];
  pendingDecisions: PendingDecisionView[];
  recommendations: Array<{
    recommendation: string;
    reason: string | null;
    source: string;
    uncertainty: string | null;
    requiresHumanConfirmation: true;
    derivationSource: 'portfolio_reading' | 'legacy-derived';
  }>;
  handoffAssignments: Array<{
    assignmentId: string;
    targetKind: string;
    challengeRef: string;
    initiativeRef: string | null;
    initiativeOwnerRef: string | null;
    executionTeam: unknown[];
    observers: unknown[];
    handoffState: string;
    acceptedAt: string | null;
    rejectedAt: string | null;
    rejectionReason: string | null;
    portfolioResponse: string | null;
    startedAt: string | null;
    resultingInitiativeRef: string | null;
    lastMaterialEvent: string | null;
    sourceEventRefs: string[];
    projectionVersion: number;
    generatedAt: string;
  }>;
  generatedAt: string;
  /** E2E Job-Driven §23: lo que el portfolio aprendió de las últimas decisiones. */
  learnings: PortfolioLearningView[];
};

type PrismaLike = {
  strategicFront: { findMany: (args: unknown) => Promise<any[]> };
  portfolioBootstrapSession?: { findFirst: (args: unknown) => Promise<any | null> };
  portfolioHandoffProjection?: { findMany: (args: unknown) => Promise<any[]> };
  portfolioLearning?: { findMany: (args: unknown) => Promise<any[]> };
};

const READ_INCLUDE = {
  challenges: {
    include: {
      selectedPeople: true,
      initiativeMetas: {
        include: {
          project: {
            include: {
              owner: { select: { id: true, name: true, email: true } },
              attentionItems: true,
              decisionRequests: { include: { decision: true, authorityUser: { select: { id: true, name: true, email: true } } } },
              decisions: true,
              _count: { select: { evidence: true } },
            },
          },
        },
      },
    },
  },
};

export class PortfolioHomeReadService {
  constructor(private readonly prisma: PrismaLike) {}

  async getHome(userId: string): Promise<PortfolioHomeReadModel> {
    const [fronts, reading, handoffAssignments, learnings] = await Promise.all([
      this.prisma.strategicFront.findMany({ include: READ_INCLUDE, orderBy: { updatedAt: 'desc' } }),
      this.loadLatestReading(userId),
      this.loadHandoffAssignments(),
      this.loadLearnings(),
    ]);

    const strategicUnits = (fronts ?? []).map((front) => this.mapStrategicUnit(front));
    const initiatives = strategicUnits.flatMap((unit) => unit.challenges.flatMap((challenge) => challenge.initiatives));
    const attention = [
      ...this.mapReadingAttention(reading?.primaryAttentionItems),
      ...strategicUnits.flatMap((unit) => unit.challenges.flatMap((challenge) =>
        challenge.initiatives.flatMap((initiative) => this.mapInitiativeAttention(initiative, fronts)),
      )),
    ];
    const pendingDecisions = strategicUnits.flatMap((unit) => unit.challenges.flatMap((challenge) =>
      challenge.initiatives.flatMap((initiative) => this.mapPendingDecisions(initiative, fronts)),
    ));

    const generatedAt = new Date().toISOString();
    return {
      portfolioReading: this.mapReading(reading, strategicUnits, initiatives, attention, pendingDecisions),
      governance: this.mapGovernance(fronts, initiatives, pendingDecisions),
      strategicUnits,
      attention,
      pendingDecisions,
      recommendations: this.mapRecommendations(reading, strategicUnits),
      handoffAssignments,
      learnings,
      generatedAt,
    };
  }

  private async loadLearnings(): Promise<PortfolioLearningView[]> {
    if (!this.prisma.portfolioLearning?.findMany) return [];
    const rows = await this.prisma.portfolioLearning.findMany({
      orderBy: { decidedAt: 'desc' },
      take: 20,
      include: { project: { select: { name: true } }, challenge: { select: { title: true } } },
    });
    return (rows ?? []).map((row: any) => ({
      decisionId: row.decisionId,
      projectId: row.projectId,
      initiativeName: row.project?.name ?? null,
      challengeId: row.challengeId ?? null,
      challengeTitle: row.challenge?.title ?? null,
      strategicFrontId: row.strategicFrontId ?? null,
      outcome: String(row.outcome),
      learning: row.learning ?? null,
      nextAction: row.nextAction ?? null,
      coverageBefore: row.coverageBefore ?? null,
      coverageAfter: row.coverageAfter ?? null,
      suggestedReformulation: row.suggestedReformulation ?? null,
      decidedAt: toIso(row.decidedAt) ?? new Date(0).toISOString(),
    }));
  }

  private async loadHandoffAssignments() {
    if (!this.prisma.portfolioHandoffProjection?.findMany) return [];
    const rows = await this.prisma.portfolioHandoffProjection.findMany({ orderBy: { generatedAt: 'desc' } });
    return (rows ?? []).map((row: any) => ({
      assignmentId: row.assignmentId,
      targetKind: row.targetKind,
      challengeRef: row.challengeRef,
      initiativeRef: row.initiativeRef ?? null,
      initiativeOwnerRef: row.initiativeOwnerRef ?? null,
      executionTeam: Array.isArray(row.executionTeam) ? row.executionTeam : [],
      observers: Array.isArray(row.observers) ? row.observers : [],
      handoffState: row.handoffState,
      acceptedAt: toIso(row.acceptedAt),
      rejectedAt: toIso(row.rejectedAt),
      rejectionReason: row.rejectionReason ?? null,
      portfolioResponse: row.portfolioResponse ?? null,
      startedAt: toIso(row.startedAt),
      resultingInitiativeRef: row.resultingInitiativeRef ?? null,
      lastMaterialEvent: row.lastMaterialEvent ?? null,
      sourceEventRefs: Array.isArray(row.sourceEventRefs) ? row.sourceEventRefs : [],
      projectionVersion: row.projectionVersion,
      generatedAt: toIso(row.generatedAt) ?? new Date().toISOString(),
    }));
  }

  private async loadLatestReading(userId: string): Promise<any | null> {
    if (!this.prisma.portfolioBootstrapSession?.findFirst) return null;
    const session = await this.prisma.portfolioBootstrapSession.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: { readings: { orderBy: { publishedAt: 'desc' }, take: 1 } },
    });
    return session?.readings?.[0] ?? null;
  }

  private mapStrategicUnit(front: any): StrategicUnitView {
    const challenges = (front.challenges ?? []).map((challenge: any) => {
      const initiatives = (challenge.initiativeMetas ?? []).map((meta: any) => this.mapInitiative(meta));
      const invitations = (challenge.selectedPeople ?? []).map((invitation: any) => this.mapInvitation(invitation));
      const activeExecution = initiatives.filter((initiative: InitiativePortfolioView) => initiative.activationVisibility === 'initiative_active').length;
      const pendingActivation = invitations.filter((invitation: PortfolioInvitationView) => ['created', 'sent', 'viewed', 'pendiente', 'notificado'].includes(invitation.status ?? '')).length;
      return {
        id: challenge.id,
        title: challenge.title ?? challenge.name ?? '',
        status: challenge.status ?? null,
        owner: challenge.challengeOwner ?? null,
        invitations,
        initiatives,
        activationVisibility: this.activationVisibility(invitations, initiatives),
        _activeExecution: activeExecution,
        _pendingActivation: pendingActivation,
      };
    });
    const allInitiatives = challenges.flatMap((challenge: any) => challenge.initiatives);
    const attention = allInitiatives.flatMap((initiative: InitiativePortfolioView) => initiative.blockers);
    const nextAction = challenges.flatMap((challenge: any) => challenge.initiatives)
      .map((initiative: any) => initiative.nextActionRecommended)
      .find(Boolean) ?? null;
    return {
      strategicFront: {
        id: front.id,
        name: front.name,
        status: front.status ?? null,
        priority: front.priority ?? null,
      },
      desiredOutcome: front.strategicObjective ?? null,
      signal: front.mainKpi ?? null,
      horizon: front.horizon ?? null,
      challenges: challenges.map(({ _activeExecution, _pendingActivation, ...challenge }: any) => challenge),
      initiativeSummary: {
        total: allInitiatives.length,
        activeExecution: challenges.reduce((sum: number, challenge: any) => sum + challenge._activeExecution, 0),
        pendingActivation: challenges.reduce((sum: number, challenge: any) => sum + challenge._pendingActivation, 0),
      },
      attentionSummary: {
        total: attention.length,
        blockers: attention.filter((item: any) => item.severity === 'blocking' || item.severity === 'high').length,
      },
      nextGovernanceAction: nextAction,
    };
  }

  private mapInitiative(meta: any): InitiativePortfolioView & { nextActionRecommended?: string | null; __project?: any } {
    const project = meta.project ?? null;
    const executionActive = Boolean(project && (Number(project.currentStep) > 0 || ['ACTIVE', 'IN_PROGRESS', 'active'].includes(project.status)));
    const blockers = (project?.attentionItems ?? [])
      .filter((item: any) => item.status === undefined || item.status === 'open')
      .map((item: any) => ({ summary: item.reason ?? item.category ?? 'Atención pendiente', severity: item.severity ?? null, source: 'attention_item' }));
    if (meta.mainBlocker) blockers.push({ summary: meta.mainBlocker, severity: null, source: 'initiative_portfolio_meta' });
    const pending = (project?.decisionRequests ?? []).find((request: any) => !request.decision && ['pending', 'open', 'submitted'].includes(request.status));
    return {
      initiativeId: project?.id ?? meta.projectId,
      title: project?.name ?? null,
      strategicFrontId: meta.strategicFrontId ?? null,
      challengeId: meta.challengeId ?? null,
      alignmentState: meta.alignmentNotes ?? null,
      owner: project?.owner ? this.person(project.owner, 'canonical') : null,
      currentExecutionState: {
        projectStatus: project?.status ?? null,
        step0Status: project?.step0Status ?? null,
        currentStep: typeof project?.currentStep === 'number' ? project.currentStep : null,
      },
      activationVisibility: project ? (executionActive ? 'initiative_active' : 'initiative_exists') : 'unknown',
      blockers,
      evidenceSummary: project?._count ? { count: project._count.evidence ?? null } : null,
      contributionSummary: {
        expected: meta.estimatedContribution ?? null,
        observed: null,
        attributed: null,
        derivationSource: meta.estimatedContribution != null ? 'legacy-derived' : 'unavailable',
      },
      decisionSummary: pending ? {
        pendingRequestId: pending.id,
        status: pending.status ?? null,
        recommendation: pending.recommendationSnapshotJson ?? null,
      } : null,
      updatedAt: toIso(project?.lastModified ?? meta.updatedAt),
      nextActionRecommended: meta.nextActionRecommended ?? null,
      __project: project,
    };
  }

  private mapInvitation(invitation: any): PortfolioInvitationView {
    return {
      invitationId: invitation.id,
      recipient: invitation.recipientEmail ?? invitation.value ?? null,
      status: invitation.invitationStatus ?? invitation.status ?? null,
      role: invitation.role ?? null,
      createdAt: toIso(invitation.createdAt),
      sentAt: toIso(invitation.sentAt),
      viewedAt: toIso(invitation.viewedAt),
      targetKind: invitation.targetType ?? null,
      derivationSource: invitation.invitationStatus ? 'canonical' : 'legacy-derived',
    };
  }

  private activationVisibility(invitations: PortfolioInvitationView[], initiatives: InitiativePortfolioView[]): StrategicUnitView['challenges'][number]['activationVisibility'] {
    if (initiatives.length > 0) return 'initiative_exists';
    if (invitations.length === 0) return 'no_invitation';
    if (invitations.some((invitation) => ['created', 'sent', 'viewed', 'pendiente', 'notificado'].includes(invitation.status ?? ''))) return 'invitation_pending';
    if (invitations.every((invitation) => invitation.status != null)) return 'invitation_terminal';
    return 'unknown';
  }

  private mapInitiativeAttention(initiative: InitiativePortfolioView, _fronts: any[]): AttentionView[] {
    const project = (initiative as any).__project;
    return initiative.blockers.map((blocker: any) => ({
      type: blocker.source === 'initiative_portfolio_meta' ? 'legacy_blocker' : 'project_attention',
      source: blocker.source,
      entity: { type: 'initiative', id: initiative.initiativeId },
      summary: blocker.summary,
      reason: blocker.summary,
      severity: blocker.severity,
      nextMoveOwner: project?.owner ? this.person(project.owner, 'canonical') : null,
      suggestedAction: null,
      updatedAt: initiative.updatedAt,
      derivationSource: blocker.source === 'initiative_portfolio_meta' ? 'legacy-derived' : 'canonical',
    }));
  }

  private mapReadingAttention(raw: unknown): AttentionView[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((item: any) => ({
      type: item.type ?? 'portfolio_signal',
      source: 'portfolio_reading',
      entity: { type: item.targetRef?.type ?? 'portfolio', id: item.targetRef?.id ?? null },
      summary: item.title ?? item.statement ?? 'Portfolio attention',
      reason: item.whyItMatters ?? item.statement ?? null,
      severity: item.severity ?? null,
      nextMoveOwner: null,
      suggestedAction: item.nextAction ?? null,
      updatedAt: null,
      derivationSource: 'portfolio_reading',
    }));
  }

  private mapPendingDecisions(initiative: InitiativePortfolioView, _fronts: any[]): PendingDecisionView[] {
    const project = (initiative as any).__project;
    return (project?.decisionRequests ?? [])
      .filter((request: any) => !request.decision && ['pending', 'open', 'submitted'].includes(request.status))
      .map((request: any) => ({
      decisionId: request.decision?.id ?? null,
      requestId: request.id,
      initiativeId: initiative.initiativeId,
      requestedDecision: this.requestedDecision(request),
      status: request.status ?? null,
      recommendation: request.recommendationSnapshotJson ?? null,
      evidenceSummary: request.readinessSnapshotJson ?? null,
      decisionAuthority: request.authorityUser
        ? this.person(request.authorityUser, 'canonical')
        : null,
      updatedAt: toIso(request.updatedAt),
      }));
  }

  private requestedDecision(request: any): string | null {
    const snapshots = [request.decisionPackageSnapshotJson, request.readinessSnapshotJson];
    for (const snapshot of snapshots) {
      if (!snapshot || typeof snapshot !== 'object') continue;
      const record = snapshot as Record<string, unknown>;
      for (const key of ['requestedDecision', 'decisionRequested', 'decisionType', 'objective']) {
        if (typeof record[key] === 'string') return record[key] as string;
      }
    }
    return null;
  }

  private mapReading(reading: any, units: StrategicUnitView[], initiatives: InitiativePortfolioView[], attention: AttentionView[], decisions: PendingDecisionView[]): PortfolioReadingView {
    if (!reading) return {
      summary: null,
      strategicUnitCount: null,
      activeInitiativeCount: null,
      pendingActivationCount: null,
      blockerCount: null,
      pendingDecisionCount: null,
      coverageGapCount: null,
      evidenceGapCount: null,
      homeState: null,
      generatedAt: null,
      source: 'unavailable',
    };
    return {
      summary: reading.summary ?? null,
      strategicUnitCount: units.length,
      activeInitiativeCount: initiatives.filter((initiative) => initiative.activationVisibility === 'initiative_active').length,
      pendingActivationCount: units.reduce((sum, unit) => sum + unit.initiativeSummary.pendingActivation, 0),
      blockerCount: attention.filter((item) => item.severity === 'blocking' || item.severity === 'high').length,
      pendingDecisionCount: decisions.filter((decision) => !decision.decisionId).length,
      coverageGapCount: null,
      evidenceGapCount: null,
      homeState: reading.homeState ?? null,
      generatedAt: toIso(reading.publishedAt),
      source: 'portfolio_reading',
    };
  }

  private mapGovernance(fronts: any[], initiatives: InitiativePortfolioView[], decisions: PendingDecisionView[]) {
    const sponsors = uniquePeople((fronts ?? []).map((front) => front.sponsor ? this.person({ label: front.sponsor }, 'legacy-derived') : null));
    const challengeOwners = uniquePeople((fronts ?? []).flatMap((front) => (front.challenges ?? []).map((challenge: any) => challenge.challengeOwner ? this.person({ label: challenge.challengeOwner }, 'canonical') : null)));
    const initiativeOwners = uniquePeople(initiatives.map((initiative) => initiative.owner));
    const decisionAuthorities = uniquePeople(decisions.map((decision) => decision.decisionAuthority));
    return { portfolioLead: null, sponsors, challengeOwners, initiativeOwners, decisionAuthorities };
  }

  private mapRecommendations(reading: any, units: StrategicUnitView[]) {
    const recommendations: PortfolioHomeReadModel['recommendations'] = [];
    if (reading?.nextBestAction) recommendations.push({
      recommendation: reading.nextBestAction,
      reason: reading.summary ?? null,
      source: 'PortfolioReading.nextBestAction',
      uncertainty: null,
      requiresHumanConfirmation: true,
      derivationSource: 'portfolio_reading',
    });
    for (const unit of units) {
      if (!unit.nextGovernanceAction) continue;
      recommendations.push({
        recommendation: unit.nextGovernanceAction,
        reason: 'Derivada de metadata de Portfolio existente.',
        source: 'InitiativePortfolioMeta.nextActionRecommended',
        uncertainty: 'legacy-derived',
        requiresHumanConfirmation: true,
        derivationSource: 'legacy-derived',
      });
    }
    return recommendations;
  }

  private person(value: any, source: PortfolioHomePersonView['source']): PortfolioHomePersonView {
    return { id: value?.id ?? null, name: value?.name ?? null, email: value?.email ?? null, label: value?.label ?? null, source };
  }
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function uniquePeople(people: Array<PortfolioHomePersonView | null>): PortfolioHomePersonView[] {
  const result: PortfolioHomePersonView[] = [];
  const seen = new Set<string>();
  for (const person of people) {
    if (!person) continue;
    const key = person.id ?? person.email ?? person.label ?? JSON.stringify(person);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(person);
  }
  return result;
}
